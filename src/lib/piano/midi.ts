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
    const b = view.getUint8(offset.i++);
    value = (value << 7) | (b & 0x7f);
    if ((b & 0x80) === 0) break;
  }
  return value;
}

function readString(view: DataView, start: number, length: number): string {
  let s = "";
  for (let i = 0; i < length; i++) s += String.fromCharCode(view.getUint8(start + i));
  return s;
}

export async function parseMidiFile(file: File): Promise<ParsedMidi> {
  const buf = await file.arrayBuffer();
  return parseMidiBuffer(buf, file.name.replace(/\.(mid|midi)$/i, ""));
}

export function parseMidiBuffer(buffer: ArrayBuffer, title = "MIDI"): ParsedMidi {
  const view = new DataView(buffer);
  if (readString(view, 0, 4) !== "MThd") {
    throw new Error("MIDI 헤더가 아닙니다");
  }
  const headerLen = view.getUint32(4);
  const format = view.getUint16(8);
  const ntrks = view.getUint16(10);
  const division = view.getUint16(12);
  const ticksPerBeat = division & 0x8000 ? 480 : division;
  void format;
  void headerLen;

  let bpm = 120;
  let timeSignature: [number, number] = [4, 4];
  let name = title;
  const notes: ScoreNote[] = [];
  let cursor = 8 + headerLen;

  for (let t = 0; t < ntrks; t++) {
    if (cursor + 8 > view.byteLength) break;
    const tag = readString(view, cursor, 4);
    const length = view.getUint32(cursor + 4);
    cursor += 8;
    if (tag !== "MTrk") {
      cursor += length;
      continue;
    }
    const end = cursor + length;
    let tick = 0;
    let running = 0;
    const pending = new Map<string, { start: number; velocity: number }>();
    const off = { i: cursor };

    while (off.i < end) {
      tick += readVLQ(view, off);
      if (off.i >= end) break;
      let status = view.getUint8(off.i);
      if (status < 0x80) {
        status = running;
      } else {
        off.i++;
        running = status;
      }
      const type = status & 0xf0;
      const channel = status & 0x0f;

      if (status === 0xff) {
        const meta = view.getUint8(off.i++);
        const len = readVLQ(view, off);
        if (meta === 0x51 && len === 3) {
          const us = (view.getUint8(off.i) << 16) | (view.getUint8(off.i + 1) << 8) | view.getUint8(off.i + 2);
          bpm = Math.round((60_000_000 / us) * 10) / 10;
        } else if (meta === 0x58 && len >= 2) {
          timeSignature = [view.getUint8(off.i), 2 ** view.getUint8(off.i + 1)];
        } else if (meta === 0x03) {
          const s = readString(view, off.i, len).trim();
          if (s) name = s;
        }
        off.i += len;
        continue;
      }
      if (status === 0xf0 || status === 0xf7) {
        const len = readVLQ(view, off);
        off.i += len;
        continue;
      }
      if (type === 0x90 || type === 0x80) {
        const pitch = view.getUint8(off.i++);
        const vel = view.getUint8(off.i++);
        if (channel === 9) continue;
        const key = `${channel}-${pitch}`;
        const beat = tick / ticksPerBeat;
        if (type === 0x90 && vel > 0) {
          pending.set(key, { start: beat, velocity: vel / 127 });
        } else {
          const on = pending.get(key);
          if (on) {
            notes.push({
              id: `m${t}-${tick}-${pitch}-${notes.length}`,
              pitch,
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
      if (type === 0xc0 || type === 0xd0) {
        off.i += 1;
        continue;
      }
      off.i += 2;
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
