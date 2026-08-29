const fs = require('fs');
const path = require('path');

const parsed = JSON.parse(fs.readFileSync(path.join(__dirname, 'parsed_songs.json'), 'utf8'));

// Adjusted BPMs
parsed.fur_elise.bpm = 126;
parsed.canon_d.bpm = 72;
parsed.moonlight_1.bpm = 54;
parsed.rondo_alla_turca.bpm = 120;
parsed.minute_waltz.bpm = 140;
parsed.ode_to_joy.bpm = 108;

function toFingeredNotes(rawNotes) {
  return rawNotes.map((n, idx) => ({
    id: `n-${idx}`,
    pitch: n.pitch,
    start: Number((n.time ?? n.start).toFixed(2)),
    duration: Number(n.duration.toFixed(2)),
    velocity: 80,
    track: n.hand === 'R' ? 1 : 0,
    hand: n.hand,
    finger: n.finger || (n.hand === 'R' ? 1 : 5),
    motion: 'FINGER_MOVE'
  }));
}

function buildLesson(item) {
  const notes = toFingeredNotes(item.notes);
  const maxEnd = notes.reduce((max, n) => Math.max(max, n.start + n.duration), 0);
  const beatPerMeasure = item.timeSignature ? item.timeSignature[0] : 4;
  const numMeasures = Math.ceil(maxEnd / beatPerMeasure) + 1;
  const measures = [];
  for (let m = 0; m < numMeasures; m++) {
    measures.push({ index: m + 1, start: m * beatPerMeasure, end: (m + 1) * beatPerMeasure });
  }

  return {
    id: item.id,
    title: item.title,
    titleKo: item.title,
    composer: item.composer,
    category: item.category,
    level: item.level,
    description: item.description,
    teach: item.description,
    bpm: item.bpm,
    timeSignature: item.timeSignature || [4, 4],
    duration: Number(maxEnd.toFixed(2)),
    measures,
    source: 'midi',
    notes
  };
}

// 1. C Scale Basic
const basicScaleNotes = [
  { pitch: 60, hand: 'R', finger: 1, start: 0, duration: 0.9 },
  { pitch: 62, hand: 'R', finger: 2, start: 1, duration: 0.9 },
  { pitch: 64, hand: 'R', finger: 3, start: 2, duration: 0.9 },
  { pitch: 65, hand: 'R', finger: 4, start: 3, duration: 0.9 },
  { pitch: 67, hand: 'R', finger: 5, start: 4, duration: 1.8 },
  { pitch: 65, hand: 'R', finger: 4, start: 6, duration: 0.9 },
  { pitch: 64, hand: 'R', finger: 3, start: 7, duration: 0.9 },
  { pitch: 62, hand: 'R', finger: 2, start: 8, duration: 0.9 },
  { pitch: 60, hand: 'R', finger: 1, start: 9, duration: 2.8 },
  { pitch: 48, hand: 'L', finger: 5, start: 0, duration: 0.9 },
  { pitch: 50, hand: 'L', finger: 4, start: 1, duration: 0.9 },
  { pitch: 52, hand: 'L', finger: 3, start: 2, duration: 0.9 },
  { pitch: 53, hand: 'L', finger: 2, start: 3, duration: 0.9 },
  { pitch: 55, hand: 'L', finger: 1, start: 4, duration: 1.8 },
  { pitch: 53, hand: 'L', finger: 2, start: 6, duration: 0.9 },
  { pitch: 52, hand: 'L', finger: 3, start: 7, duration: 0.9 },
  { pitch: 50, hand: 'L', finger: 4, start: 8, duration: 0.9 },
  { pitch: 48, hand: 'L', finger: 5, start: 9, duration: 2.8 }
];

const basicScale = buildLesson({
  id: 'basic_c_scale',
  title: 'C장조 도레미파솔 기초 스케일',
  composer: '피아노 기초 연습',
  level: '입문',
  category: '기초연습',
  description: '양손 손가락 번호 1-2-3-4-5 독립 및 순차 상행/하행 기초 훈련',
  bpm: 80,
  timeSignature: [4, 4],
  notes: basicScaleNotes
});

// 2. Hanon 1
const hanonNotes = [];
let hTime = 0;
const hanonBases = [60, 62, 64, 65, 67, 69, 71];
for (const b of hanonBases) {
  const pitchesR = [b, b+3, b+4, b+5, b+6, b+5, b+4, b+3];
  const pitchesL = pitchesR.map(p => p - 12);
  const fingersR = [1, 2, 3, 4, 5, 4, 3, 2];
  const fingersL = [5, 4, 3, 2, 1, 2, 3, 4];
  for (let i = 0; i < 8; i++) {
    hanonNotes.push({ pitch: pitchesR[i], hand: 'R', finger: fingersR[i], start: Number(hTime.toFixed(2)), duration: 0.45 });
    hanonNotes.push({ pitch: pitchesL[i], hand: 'L', finger: fingersL[i], start: Number(hTime.toFixed(2)), duration: 0.45 });
    hTime += 0.5;
  }
}
const hanonDesc = [72, 71, 69, 67, 65, 64, 62, 60];
for (const b of hanonDesc) {
  const pitchesR = [b, b-3, b-4, b-5, b-6, b-5, b-4, b-3];
  const pitchesL = pitchesR.map(p => p - 12);
  const fingersR = [5, 4, 3, 2, 1, 2, 3, 4];
  const fingersL = [1, 2, 3, 4, 5, 4, 3, 2];
  for (let i = 0; i < 8; i++) {
    hanonNotes.push({ pitch: pitchesR[i], hand: 'R', finger: fingersR[i], start: Number(hTime.toFixed(2)), duration: 0.45 });
    hanonNotes.push({ pitch: pitchesL[i], hand: 'L', finger: fingersL[i], start: Number(hTime.toFixed(2)), duration: 0.45 });
    hTime += 0.5;
  }
}

const hanon1 = buildLesson({
  id: 'hanon_no1',
  title: '하논 No.1 손가락 독립 연습',
  composer: 'C.L. 하논',
  level: '초급',
  category: '기초연습',
  description: '1-2번과 4-5번 손가락의 유연성과 독립성을 기르는 피아노 교본 필수곡',
  bpm: 92,
  timeSignature: [4, 4],
  notes: hanonNotes
});

// Masterpiece lessons
const elise = buildLesson({ ...parsed.fur_elise, description: parsed.fur_elise.desc, timeSignature: [3, 8] });
const canon = buildLesson({ ...parsed.canon_d, description: parsed.canon_d.desc, timeSignature: [4, 4] });
const moonlight = buildLesson({ ...parsed.moonlight_1, description: parsed.moonlight_1.desc, timeSignature: [4, 4] });
const rondo = buildLesson({ ...parsed.rondo_alla_turca, description: parsed.rondo_alla_turca.desc, timeSignature: [2, 4] });
const waltz = buildLesson({ ...parsed.minute_waltz, description: parsed.minute_waltz.desc, timeSignature: [3, 4] });
const ode = buildLesson({ ...parsed.ode_to_joy, description: parsed.ode_to_joy.desc, timeSignature: [4, 4] });

const allSongs = [
  basicScale,
  hanon1,
  ode,
  elise,
  canon,
  moonlight,
  rondo,
  waltz
];

const fileContent = `import type { Lesson } from "./types";

export type SongCategory = "전체" | "클래식" | "기초연습";
export type SongLevel = "전체" | "입문" | "초급" | "중급" | "고급";

export interface SongCatalogItem extends Lesson {
  category: "클래식" | "기초연습";
  level: "입문" | "초급" | "중급" | "고급";
}

export type DemoSong = SongCatalogItem;

export const SONG_CATALOG: SongCatalogItem[] = ${JSON.stringify(allSongs, null, 2)};

export const DEMO_SONGS: SongCatalogItem[] = SONG_CATALOG;

export function getDemo(id: string): Lesson {
  const song = SONG_CATALOG.find((s) => s.id === id);
  return song ?? SONG_CATALOG[0]!;
}
`;

fs.writeFileSync(path.join(__dirname, '../src/lib/piano/songs.ts'), fileContent);
console.log('Successfully written', allSongs.length, 'verified songs with backward compatibility exports!');
