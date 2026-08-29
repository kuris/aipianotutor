import { computeFingering } from "./fingering";
import { beatsToSeconds } from "./motion";
import type { DemoSong } from "./songs";
import type { Lesson, LessonMeasure, ScoreNote } from "./types";

function measuresFor(durationBeats: number, beatsPerBar: number): LessonMeasure[] {
  const bars = Math.max(1, Math.ceil(durationBeats / beatsPerBar - 1e-6));
  const out: LessonMeasure[] = [];
  for (let i = 0; i < bars; i++) {
    out.push({
      index: i + 1,
      start: i * beatsPerBar,
      end: (i + 1) * beatsPerBar,
    });
  }
  return out;
}

export function buildLessonFromNotes(
  meta: {
    id: string;
    title: string;
    titleKo: string;
    composer: string;
    bpm: number;
    timeSignature: [number, number];
    description: string;
    teach: string;
    source: "demo" | "midi";
  },
  raw: ScoreNote[],
): Lesson {
  const fingered = computeFingering(raw).map((n) => ({
    ...n,
    start: beatsToSeconds(n.start, meta.bpm),
    duration: beatsToSeconds(n.duration, meta.bpm),
  }));
  const duration = fingered.reduce((m, n) => Math.max(m, n.start + n.duration), 0);
  const durationBeats = duration * (meta.bpm / 60);
  return {
    ...meta,
    notes: fingered,
    duration: duration + 0.4,
    measures: measuresFor(durationBeats, meta.timeSignature[0]),
  };
}

export function buildDemoLesson(song: DemoSong): Lesson {
  return buildLessonFromNotes(
    {
      id: song.id,
      title: song.title,
      titleKo: song.titleKo,
      composer: song.composer,
      bpm: song.bpm,
      timeSignature: song.timeSignature,
      description: song.description,
      teach: song.teach,
      source: "demo",
    },
    song.notes,
  );
}
