import type { ScoreNote } from "./types";

export interface ParsedMidi {
  title: string;
  bpm: number;
  timeSignature: [number, number];
  notes: ScoreNote[];
}

function readVLQ(view: DataView, offset: { i: number }): number {
  let value = 0;
  for (let n = 0; n < 4; n++) {
    if (offset.i >= view.byteLength) break;
    const b = view.getUint8(offset.i++);
    value = (value << 7) | (b & 0x7f);
    if ((b & 0x80) === 0) break;
  }
  return value;
}

function readString(view: DataView, start: number, length: number): string {
  let s = "";
  const max = Math.min(start + length, view.byteLength);
  for (let i = start; i < max; i++) s += String.fromCharCode(view.getUint8(i));
  return s;
}

export async function parseMidiFile(file: File): Promise<ParsedMidi> {
  const buf = await file.arrayBuffer();
  return parseMidiBuffer(buf, file.name.replace(/\.(mid|midi)$/i, ""));
}

export function parseMidiBuffer(buffer: ArrayBuffer, title = "MIDI"): ParsedMidi {
  const view = new DataView(buffer);
  if (view.byteLength < 14) {
    throw new Error("MIDI 파일 크기가 너무 작습니다");
  }

  // Search for MThd header (supports RIFF/RMID wrappers or metadata headers)
  let mthdOffset = -1;
  const maxSearch = Math.min(2048, view.byteLength - 14);
  for (let i = 0; i <= maxSearch; i++) {
    if (
      view.getUint8(i) === 0x4d && // 'M'
      view.getUint8(i + 1) === 0x54 && // 'T'
      view.getUint8(i + 2) === 0x68 && // 'h'
      view.getUint8(i + 3) === 0x64 // 'd'
    ) {
      mthdOffset = i;
      break;
    }
  }

  if (mthdOffset === -1) {
    throw new Error("유효한 MIDI 헤더(MThd)를 찾을 수 없습니다");
  }

  const headerLen = view.getUint32(mthdOffset + 4);
  const ntrks = view.getUint16(mthdOffset + 10);
  const division = view.getUint16(mthdOffset + 12);
  const ticksPerBeat = division === 0 || division & 0x8000 ? 480 : division;

  let bpm = 120;
  let timeSignature: [number, number] = [4, 4];
  let name = title;
  const notes: ScoreNote[] = [];
  let cursor = mthdOffset + 8 + headerLen;

  let tracksRead = 0;
  while (cursor + 8 <= view.byteLength && tracksRead < Math.max(1, ntrks)) {
    const tag = readString(view, cursor, 4);
    const length = view.getUint32(cursor + 4);
    cursor += 8;

    if (tag !== "MTrk") {
      cursor += length;
      continue;
    }

    const t = tracksRead++;
    const end = Math.min(view.byteLength, cursor + length);
    let tick = 0;
    let running = 0;
    const pending = new Map<string, { start: number; velocity: number }>();
    const off = { i: cursor };

    while (off.i < end) {
      const delta = readVLQ(view, off);
      tick += delta;
      if (off.i >= end) break;

      let status = view.getUint8(off.i);
      if (status < 0x80) {
        if (running === 0) {
          // Invalid running status, skip byte
          off.i++;
          continue;
        }
        status = running;
      } else {
        off.i++;
        // Meta and SysEx events cancel running status
        if (status >= 0xf0) {
          running = 0;
        } else {
          running = status;
        }
      }

      const type = status & 0xf0;
      const channel = status & 0x0f;

      // Meta events
      if (status === 0xff) {
        if (off.i >= end) break;
        const meta = view.getUint8(off.i++);
        const len = readVLQ(view, off);
        const metaEnd = Math.min(end, off.i + len);

        if (meta === 0x51 && len === 3 && off.i + 3 <= end) {
          const us =
            (view.getUint8(off.i) << 16) | (view.getUint8(off.i + 1) << 8) | view.getUint8(off.i + 2);
          if (us > 0) {
            const rawBpm = Math.round((60_000_000 / us) * 10) / 10;
            if (rawBpm >= 20 && rawBpm <= 400) bpm = rawBpm;
          }
        } else if (meta === 0x58 && len >= 2 && off.i + 2 <= end) {
          const num = view.getUint8(off.i);
          const den = 2 ** view.getUint8(off.i + 1);
          if (num > 0 && den > 0) timeSignature = [num, den];
        } else if (meta === 0x03 && len > 0) {
          const s = readString(view, off.i, Math.min(len, metaEnd - off.i)).trim();
          if (s && name === title) name = s;
        } else if (meta === 0x2f) {
          // End of track
          off.i = end;
          break;
        }
        off.i = metaEnd;
        continue;
      }

      // SysEx events
      if (status === 0xf0 || status === 0xf7) {
        const len = readVLQ(view, off);
        off.i = Math.min(end, off.i + len);
        continue;
      }

      // Note On / Note Off
      if (type === 0x90 || type === 0x80) {
        if (off.i + 1 >= end) break;
        const pitch = view.getUint8(off.i++);
        const vel = view.getUint8(off.i++);
        if (channel === 9) continue; // Skip drums

        // Clamp pitch to 88-key piano range (21 ~ 108)
        const safePitch = Math.max(21, Math.min(108, pitch));
        const key = `${channel}-${safePitch}`;
        const beat = tick / ticksPerBeat;

        if (type === 0x90 && vel > 0) {
          const existing = pending.get(key);
          if (existing) {
            notes.push({
              id: `m${t}-${tick}-${safePitch}-${notes.length}`,
              pitch: safePitch,
              start: existing.start,
              duration: Math.max(0.12, beat - existing.start),
              velocity: existing.velocity,
              track: t,
            });
          }
          pending.set(key, { start: beat, velocity: vel / 127 });
        } else {
          const on = pending.get(key);
          if (on) {
            notes.push({
              id: `m${t}-${tick}-${safePitch}-${notes.length}`,
              pitch: safePitch,
              start: on.start,
              duration: Math.max(0.12, beat - on.start),
              velocity: on.velocity,
              track: t,
            });
            pending.delete(key);
          }
        }
        continue;
      }

      // Program Change & Channel Aftertouch (1 data byte)
      if (type === 0xc0 || type === 0xd0) {
        if (off.i < end) off.i += 1;
        continue;
      }

      // Polyphonic Aftertouch, Control Change, Pitch Bend (2 data bytes)
      if (type === 0xa0 || type === 0xb0 || type === 0xe0) {
        if (off.i + 1 < end) off.i += 2;
        else off.i = end;
        continue;
      }

      // Unknown status byte fallback
      if (off.i < end) off.i += 1;
    }

    for (const [key, on] of pending) {
      const pitch = Number(key.split("-")[1]);
      notes.push({
        id: `m${t}-open-${pitch}-${notes.length}`,
        pitch,
        start: on.start,
        duration: 1,
        velocity: on.velocity,
        track: t,
      });
    }
    cursor = end;
  }

  notes.sort((a, b) => a.start - b.start || a.pitch - b.pitch);
  return { title: name, bpm, timeSignature, notes };
}
