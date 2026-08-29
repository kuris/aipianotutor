import type { Finger, HandId, ScoreNote } from "./types";

const C3 = 48, D3 = 50, E3 = 52, F3 = 53, G3 = 55, A3 = 57, B3 = 59;
const C4 = 60, D4 = 62, E4 = 64, F4 = 65, G4 = 67, A4 = 69, B4 = 71;
const C5 = 72, D5 = 74, E5 = 76, F5 = 77;
const G2 = 43, A2 = 45, B2 = 47, F2 = 41;

export interface DemoSong {
  id: string;
  title: string;
  titleKo: string;
  composer: string;
  bpm: number;
  timeSignature: [number, number];
  description: string;
  teach: string;
  notes: ScoreNote[];
}

let nid = 0;
function n(
  pitch: number,
  start: number,
  duration: number,
  hand: HandId,
  finger: Finger,
  velocity = 0.78,
): ScoreNote {
  nid += 1;
  return {
    id: `d${nid}`,
    pitch,
    start,
    duration,
    velocity,
    track: hand === "R" ? 0 : 1,
    hand,
    finger,
  };
}

function seq(
  hand: HandId,
  start: number,
  items: Array<[pitch: number, finger: Finger, duration?: number, velocity?: number]>,
): ScoreNote[] {
  let t = start;
  const out: ScoreNote[] = [];
  for (const [pitch, finger, duration = 1, velocity] of items) {
    out.push(n(pitch, t, duration, hand, finger, velocity));
    t += duration;
  }
  return out;
}

function chord(
  pitches: Array<[number, Finger]>,
  start: number,
  duration: number,
  hand: HandId,
  velocity = 0.7,
): ScoreNote[] {
  return pitches.map(([pitch, finger]) => n(pitch, start, duration, hand, finger, velocity));
}

const twinkle: DemoSong = {
  id: "twinkle",
  title: "Twinkle Twinkle Little Star",
  titleKo: "반짝반짝 작은 별",
  composer: "전통 동요",
  bpm: 88,
  timeSignature: [4, 4],
  description: "오른손이 멜로디를 치는 동안, 왼손은 다음 베이스 자리로 미리 이동합니다.",
  teach: "반대편 손의 준비 동작",
  notes: [
    ...seq("R", 0, [
      [C4, 1], [C4, 1], [G4, 4], [G4, 4], [A4, 5], [A4, 5], [G4, 4, 2],
      [F4, 3], [F4, 3], [E4, 2], [E4, 2], [D4, 1], [D4, 2], [C4, 1, 2],
      [G4, 4], [G4, 4], [F4, 3], [F4, 3], [E4, 2], [E4, 2], [D4, 1, 2],
      [G4, 4], [G4, 4], [F4, 3], [F4, 3], [E4, 2], [E4, 2], [D4, 1, 2],
      [C4, 1], [C4, 1], [G4, 4], [G4, 4], [A4, 5], [A4, 5], [G4, 4, 2],
      [F4, 3], [F4, 3], [E4, 2], [E4, 2], [D4, 1], [D4, 2], [C4, 1, 2],
    ]),
    n(C3, 0, 1.5, "L", 5, 0.62),
    n(G2, 4, 1.5, "L", 5, 0.62),
    n(A2, 8, 1.5, "L", 5, 0.6),
    n(G2, 12, 1.5, "L", 5, 0.62),
    n(F2, 16, 1.5, "L", 5, 0.6),
    n(C3, 20, 1.5, "L", 5, 0.62),
    n(G2, 24, 1.5, "L", 5, 0.62),
    n(C3, 28, 1.5, "L", 5, 0.64),
    n(C3, 32, 1.5, "L", 5, 0.62),
    n(G2, 36, 1.5, "L", 5, 0.62),
    n(F2, 40, 1.5, "L", 5, 0.6),
    n(C3, 44, 2, "L", 5, 0.66),
  ],
};

const mary: DemoSong = {
  id: "mary",
  title: "Mary Had a Little Lamb",
  titleKo: "메리의 어린 양",
  composer: "전통 동요",
  bpm: 96,
  timeSignature: [4, 4],
  description: "이웃 음은 이웃 손가락. 손 전체는 거의 그대로 두고 손가락만 바꿉니다.",
  teach: "손가락만 이동",
  notes: [
    ...seq("R", 0, [
      [E4, 3], [D4, 2], [C4, 1], [D4, 2], [E4, 3], [E4, 3], [E4, 3, 2],
      [D4, 2], [D4, 2], [D4, 2, 2], [E4, 3], [G4, 5], [G4, 5, 2],
      [E4, 3], [D4, 2], [C4, 1], [D4, 2], [E4, 3], [E4, 3], [E4, 3], [E4, 3],
      [D4, 2], [D4, 2], [E4, 3], [D4, 2], [C4, 1, 2],
    ]),
    n(C3, 0, 1.6, "L", 5, 0.6),
    n(G3, 4, 1.6, "L", 1, 0.58),
    n(C3, 8, 1.6, "L", 5, 0.6),
    n(G3, 12, 1.6, "L", 1, 0.58),
    n(C3, 16, 1.6, "L", 5, 0.6),
    n(G3, 20, 1.6, "L", 1, 0.58),
    n(G2, 24, 1.6, "L", 5, 0.6),
    n(C3, 28, 2, "L", 5, 0.64),
  ],
};

const ode: DemoSong = {
  id: "ode",
  title: "Ode to Joy",
  titleKo: "환희의 송가",
  composer: "베토벤",
  bpm: 100,
  timeSignature: [4, 4],
  description: "오른손 음계 진행과 왼손 코드 자리 이동. 코드가 바뀌기 전에 왼손이 먼저 갑니다.",
  teach: "코드 자리 미리 잡기",
  notes: [
    ...seq("R", 0, [
      [E4, 3], [E4, 3], [F4, 4], [G4, 5], [G4, 5], [F4, 4], [E4, 3], [D4, 2],
      [C4, 1], [C4, 1], [D4, 2], [E4, 3], [E4, 3, 1.5], [D4, 2, 0.5], [D4, 2, 2],
      [E4, 3], [E4, 3], [F4, 4], [G4, 5], [G4, 5], [F4, 4], [E4, 3], [D4, 2],
      [C4, 1], [C4, 1], [D4, 2], [E4, 3], [D4, 2, 1.5], [C4, 1, 0.5], [C4, 1, 2],
    ]),
    ...chord([[C3, 5], [E3, 3], [G3, 1]], 0, 1.8, "L", 0.58),
    ...chord([[G2, 5], [B2, 3], [D3, 1]], 4, 1.8, "L", 0.58),
    ...chord([[C3, 5], [E3, 3], [G3, 1]], 8, 1.8, "L", 0.6),
    ...chord([[G2, 5], [B2, 2], [D3, 1]], 12, 1.8, "L", 0.58),
    ...chord([[C3, 5], [E3, 3], [G3, 1]], 16, 1.8, "L", 0.58),
    ...chord([[G2, 5], [B2, 3], [D3, 1]], 20, 1.8, "L", 0.58),
    ...chord([[C3, 5], [E3, 3], [G3, 1]], 24, 1.8, "L", 0.6),
    ...chord([[C3, 5], [E3, 3], [G3, 1]], 28, 2, "L", 0.64),
  ],
};

const jingle: DemoSong = {
  id: "jingle",
  title: "Jingle Bells",
  titleKo: "징글벨",
  composer: "J. 피어폰트",
  bpm: 116,
  timeSignature: [4, 4],
  description: "E에서 C로 내려올 때 손 전체가 이동합니다. G를 5번으로 찍은 뒤 엄지가 C를 받습니다.",
  teach: "손 전체 이동",
  notes: [
    ...seq("R", 0, [
      [E4, 3], [E4, 3], [E4, 3, 2],
      [E4, 3], [E4, 3], [E4, 3, 2],
      [E4, 3], [G4, 5], [C4, 1], [D4, 2], [E4, 3, 4],
      [F4, 4], [F4, 4], [F4, 4], [F4, 4],
      [F4, 4], [E4, 3], [E4, 3], [E4, 3],
      [E4, 3], [D4, 2], [D4, 2], [E4, 3], [D4, 2, 2], [G4, 5, 2],
    ]),
    n(C3, 0, 1.4, "L", 5, 0.58),
    n(G2, 4, 1.4, "L", 5, 0.58),
    n(C3, 8, 1.4, "L", 5, 0.6),
    n(C3, 12, 2.2, "L", 5, 0.62),
    n(F3, 16, 1.4, "L", 2, 0.58),
    n(C3, 20, 1.4, "L", 5, 0.58),
    n(G2, 24, 1.4, "L", 5, 0.6),
    n(G2, 28, 2, "L", 5, 0.62),
  ],
};

const grace: DemoSong = {
  id: "grace",
  title: "Amazing Grace",
  titleKo: "어메이징 그레이스",
  composer: "전통 찬송",
  bpm: 72,
  timeSignature: [3, 4],
  description: "느린 호흡 안에서 도약이 나옵니다. 손목을 먼저 보내고 손가락은 나중에 놓으세요.",
  teach: "도약과 손목 선행",
  notes: [
    n(D4, 0, 1, "R", 2),
    n(G4, 1, 2, "R", 1),
    n(B4, 3, 1.5, "R", 3),
    n(G4, 4.5, 0.5, "R", 1),
    n(B4, 5, 2, "R", 3),
    n(A4, 7, 1, "R", 2),
    n(G4, 8, 2, "R", 1),
    n(E4, 10, 1, "R", 3),
    n(D4, 11, 2, "R", 2),
    n(D4, 13, 1, "R", 2),
    n(G4, 14, 2, "R", 1),
    n(B4, 16, 1.5, "R", 3),
    n(G4, 17.5, 0.5, "R", 1),
    n(B4, 18, 2, "R", 3),
    n(A4, 20, 1, "R", 2),
    n(D5, 21, 3, "R", 5),
    ...chord([[G2, 5], [D3, 1]], 1, 2, "L", 0.55),
    ...chord([[G2, 5], [D3, 1]], 4, 2, "L", 0.55),
    ...chord([[D3, 5], [A3, 1]], 7, 2, "L", 0.54),
    ...chord([[G2, 5], [D3, 1]], 10, 2, "L", 0.55),
    ...chord([[G2, 5], [D3, 1]], 14, 2, "L", 0.55),
    ...chord([[G2, 5], [D3, 1]], 17, 2, "L", 0.55),
    ...chord([[D3, 5], [A3, 2]], 20, 4, "L", 0.56),
  ],
};

const chopsticks: DemoSong = {
  id: "chopsticks",
  title: "Chopsticks",
  titleKo: "젓가락 행진곡",
  composer: "전통 연탄곡",
  bpm: 108,
  timeSignature: [4, 4],
  description: "두 손가락이 젓가락처럼 붙어 움직입니다. 양손이 같은 박으로 자리를 옮깁니다.",
  teach: "양손 평행 이동",
  notes: [
    ...seq("R", 0, [
      [F4, 4, 0.5], [G4, 5, 0.5], [F4, 4, 0.5], [G4, 5, 0.5],
      [F4, 4, 0.5], [G4, 5, 0.5], [F4, 4, 0.5], [G4, 5, 0.5],
      [F4, 4, 0.5], [G4, 5, 0.5], [F4, 4, 0.5], [G4, 5, 0.5],
      [F4, 4, 0.5], [G4, 5, 0.5], [F4, 4, 1],
      [G4, 4, 0.5], [A4, 5, 0.5], [G4, 4, 0.5], [A4, 5, 0.5],
      [G4, 4, 0.5], [A4, 5, 0.5], [G4, 4, 0.5], [A4, 5, 0.5],
      [A4, 4, 0.5], [B4, 5, 0.5], [A4, 4, 0.5], [B4, 5, 0.5],
      [C5, 5, 2],
    ]),
    ...seq("L", 0, [
      [C4, 1, 0.5], [D4, 2, 0.5], [C4, 1, 0.5], [D4, 2, 0.5],
      [C4, 1, 0.5], [D4, 2, 0.5], [C4, 1, 0.5], [D4, 2, 0.5],
      [C4, 1, 0.5], [D4, 2, 0.5], [C4, 1, 0.5], [D4, 2, 0.5],
      [C4, 1, 0.5], [D4, 2, 0.5], [C4, 1, 1],
      [D4, 1, 0.5], [E4, 2, 0.5], [D4, 1, 0.5], [E4, 2, 0.5],
      [D4, 1, 0.5], [E4, 2, 0.5], [D4, 1, 0.5], [E4, 2, 0.5],
      [E4, 1, 0.5], [F4, 2, 0.5], [E4, 1, 0.5], [F4, 2, 0.5],
      [G4, 5, 2],
    ]),
  ],
};

function preludeBar(
  start: number,
  lh: Array<[number, Finger]>,
  rh: Array<[number, Finger]>,
): ScoreNote[] {
  const out: ScoreNote[] = [];
  const six = 0.25;
  for (let rep = 0; rep < 2; rep++) {
    const t0 = start + rep * 2;
    lh.forEach(([p, f], i) => out.push(n(p, t0 + i * six, six, "L", f, 0.56)));
    rh.forEach(([p, f], i) => out.push(n(p, t0 + (lh.length + i) * six, six, "R", f, 0.7)));
  }
  return out;
}

const bach: DemoSong = {
  id: "bach",
  title: "Prelude in C Major",
  titleKo: "바흐 프렐류드 C장조",
  composer: "J.S. 바흐",
  bpm: 66,
  timeSignature: [4, 4],
  description: "아르페지오 손 모양을 유지한 채 무게만 옮기다가, 마디가 바뀌면 손 전체가 다음 코드로 이동합니다.",
  teach: "아르페지오와 코드 이동",
  notes: [
    ...preludeBar(0, [[C3, 5], [E3, 3], [G3, 1]], [[C4, 1], [E4, 2], [G4, 3], [C5, 5], [E5, 5]]),
    ...preludeBar(4, [[C3, 5], [D3, 4], [A3, 1]], [[D4, 1], [F4, 2], [A4, 4], [D5, 5], [F5, 5]]),
    ...preludeBar(8, [[B2, 5], [D3, 3], [G3, 1]], [[D4, 1], [F4, 2], [G4, 3], [D5, 5], [F5, 5]]),
    ...preludeBar(12, [[C3, 5], [E3, 3], [G3, 1]], [[C4, 1], [E4, 2], [G4, 3], [C5, 5], [E5, 5]]),
  ],
};

const scale: DemoSong = {
  id: "scale-c",
  title: "C Major Scale",
  titleKo: "다장조 음계 — 엄지 통과",
  composer: "기초 연습",
  bpm: 72,
  timeSignature: [4, 4],
  description: "3번 다음 엄지가 밑으로 들어갑니다. 초보자가 가장 어색해하는 연결을 천천히 보여 줍니다.",
  teach: "엄지 통과",
  notes: [
    ...seq("R", 0, [
      [C4, 1], [D4, 2], [E4, 3], [F4, 1], [G4, 2], [A4, 3], [B4, 4], [C5, 5],
      [C5, 5], [B4, 4], [A4, 3], [G4, 2], [F4, 1], [E4, 3], [D4, 2], [C4, 1],
    ]),
    ...seq("L", 0, [
      [C3, 5], [D3, 4], [E3, 3], [F3, 2], [G3, 1], [A3, 3], [B3, 2], [C4, 1],
      [C4, 1], [B3, 2], [A3, 3], [G3, 1], [F3, 2], [E3, 3], [D3, 4], [C3, 5],
    ]),
  ],
};

export const DEMO_SONGS: DemoSong[] = [twinkle, mary, ode, jingle, grace, chopsticks, bach, scale];

export function getDemo(id: string): DemoSong {
  return DEMO_SONGS.find((s) => s.id === id) ?? twinkle;
}
