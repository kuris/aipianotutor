import type { Finger, FingeredNote, HandId, MotionKind, ScoreNote } from "./types";

const FINGERS: Finger[] = [1, 2, 3, 4, 5];

function spanComfort(fA: Finger, fB: Finger): number {
  const d = Math.abs(fA - fB);
  if (d === 0) return 0;
  if (d === 1) return 2.4;
  if (d === 2) return 4.2;
  if (d === 3) return 6.2;
  return 8.5;
}

function chordCombos(n: number): Finger[][] {
  const out: Finger[][] = [];
  const rec = (start: number, acc: Finger[]) => {
    if (acc.length === n) {
      out.push([...acc]);
      return;
    }
    for (let i = start; i < FINGERS.length; i++) {
      acc.push(FINGERS[i]!);
      rec(i + 1, acc);
      acc.pop();
    }
  };
  rec(0, []);
  return out;
}

function groupOnsets(notes: ScoreNote[], grid = 0.12): ScoreNote[][] {
  if (notes.length === 0) return [];
  const sorted = [...notes].sort((a, b) => a.start - b.start || a.pitch - b.pitch);
  const groups: ScoreNote[][] = [];
  let cur: ScoreNote[] = [];
  let t0 = -Infinity;
  for (const n of sorted) {
    if (n.start - t0 > grid) {
      if (cur.length) groups.push(cur);
      cur = [n];
      t0 = n.start;
    } else {
      cur.push(n);
    }
  }
  if (cur.length) groups.push(cur);
  return groups;
}

function transitionCost(
  hand: HandId,
  fromPitches: number[],
  fromFingers: Finger[],
  toPitches: number[],
  toFingers: Finger[],
): number {
  let cost = 0;
  if (fromPitches.length === 1 && toPitches.length === 1) {
    const dp = toPitches[0]! - fromPitches[0]!;
    const df = toFingers[0]! - fromFingers[0]!;
    const absP = Math.abs(dp);
    const absF = Math.abs(df);
    const dir = hand === "R" ? 1 : -1;

    if (dp === 0) {
      cost += toFingers[0] === fromFingers[0] ? 0.15 : 1.4;
      return cost;
    }

    if (df === 0) {
      cost += 3.2 + absP * 0.45;
    } else {
      const stretch = absP / absF;
      cost += Math.abs(stretch - 2.2) * 0.9;
      if (Math.sign(dp) !== Math.sign(df) * dir) {
        const thumbUnder =
          (hand === "R" && dp > 0 && fromFingers[0]! >= 3 && toFingers[0] === 1) ||
          (hand === "R" && dp < 0 && fromFingers[0] === 1 && toFingers[0]! >= 3) ||
          (hand === "L" && dp < 0 && fromFingers[0]! >= 3 && toFingers[0] === 1) ||
          (hand === "L" && dp > 0 && fromFingers[0] === 1 && toFingers[0]! >= 3);
        const cross =
          (hand === "R" && dp < 0 && fromFingers[0]! > toFingers[0]! && toFingers[0] !== 1) ||
          (hand === "L" && dp > 0 && fromFingers[0]! > toFingers[0]! && toFingers[0] !== 1);
        cost += thumbUnder ? 1.1 : cross ? 6.5 : 7.5;
      }
    }

    if (absP >= 12) cost += 2.2;
    if (absP >= 19) cost += 3.5;
    if (fromFingers[0] === 5 && toFingers[0] === 5 && absP > 2) cost += 1.6;
    if (fromFingers[0] === 1 && toFingers[0] === 1 && absP > 3) cost += 1.2;
  } else {
    const fromMid = avg(fromPitches);
    const toMid = avg(toPitches);
    cost += Math.abs(toMid - fromMid) * 0.18;
    const reused = toFingers.filter((f) => fromFingers.includes(f)).length;
    if (reused && Math.abs(toMid - fromMid) > 0.4) cost += 0.4;
  }

  for (let i = 0; i < toFingers.length; i++) {
    for (let j = i + 1; j < toFingers.length; j++) {
      const fd = Math.abs(toFingers[j]! - toFingers[i]!);
      const pd = Math.abs(toPitches[j]! - toPitches[i]!);
      const comfort = spanComfort(toFingers[i]!, toFingers[j]!) * 2.1;
      if (pd > comfort + 4) cost += (pd - comfort) * 0.7;
      if (fd === 0) cost += 50;
    }
  }
  return cost;
}

function avg(xs: number[]): number {
  if (!xs.length) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function assignmentsForGroup(notes: ScoreNote[], hand: HandId): Finger[][] {
  const sorted = [...notes].sort((a, b) => a.pitch - b.pitch);
  const n = sorted.length;
  if (n === 1) return FINGERS.map((f) => [f]);
  const combos = chordCombos(n);
  return combos.map((fingers) => (hand === "R" ? fingers : [...fingers].reverse()));
}

interface PathNode {
  cost: number;
  prev: number;
  fingers: Finger[];
}

export function assignHands(notes: ScoreNote[]): ScoreNote[] {
  const byTrack = new Map<number, ScoreNote[]>();
  for (const n of notes) {
    const arr = byTrack.get(n.track) ?? [];
    arr.push(n);
    byTrack.set(n.track, arr);
  }
  const tracks = [...byTrack.entries()].filter(([, ns]) => ns.length > 0);

  if (tracks.length >= 2) {
    const scored = tracks.map(([id, ns]) => ({
      id,
      mean: avg(ns.map((n) => n.pitch)),
    }));
    scored.sort((a, b) => b.mean - a.mean);
    const rh = new Set(scored.filter((_, i) => i < Math.ceil(scored.length / 2)).map((s) => s.id));
    return notes.map((n) => ({
      ...n,
      hand: n.hand ?? (rh.has(n.track) ? "R" : "L"),
    }));
  }

  return notes.map((n) => {
    if (n.hand) return n;
    return { ...n, hand: n.pitch >= 60 ? "R" : "L" };
  });
}

export function fingerHand(notes: ScoreNote[], hand: HandId): FingeredNote[] {
  const mine = notes.filter((n) => n.hand === hand);
  if (mine.length === 0) return [];

  const curated = mine.every((n) => n.finger);
  if (curated) {
    return annotateMotions(
      mine.map((n) => ({
        id: n.id,
        pitch: n.pitch,
        start: n.start,
        duration: n.duration,
        velocity: n.velocity,
        track: n.track,
        hand,
        finger: n.finger as Finger,
        motion: "FINGER_MOVE" as MotionKind,
      })),
      hand,
    );
  }

  const groups = groupOnsets(mine);
  const states: PathNode[][] = groups.map((g) =>
    assignmentsForGroup(g, hand).map((fingers) => ({
      cost: Infinity,
      prev: -1,
      fingers,
    })),
  );

  if (!states[0]) return [];
  for (const s of states[0]) s.cost = 0.4 * s.fingers.reduce((a, f) => a + Math.abs(f - 3), 0);

  for (let i = 1; i < groups.length; i++) {
    const prevG = groups[i - 1]!;
    const g = groups[i]!;
    const prevSorted = [...prevG].sort((a, b) => a.pitch - b.pitch);
    const sorted = [...g].sort((a, b) => a.pitch - b.pitch);
    for (let j = 0; j < states[i]!.length; j++) {
      const node = states[i]![j]!;
      for (let k = 0; k < states[i - 1]!.length; k++) {
        const prev = states[i - 1]![k]!;
        const c =
          prev.cost +
          transitionCost(
            hand,
            prevSorted.map((n) => n.pitch),
            prev.fingers,
            sorted.map((n) => n.pitch),
            node.fingers,
          );
        if (c < node.cost) {
          node.cost = c;
          node.prev = k;
        }
      }
    }
  }

  let bi = 0;
  let best = Infinity;
  const last = states[states.length - 1]!;
  last.forEach((s, i) => {
    if (s.cost < best) {
      best = s.cost;
      bi = i;
    }
  });

  const chosen: Finger[][] = new Array(groups.length);
  for (let i = states.length - 1; i >= 0; i--) {
    chosen[i] = states[i]![bi]!.fingers;
    bi = states[i]![bi]!.prev === -1 ? 0 : states[i]![bi]!.prev;
  }

  const out: FingeredNote[] = [];
  groups.forEach((g, i) => {
    const sorted = [...g].sort((a, b) => a.pitch - b.pitch);
    sorted.forEach((n, k) => {
      out.push({
        id: n.id,
        pitch: n.pitch,
        start: n.start,
        duration: n.duration,
        velocity: n.velocity,
        track: n.track,
        hand,
        finger: chosen[i]![k] ?? 3,
        motion: "FINGER_MOVE",
      });
    });
  });

  out.sort((a, b) => a.start - b.start || a.pitch - b.pitch);
  return annotateMotions(out, hand);
}

export function computeFingering(notes: ScoreNote[]): FingeredNote[] {
  const assigned = assignHands(notes);
  return [...fingerHand(assigned, "R"), ...fingerHand(assigned, "L")].sort(
    (a, b) => a.start - b.start || a.pitch - b.pitch,
  );
}

function annotateMotions(notes: FingeredNote[], hand: HandId): FingeredNote[] {
  const groups = groupOnsets(notes as unknown as ScoreNote[], 0.12) as unknown as FingeredNote[][];
  const tagged: FingeredNote[] = [];

  for (let i = 0; i < groups.length; i++) {
    const g = groups[i]!;
    const prev = groups[i - 1];
    const next = groups[i + 1];
    let motion: MotionKind = g.length > 1 ? "CHORD_SHAPE" : "FINGER_MOVE";

    if (prev && g.length === 1 && prev.length === 1) {
      const a = prev[0]!;
      const b = g[0]!;
      const dp = b.pitch - a.pitch;
      const df = b.finger - a.finger;
      const dir = hand === "R" ? 1 : -1;
      if (dp === 0) motion = "REPEAT";
      else if (Math.abs(dp) >= 14) motion = "JUMP";
      else if (
        (hand === "R" && dp > 0 && a.finger >= 3 && b.finger === 1) ||
        (hand === "R" && dp < 0 && a.finger === 1 && b.finger >= 3) ||
        (hand === "L" && dp < 0 && a.finger >= 3 && b.finger === 1) ||
        (hand === "L" && dp > 0 && a.finger === 1 && b.finger >= 3)
      ) {
        motion = "THUMB_UNDER";
      } else if (Math.sign(dp) !== Math.sign(df) * dir && df !== 0) {
        motion = "FINGER_CROSS";
      } else if (Math.abs(dp) >= 5 && Math.abs(df) <= 1) {
        motion = "HAND_SHIFT";
      } else {
        motion = "FINGER_MOVE";
      }
    }

    if (isScaleRun(groups, i, hand)) motion = "SCALE";
    if (isArpeggio(groups, i)) motion = "ARPEGGIO";
    if (g.length > 1) motion = "CHORD_SHAPE";
    if (prev && samePitches(prev, g) && overlapHold(prev, g)) motion = "HOLD";

    if (next && g.length >= 1) {
      const gap = next[0]!.start - (g[0]!.start + g[0]!.duration);
      if (gap > 0.45 && Math.abs(avg(next.map((n) => n.pitch)) - avg(g.map((n) => n.pitch))) >= 3) {
        /* next slice will show PREPARE; keep current motion */
      }
    }

    for (const n of g) tagged.push({ ...n, motion });
  }
  return tagged;
}

function samePitches(a: FingeredNote[], b: FingeredNote[]): boolean {
  const sa = a.map((n) => n.pitch).sort().join(",");
  const sb = b.map((n) => n.pitch).sort().join(",");
  return sa === sb;
}

function overlapHold(a: FingeredNote[], b: FingeredNote[]): boolean {
  const end = Math.max(...a.map((n) => n.start + n.duration));
  return b[0]!.start <= end + 0.02;
}

function isScaleRun(groups: FingeredNote[][], i: number, hand: HandId): boolean {
  if (i < 3) return false;
  const slice = groups.slice(i - 3, i + 1);
  if (slice.some((g) => g.length !== 1)) return false;
  const pitches = slice.map((g) => g[0]!.pitch);
  const steps = pitches.slice(1).map((p, k) => p - pitches[k]!);
  const dir = Math.sign(steps[0]!);
  if (dir === 0) return false;
  const stepwise = steps.every((s) => Math.sign(s) === dir && Math.abs(s) <= 3);
  if (!stepwise) return false;
  const fingers = slice.map((g) => g[0]!.finger);
  const fdir = hand === "R" ? dir : -dir;
  const thumb = fingers.some((f, k) => k > 0 && f === 1 && fingers[k - 1]! >= 3);
  return thumb || fingers.every((f, k) => k === 0 || Math.sign(f - fingers[k - 1]!) === fdir || f === 1);
}

function isArpeggio(groups: FingeredNote[][], i: number): boolean {
  if (i < 3) return false;
  const slice = groups.slice(i - 3, i + 1);
  if (slice.some((g) => g.length !== 1)) return false;
  const pitches = slice.map((g) => g[0]!.pitch);
  const steps = pitches.slice(1).map((p, k) => p - pitches[k]!);
  const dir = Math.sign(steps[0]!);
  if (dir === 0) return false;
  return steps.every((s) => Math.sign(s) === dir && Math.abs(s) >= 3 && Math.abs(s) <= 9);
}
