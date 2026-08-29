import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { frameAt } from "@/lib/piano/motion";
import { songRange } from "@/lib/piano/geometry";
import { PianoSynth } from "@/lib/piano/synth";
import type { Lesson, LessonFrame } from "@/lib/piano/types";

export const SPEEDS = [0.25, 0.5, 0.75, 1] as const;

export function useLessonPlayer(lesson: Lesson) {
  const [playing, setPlaying] = useState(false);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [time, setTime] = useState(0);
  const [loopEnabled, setLoopEnabled] = useState(false);
  const [loopStartMeasure, setLoopStartMeasure] = useState(1);
  const [loopEndMeasure, setLoopEndMeasure] = useState(Math.max(1, lesson.measures.length));
  const synthRef = useRef<PianoSynth | null>(null);
  const originRef = useRef<{ audio: number; lesson: number; speed: number } | null>(null);
  const scheduledRef = useRef(new Set<string>());
  const playingRef = useRef(false);
  const speedRef = useRef(speed);
  const timeRef = useRef(time);
  const lessonRef = useRef(lesson);

  playingRef.current = playing;
  speedRef.current = speed;
  timeRef.current = time;
  lessonRef.current = lesson;

  const getSynth = () => {
    if (!synthRef.current) synthRef.current = new PianoSynth();
    return synthRef.current;
  };

  const range = useMemo(
    () => songRange(lesson.notes.map((n) => n.pitch)),
    [lesson],
  );

  const loopRange = useMemo(() => {
    if (!loopEnabled) return null;
    const a = lesson.measures.find((m) => m.index === loopStartMeasure);
    const b = lesson.measures.find((m) => m.index === loopEndMeasure);
    if (!a || !b) return null;
    const start = Math.min(a.start, b.start) * (60 / lesson.bpm);
    const end = Math.max(a.end, b.end) * (60 / lesson.bpm);
    return { start, end };
  }, [loopEnabled, loopStartMeasure, loopEndMeasure, lesson]);

  useEffect(() => {
    setPlaying(false);
    setTime(0);
    setLoopStartMeasure(1);
    setLoopEndMeasure(Math.max(1, lesson.measures.length));
    originRef.current = null;
    scheduledRef.current.clear();
    synthRef.current?.stopAll();

    // Background preload soundfont samples for the active song
    if (lesson.notes.length > 0) {
      const synth = getSynth();
      const pitches = lesson.notes.map((n) => n.pitch);
      synth.loadSamplesForPitches(pitches).catch(() => {});
    }
  }, [lesson.id]);

  const scheduleFrom = useCallback((lessonTime: number, audioT: number, rate: number) => {
    const L = lessonRef.current;
    const synth = synthRef.current;
    if (!synth) return;
    const horizon = lessonTime + 1.25;
    for (const n of L.notes) {
      if (n.start < lessonTime - 0.02) continue;
      if (n.start > horizon) break;
      if (scheduledRef.current.has(n.id)) continue;
      scheduledRef.current.add(n.id);
      const when = audioT + (n.start - lessonTime) / rate;
      synth.play(n.pitch, n.velocity, n.duration / rate, when);
    }
  }, []);

  useEffect(() => {
    if (!playing) {
      originRef.current = null;
      scheduledRef.current.clear();
      synthRef.current?.stopAll();
      return;
    }
    let raf = 0;
    let cancelled = false;
    (async () => {
      const synth = getSynth();
      if (!synth) return;
      const ctx = await synth.resume();
      if (cancelled) return;
      originRef.current = { audio: ctx.currentTime, lesson: timeRef.current, speed: speedRef.current };
      scheduledRef.current.clear();
      scheduleFrom(timeRef.current, ctx.currentTime, speedRef.current);

      const tick = () => {
        if (!playingRef.current || !originRef.current) return;
        const origin = originRef.current;
        const L = lessonRef.current;
        const rate = speedRef.current;
        const elapsed = (synth.currentTime - origin.audio) * origin.speed;
        let t = origin.lesson + elapsed;
        const lr = loopRange;
        const end = lr?.end ?? L.duration;
        const start = lr?.start ?? 0;
        if (t >= end) {
          if (lr) {
            t = start;
            originRef.current = { audio: synth.currentTime, lesson: start, speed: rate };
            scheduledRef.current.clear();
            synth.stopAll();
            scheduleFrom(start, synth.currentTime, rate);
          } else {
            setTime(L.duration);
            setPlaying(false);
            return;
          }
        }
        setTime(t);
        scheduleFrom(t, synth.currentTime, rate);
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    })();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [playing, scheduleFrom, loopRange]);

  useEffect(() => {
    if (!playing || !originRef.current || !synthRef.current) return;
    originRef.current = {
      audio: synthRef.current.currentTime,
      lesson: timeRef.current,
      speed,
    };
    scheduledRef.current.clear();
    synthRef.current.stopAll();
    scheduleFrom(timeRef.current, synthRef.current.currentTime, speed);
  }, [speed, playing, scheduleFrom]);

  const frame: LessonFrame = useMemo(
    () => frameAt(lesson, time, range),
    [lesson, time, range],
  );

  const play = useCallback(async () => {
    const synth = getSynth();
    await synth.resume();
    const pitches = lessonRef.current.notes.map((n) => n.pitch);
    if (!synth.isReadyForPitches(pitches)) {
      setLoadingAudio(true);
      try {
        await synth.loadSamplesForPitches(pitches);
      } finally {
        setLoadingAudio(false);
      }
    }
    if (timeRef.current >= lessonRef.current.duration - 0.05) setTime(0);
    setPlaying(true);
  }, []);

  const pause = useCallback(() => setPlaying(false), []);

  const stop = useCallback(() => {
    setPlaying(false);
    setTime(loopRange?.start ?? 0);
  }, [loopRange]);

  const seek = useCallback((t: number) => {
    const L = lessonRef.current;
    const clamped = Math.max(0, Math.min(L.duration, t));
    setTime(clamped);
    if (playingRef.current && synthRef.current) {
      originRef.current = { audio: synthRef.current.currentTime, lesson: clamped, speed: speedRef.current };
      scheduledRef.current.clear();
      synthRef.current.stopAll();
      scheduleFrom(clamped, synthRef.current.currentTime, speedRef.current);
    }
  }, [scheduleFrom]);

  const step = useCallback(() => {
    const L = lessonRef.current;
    const next = L.notes.find((n) => n.start > timeRef.current + 0.03);
    if (next) seek(next.start);
    else seek(0);
  }, [seek]);

  return {
    playing,
    loadingAudio,
    speed,
    setSpeed,
    time,
    frame,
    range,
    play,
    pause,
    stop,
    seek,
    step,
    loopEnabled,
    setLoopEnabled,
    loopStartMeasure,
    setLoopStartMeasure,
    loopEndMeasure,
    setLoopEndMeasure,
    loopRange,
  };
}
