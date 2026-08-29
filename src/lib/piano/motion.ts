import {
  WHITE_KEY_W,
  fingerHomePitches,
  fingerRestOffset,
  keyCenterX,
  pitchName,
  type KeyRange,
} from "./geometry";
import {
  FINGER_NAME,
  type FingeredNote,
  type HandFrame,
  type HandId,
  type Lesson,
  type LessonFrame,
  type MotionKind,
  type PressedFinger,
} from "./types";

const PREPARE_WINDOW = 1.35;
const PREPARE_ARRIVE = 0.32;

function notesAt(notes: FingeredNote[], t: number, hand?: HandId): FingeredNote[] {
  return notes.filter((n) => {
    if (hand && n.hand !== hand) return false;
    return n.start <= t + 0.02 && t < n.start + n.duration + 0.04;
  });
}

function nextNotes(notes: FingeredNote[], t: number, hand: HandId): FingeredNote[] {
  const future = notes.filter((n) => n.hand === hand && n.start > t + 0.02);
  if (!future.length) return [];
  const t0 = future[0]!.start;
  return future.filter((n) => n.start <= t0 + 0.08);
}

function lastNotes(notes: FingeredNote[], t: number, hand: HandId): FingeredNote[] {
  const past = notes.filter((n) => n.hand === hand && n.start + n.duration <= t + 0.02);
  if (!past.length) return [];
  const t0 = Math.max(...past.map((n) => n.start));
  return past.filter((n) => n.start >= t0 - 0.08);
}

function palmFromNotes(ns: FingeredNote[], range: KeyRange): number {
  if (!ns.length) return keyCenterX(60, range.start);
  const xs = ns.map((n) => keyCenterX(n.pitch, range.start) - fingerRestOffset(n.hand, n.finger) * WHITE_KEY_W);
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function restPitchesFrom(ns: FingeredNote[]): number[] {
  if (!ns.length) return fingerHomePitches("R", []);
  return fingerHomePitches(
    ns[0]!.hand,
    ns.map((n) => ({ finger: n.finger, pitch: n.pitch })),
  );
}

function buildHand(
  lesson: Lesson,
  t: number,
  hand: HandId,
  range: KeyRange,
): HandFrame {
  const mine = lesson.notes.filter((n) => n.hand === hand);
  const active = notesAt(mine, t);
  const upcoming = nextNotes(mine, t, hand);
  const prev = lastNotes(mine, t, hand);
  const idle = active.length === 0;

  let preparing = false;
  let moving = false;
  let opacity = idle ? 0.42 : 1;
  let motion: MotionKind | null = active[0]?.motion ?? null;

  const fingers: PressedFinger[] = active.map((n) => {
    const elapsed = Math.max(0, t - n.start);
    const dur = Math.max(0.08, n.duration);

    // Strike impulse in the first 0.09s of note onset
    const attackDur = Math.min(0.09, dur * 0.35);
    const releaseDur = Math.min(0.06, dur * 0.3);

    let pressDepth = 1.0;
    let strikeImpact = 0;

    if (elapsed < attackDur) {
      const p = elapsed / attackDur;
      strikeImpact = 1 - p;
      pressDepth = p < 0.45 ? (p / 0.45) * 1.25 : 1.25 - ((p - 0.45) / 0.55) * 0.25;
    } else if (elapsed > dur - releaseDur) {
      const p = (elapsed - (dur - releaseDur)) / releaseDur;
      pressDepth = 1.0 - p * 0.75; // Lift up slightly before next stroke
    }

    return {
      finger: n.finger,
      pitch: n.pitch,
      velocity: n.velocity,
      strikeImpact,
      pressDepth,
    };
  });

  const strikeImpact = fingers.reduce((acc, f) => Math.max(acc, f.strikeImpact ?? 0), 0);

  let palmX: number;
  let nextPalmX: number | null = null;
  let restSource = active.length ? active : prev.length ? prev : upcoming;

  if (!idle) {
    palmX = palmFromNotes(active, range);
    if (upcoming.length) {
      nextPalmX = palmFromNotes(upcoming, range);
    }
  } else if (upcoming.length) {
    const until = upcoming[0]!.start - t;
    nextPalmX = palmFromNotes(upcoming, range);
    const fromX = prev.length ? palmFromNotes(prev, range) : nextPalmX;
    if (until <= PREPARE_WINDOW) {
      preparing = true;
      motion = "PREPARE_NEXT";
      opacity = 0.62;
      const travel = Math.max(0.18, Math.min(PREPARE_ARRIVE + 0.45, upcoming[0]!.start - (prev[0] ? prev[0].start + prev[0].duration : upcoming[0]!.start - PREPARE_WINDOW)));
      const startMove = upcoming[0]!.start - travel;
      const p = Math.max(0, Math.min(1, (t - startMove) / travel));
      const e = p * p * (3 - 2 * p);
      palmX = fromX + (nextPalmX - fromX) * e;
      moving = p > 0.02 && p < 0.98;
      restSource = p > 0.55 ? upcoming : prev.length ? prev : upcoming;
      if (p > 0.85) opacity = 0.78;
    } else {
      palmX = fromX;
      restSource = prev.length ? prev : upcoming;
    }
  } else {
    palmX = prev.length ? palmFromNotes(prev, range) : keyCenterX(hand === "R" ? 64 : 52, range.start);
    restSource = prev.length ? prev : mine.slice(0, 1);
  }

  const span = (active.length ? active : restSource).map((n) => keyCenterX(n.pitch, range.start));
  const minX = span.length ? Math.min(...span) : palmX;
  const maxX = span.length ? Math.max(...span) : palmX;
  const wristRotation = Math.max(-16, Math.min(16, (maxX + minX) / 2 - palmX)) * 0.18 * (hand === "R" ? 1 : -1);

  return {
    hand,
    active: !idle,
    preparing,
    moving,
    opacity,
    palmX,
    nextPalmX,
    wristRotation,
    strikeImpact,
    fingers,
    restPitches: restPitchesFrom(restSource.length ? restSource : mine.slice(0, 5)),
    motion,
    nextNotes: upcoming,
  };
}

function describeNotes(ns: FingeredNote[]): string {
  if (!ns.length) return "";
  if (ns.length === 1) {
    const n = ns[0]!;
    return `${pitchName(n.pitch)} · ${n.finger}번 ${FINGER_NAME[n.finger]}`;
  }
  return ns.map((n) => `${pitchName(n.pitch)}(${n.finger})`).join(" ");
}

function teacherLine(right: HandFrame, left: HandFrame, active: FingeredNote[]): string {
  if (left.preparing && right.active) {
    const next = describeNotes(left.nextNotes);
    return left.moving
      ? `오른손은 연주 중 · 왼손이 다음 자리(${next})로 이동하고 있습니다`
      : `오른손은 연주 중 · 왼손은 이미 ${next} 자리에서 대기합니다`;
  }
  if (right.preparing && left.active) {
    const next = describeNotes(right.nextNotes);
    return right.moving
      ? `왼손은 연주 중 · 오른손이 다음 자리(${next})로 이동하고 있습니다`
      : `왼손은 연주 중 · 오른손은 이미 ${next} 자리에서 대기합니다`;
  }
  if (right.preparing && left.preparing) {
    return "양손이 다음 연주 위치로 미리 이동합니다";
  }
  if (right.motion === "THUMB_UNDER") {
    return "오른손 엄지를 건반 밑으로 넣어 다음 음으로 연결합니다";
  }
  if (left.motion === "THUMB_UNDER") {
    return "왼손 엄지를 건반 밑으로 넣어 다음 음으로 연결합니다";
  }
  if (right.motion === "FINGER_CROSS" || left.motion === "FINGER_CROSS") {
    return "손가락이 교차합니다. 손 모양을 유지한 채 넘어가세요";
  }
  if (right.motion === "JUMP" || left.motion === "JUMP") {
    const h = right.motion === "JUMP" ? "오른손" : "왼손";
    return `${h}이 크게 도약합니다. 손목을 먼저 보내고 손가락을 놓으세요`;
  }
  if (right.motion === "HAND_SHIFT" || left.motion === "HAND_SHIFT") {
    const h = right.motion === "HAND_SHIFT" ? "오른손" : "왼손";
    return `${h} 전체를 새로운 건반 위치로 옮깁니다`;
  }
  if (right.motion === "ARPEGGIO" || left.motion === "ARPEGGIO") {
    return "아르페지오 — 손 모양은 유지하고 무게만 손가락으로 넘깁니다";
  }
  if (right.motion === "CHORD_SHAPE" || left.motion === "CHORD_SHAPE") {
    return "코드 모양을 한 번에 잡으세요. 손 전체가 하나의 형태입니다";
  }
  if (active.length) {
    const rh = active.filter((n) => n.hand === "R");
    const lh = active.filter((n) => n.hand === "L");
    const bits: string[] = [];
    if (rh.length) bits.push(`오른손 ${describeNotes(rh)}`);
    if (lh.length) bits.push(`왼손 ${describeNotes(lh)}`);
    return bits.join("  ·  ");
  }
  if (right.nextNotes.length || left.nextNotes.length) {
    return "다음 음을 위해 손을 자리에 두세요";
  }
  return "손을 건반 위에 두고, 움직임 경로를 따라가 보세요";
}

export function frameAt(lesson: Lesson, time: number, range: KeyRange): LessonFrame {
  const t = Math.max(0, Math.min(time, lesson.duration + 0.01));
  const beat = t * (lesson.bpm / 60);
  const measure = lesson.measures.find((m) => beat >= m.start && beat < m.end)?.index ?? 1;
  const active = notesAt(lesson.notes, t);
  const upcoming = lesson.notes.filter((n) => n.start > t && n.start < t + 1.5).slice(0, 8);
  const right = buildHand(lesson, t, "R", range);
  const left = buildHand(lesson, t, "L", range);
  const motion: MotionKind | null =
    left.preparing || right.preparing
      ? "PREPARE_NEXT"
      : (active[0]?.motion ?? right.motion ?? left.motion);

  return {
    time: t,
    beat,
    measure,
    active,
    upcoming,
    right,
    left,
    teacherLine: teacherLine(right, left, active),
    motion,
  };
}

export function beatsToSeconds(beats: number, bpm: number): number {
  return (beats * 60) / bpm;
}

export function secondsToBeats(sec: number, bpm: number): number {
  return (sec * bpm) / 60;
}
