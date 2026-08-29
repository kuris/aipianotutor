"use client";

import { useMemo, useRef, useState } from "react";
import {
  Hand,
  Pause,
  Play,
  Repeat,
  SkipForward,
  Square,
  Upload,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { PianoStage } from "@/components/piano/piano-stage";
import { StaffView } from "@/components/piano/staff-view";
import { useLessonPlayer, SPEEDS } from "@/hooks/use-lesson-player";
import { buildDemoLesson, buildLessonFromNotes } from "@/lib/piano/lesson";
import { parseMidiFile } from "@/lib/piano/midi";
import { DEMO_SONGS, getDemo } from "@/lib/piano/songs";
import { MOTION_LABEL, type Lesson } from "@/lib/piano/types";
import { cn } from "@/lib/utils";

function loadInitial(): Lesson {
  return buildDemoLesson(getDemo("twinkle"));
}

export function LessonApp() {
  const [lesson, setLesson] = useState<Lesson>(loadInitial);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const player = useLessonPlayer(lesson);

  const measureCount = lesson.measures.length;
  const progressLabel = useMemo(() => {
    const b = player.frame.beat;
    const m = player.frame.measure;
    return `${m}마디  ·  ${b.toFixed(1)}박`;
  }, [player.frame.beat, player.frame.measure]);

  async function onFile(file: File | undefined) {
    if (!file) return;
    try {
      setError(null);
      const parsed = await parseMidiFile(file);
      if (parsed.notes.length === 0) {
        setError("음표를 찾지 못했습니다. 피아노 솔로 MIDI를 올려 주세요.");
        return;
      }
      setLesson(
        buildLessonFromNotes(
          {
            id: `midi-${file.name}`,
            title: parsed.title,
            titleKo: parsed.title,
            composer: "업로드한 MIDI",
            bpm: Math.round(parsed.bpm),
            timeSignature: parsed.timeSignature,
            description: "업로드한 악보에서 양손 운지와 손 이동 경로를 계산했습니다.",
            teach: "자동 운지",
            source: "midi",
          },
          parsed.notes,
        ),
      );
    } catch {
      setError("MIDI를 읽지 못했습니다. 다른 파일을 시도해 주세요.");
    }
  }

  return (
    <div className="flex min-h-dvh flex-col overflow-x-hidden bg-background text-foreground lg:h-dvh lg:overflow-y-auto">
      <header className="shrink-0 border-b border-border">
        <div className="flex items-center gap-4 px-5 py-2.5">
          <div className="min-w-0 shrink-0">
            <p className="font-display text-[1.65rem] leading-none tracking-tight italic">HandPath</p>
            <p className="mt-1 hidden text-xs text-muted-foreground lg:block">
              음표가 아니라, 손을 어떻게 움직여야 하는지를 보여 줍니다
            </p>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button
              size="lg"
              className="min-w-28"
              onClick={() => (player.playing ? player.pause() : player.play())}
            >
              {player.playing ? <Pause /> : <Play />}
              {player.playing ? "일시정지" : "재생"}
            </Button>
            <Button variant="outline" size="icon" aria-label="처음으로" onClick={player.stop}>
              <Square />
            </Button>
            <Button variant="outline" onClick={player.step}>
              <SkipForward />
              다음 음
            </Button>
            <div className="flex items-center gap-1">
              {SPEEDS.map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={player.speed === s ? "default" : "outline"}
                  onClick={() => player.setSpeed(s)}
                  className="tabular-nums"
                >
                  {Math.round(s * 100)}%
                </Button>
              ))}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".mid,.midi,audio/midi"
              className="sr-only"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
            <Button variant="outline" className="min-h-10" onClick={() => fileRef.current?.click()}>
              <Upload />
              MIDI 올리기
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col lg:grid lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="flex shrink-0 flex-col gap-3 border-border p-3 lg:min-h-0 lg:overflow-y-auto lg:border-r">
          <section className="hidden rounded-lg border border-border bg-card p-3 lg:block">
            <p className="text-[11px] tracking-wide text-muted-foreground uppercase">화면 읽기</p>
            <ul className="mt-2 space-y-2 text-[13px] leading-snug">
              <li className="flex gap-2">
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-rh" />
                진한 손 = 지금 연주
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-lh/70" />
                흐린 손 = 다음 자리 대기
              </li>
              <li className="flex gap-2">
                <span className="mt-2 h-px w-4 shrink-0 border-t border-dashed border-muted-foreground" />
                점선 = 손 전체 이동
              </li>
              <li className="flex gap-2">
                <Hand className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                끝 숫자 1=엄지 · 5=새끼
              </li>
            </ul>
          </section>

          <section className="rounded-lg border border-border bg-card p-2">
            <p className="px-2 pb-1.5 text-[11px] tracking-wide text-muted-foreground uppercase">데모 레슨</p>
            <div className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
              {DEMO_SONGS.map((s) => {
                const active = lesson.id === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setLesson(buildDemoLesson(s))}
                    className={cn(
                      "min-w-[148px] rounded-md border px-2.5 py-2 text-left transition-colors duration-150 lg:min-w-0",
                      active
                        ? "border-primary/40 bg-muted"
                        : "border-transparent hover:bg-muted/60",
                    )}
                  >
                    <p className="text-sm font-medium">{s.titleKo}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{s.teach}</p>
                  </button>
                );
              })}
            </div>
          </section>
        </aside>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 p-3">
          <section className="shrink-0 rounded-lg border border-border bg-card px-4 py-2">
            <div className="flex flex-wrap items-center gap-2">
              {player.frame.motion && (
                <Badge variant={player.frame.motion === "PREPARE_NEXT" ? "lh" : "paper"}>
                  {MOTION_LABEL[player.frame.motion]}
                </Badge>
              )}
              <Badge variant="rh">오른손</Badge>
              <Badge variant="lh">왼손</Badge>
              <span className="text-xs text-muted-foreground tabular-nums">{progressLabel}</span>
            </div>
            <p className="font-display mt-1 text-lg leading-snug lg:text-xl">{player.frame.teacherLine}</p>
          </section>

          <StaffView lesson={lesson} frame={player.frame} />

          <div className="min-h-0 flex-1">
            <PianoStage frame={player.frame} range={player.range} />
          </div>

          <section className="shrink-0 rounded-lg border border-border bg-card px-4 py-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="w-10 text-right text-[11px] text-muted-foreground tabular-nums">
                {player.time.toFixed(1)}
              </span>
              <Slider
                min={0}
                max={Math.max(0.1, lesson.duration)}
                step={0.05}
                value={[player.time]}
                onValueChange={(v) => player.seek(v[0] ?? 0)}
              />
              <span className="w-10 text-[11px] text-muted-foreground tabular-nums">
                {lesson.duration.toFixed(1)}
              </span>
              <Button
                variant={player.loopEnabled ? "default" : "outline"}
                size="sm"
                onClick={() => player.setLoopEnabled((v) => !v)}
              >
                <Repeat />
                구간 반복
              </Button>
              <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
                시작
                <select
                  className="h-10 rounded-md border border-border bg-background px-2 text-foreground"
                  value={player.loopStartMeasure}
                  onChange={(e) => player.setLoopStartMeasure(Number(e.target.value))}
                >
                  {Array.from({ length: measureCount }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {i + 1}마디
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
                끝
                <select
                  className="h-10 rounded-md border border-border bg-background px-2 text-foreground"
                  value={player.loopEndMeasure}
                  onChange={(e) => player.setLoopEndMeasure(Number(e.target.value))}
                >
                  {Array.from({ length: measureCount }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {i + 1}마디
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
          </section>
        </main>
      </div>
    </div>
  );
}
