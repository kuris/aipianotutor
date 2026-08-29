export type Finger = 1 | 2 | 3 | 4 | 5;
export type HandId = "R" | "L";

export type MotionKind =
  | "FINGER_MOVE"
  | "HAND_SHIFT"
  | "THUMB_UNDER"
  | "FINGER_CROSS"
  | "JUMP"
  | "CHORD_SHAPE"
  | "ARPEGGIO"
  | "SCALE"
  | "REPEAT"
  | "HOLD"
  | "PREPARE_NEXT";

export const MOTION_LABEL: Record<MotionKind, string> = {
  FINGER_MOVE: "손가락만 이동",
  HAND_SHIFT: "손 전체 이동",
  THUMB_UNDER: "엄지 통과",
  FINGER_CROSS: "손가락 교차",
  JUMP: "큰 도약",
  CHORD_SHAPE: "코드 모양",
  ARPEGGIO: "아르페지오",
  SCALE: "음계",
  REPEAT: "같은 음 반복",
  HOLD: "유지",
  PREPARE_NEXT: "다음 자리 준비",
};

export const FINGER_NAME: Record<Finger, string> = {
  1: "엄지",
  2: "검지",
  3: "중지",
  4: "약지",
  5: "새끼",
};

export interface ScoreNote {
  id: string;
  pitch: number;
  start: number;
  duration: number;
  velocity: number;
  track: number;
  hand?: HandId;
  finger?: Finger;
}

export interface FingeredNote {
  id: string;
  pitch: number;
  start: number;
  duration: number;
  velocity: number;
  track: number;
  hand: HandId;
  finger: Finger;
  motion: MotionKind;
}

export interface LessonMeasure {
  index: number;
  start: number;
  end: number;
}

export interface Lesson {
  id: string;
  title: string;
  titleKo: string;
  composer: string;
  bpm: number;
  timeSignature: [number, number];
  description: string;
  teach: string;
  notes: FingeredNote[];
  duration: number;
  measures: LessonMeasure[];
  source: "demo" | "midi";
}

export interface PressedFinger {
  finger: Finger;
  pitch: number;
}

export interface HandFrame {
  hand: HandId;
  active: boolean;
  preparing: boolean;
  moving: boolean;
  opacity: number;
  palmX: number;
  nextPalmX: number | null;
  wristRotation: number;
  fingers: PressedFinger[];
  restPitches: number[];
  motion: MotionKind | null;
  nextNotes: FingeredNote[];
}

export interface LessonFrame {
  time: number;
  beat: number;
  measure: number;
  active: FingeredNote[];
  upcoming: FingeredNote[];
  right: HandFrame;
  left: HandFrame;
  teacherLine: string;
  motion: MotionKind | null;
}
