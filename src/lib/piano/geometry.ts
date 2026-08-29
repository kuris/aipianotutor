const BLACK = new Set([1, 3, 6, 8, 10]);

export const WHITE_KEY_W = 40;
export const BLACK_KEY_W = 24;
export const WHITE_KEY_H = 148;
export const BLACK_KEY_H = 90;
export const KEY_TOP = 18;
export const HAND_AREA = 236;

export function isBlackKey(pitch: number): boolean {
  return BLACK.has(((pitch % 12) + 12) % 12);
}

export function isWhiteKey(pitch: number): boolean {
  return !isBlackKey(pitch);
}

export function countWhiteKeys(from: number, to: number): number {
  let n = 0;
  const a = Math.min(from, to);
  const b = Math.max(from, to);
  for (let p = a; p < b; p++) if (isWhiteKey(p)) n++;
  return n;
}

export function whiteIndexFrom(from: number, pitch: number): number {
  return countWhiteKeys(from, pitch);
}

export function keyCenterX(pitch: number, rangeStart: number): number {
  if (isWhiteKey(pitch)) {
    return (whiteIndexFrom(rangeStart, pitch) + 0.5) * WHITE_KEY_W;
  }
  const leftWhite = pitch - 1;
  return (whiteIndexFrom(rangeStart, leftWhite) + 1) * WHITE_KEY_W;
}

export function keyboardWidth(rangeStart: number, rangeEnd: number): number {
  return countWhiteKeys(rangeStart, rangeEnd + 1) * WHITE_KEY_W;
}

export function pitchName(pitch: number): string {
  const names = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
  const pc = ((pitch % 12) + 12) % 12;
  const oct = Math.floor(pitch / 12) - 1;
  return `${names[pc]}${oct}`;
}

export function noteLetter(pitch: number): string {
  const names = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
  return names[((pitch % 12) + 12) % 12] ?? "C";
}

export interface KeyRange {
  start: number;
  end: number;
}

export function songRange(pitches: number[]): KeyRange {
  if (pitches.length === 0) return { start: 48, end: 84 };
  const min = Math.min(...pitches);
  const max = Math.max(...pitches);
  let start = min;
  while (isBlackKey(start) || start > 21) {
    if (isWhiteKey(start) && start <= min - 2) break;
    start--;
    if (start < 21) {
      start = 21;
      break;
    }
  }
  while (isBlackKey(start) && start > 21) start--;
  let end = max;
  while (end < 108 && (isBlackKey(end) || end < max + 2)) {
    end++;
  }
  while (isBlackKey(end) && end < 108) end++;
  start = Math.max(24, Math.min(start, min));
  end = Math.min(96, Math.max(end, max));
  return { start, end };
}

/** Rest offsets in white-key units from palm center. Thumb is toward the body (inner). */
export function fingerRestOffset(hand: "R" | "L", finger: 1 | 2 | 3 | 4 | 5): number {
  const rh: Record<number, number> = { 1: -1.55, 2: -0.55, 3: 0.35, 4: 1.15, 5: 1.95 };
  const v = rh[finger] ?? 0;
  return hand === "R" ? v : -v;
}

export function stepWhite(pitch: number, steps: number): number {
  let p = pitch;
  if (steps === 0) return isWhiteKey(p) ? p : p - 1;
  const dir = steps > 0 ? 1 : -1;
  let left = Math.abs(steps);
  while (left > 0) {
    p += dir;
    if (p < 21 || p > 108) break;
    if (isWhiteKey(p)) left--;
  }
  return p;
}

/** Place all five fingers on nearby keys from any currently used finger/pitch anchors. */
export function fingerHomePitches(
  hand: "R" | "L",
  anchors: { finger: 1 | 2 | 3 | 4 | 5; pitch: number }[],
): number[] {
  const fs = [1, 2, 3, 4, 5] as const;
  if (!anchors.length) {
    const home = hand === "R" ? 60 : 48;
    return fs.map((f) => (hand === "R" ? stepWhite(home, f - 1) : stepWhite(home, 5 - f)));
  }
  return fs.map((f) => {
    const hit = anchors.find((a) => a.finger === f);
    if (hit) return hit.pitch;
    const a = anchors.reduce((best, x) =>
      Math.abs(x.finger - f) < Math.abs(best.finger - f) ? x : best,
    );
    const delta = f - a.finger;
    return stepWhite(a.pitch, hand === "R" ? delta : -delta);
  });
}

export const STAGE_H = KEY_TOP + WHITE_KEY_H + HAND_AREA;
