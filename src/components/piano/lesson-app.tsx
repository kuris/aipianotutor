"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Clapperboard,
  Hand,
  Loader2,
  Maximize2,
  Pause,
  Play,
  Repeat,
  SkipForward,
  Square,
  Upload,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { PianoStage } from "@/components/piano/piano-stage";
import { PianoStage3D } from "@/components/piano/piano-stage-3d";
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
  const [stageMode, setStageMode] = useState<"3d" | "2d">("3d");
  const [cinemaMode, setCinemaMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const player = useLessonPlayer(lesson);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && cinemaMode) {
        setCinemaMode(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cinemaMode]);

  const [selectedCategory, setSelectedCategory] = useState<"all" | "pop_ost" | "classic" | "practice">("all");
  const [selectedLevel, setSelectedLevel] = useState<"all" | "beginner" | "intermediate" | "advanced">("all");

  const filteredSongs = useMemo(() => {
    return DEMO_SONGS.filter((s) => {
      const matchCat = selectedCategory === "all" || s.category === selectedCategory;
      const matchLvl = selectedLevel === "all" || s.level === selectedLevel;
      return matchCat && matchLvl;
    });
  }, [selectedCategory, selectedLevel]);

  const levelLabels: Record<string, { label: string; color: string }> = {
    beginner: { label: "입문", color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" },
    intermediate: { label: "중급", color: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30" },
    advanced: { label: "고급", color: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30" },
  };

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
      setLoading(true);
      // Give UI a moment to show loading state
      await new Promise((r) => setTimeout(r, 20));

      const parsed = await parseMidiFile(file);
      if (!parsed.notes || parsed.notes.length === 0) {
        setError("MIDI 파일에서 유효한 음표를 찾지 못했습니다. 다른 피아노 악보 MIDI 파일을 시도해 주세요.");
        setLoading(false);
        return;
      }

      const songTitle = parsed.title && parsed.title !== "MIDI" ? parsed.title : file.name.replace(/\.(mid|midi)$/i, "");
      const newLesson = buildLessonFromNotes(
        {
          id: `midi-${Date.now()}`,
          title: songTitle,
          titleKo: songTitle,
          composer: "업로드한 MIDI",
          bpm: Math.round(parsed.bpm) || 120,
          timeSignature: parsed.timeSignature || [4, 4],
          description: `총 ${parsed.notes.length}개의 음표에서 양손 운지와 손 이동 경로를 계산했습니다.`,
          teach: "자동 운지",
          source: "midi",
        },
        parsed.notes,
      );

      setLesson(newLesson);
      player.stop();
    } catch (err) {
      console.error("MIDI parse error:", err);
      const msg = err instanceof Error ? err.message : "알 수 없는 오류";
      setError(`MIDI 파일을 읽는 중 오류가 발생했습니다: ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      onFile(files[0]);
    }
  };

  return (
    <div
      className="relative flex min-h-dvh flex-col overflow-x-hidden bg-background text-foreground lg:h-dvh lg:overflow-y-auto"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm border-2 border-dashed border-primary">
          <div className="flex flex-col items-center gap-2 rounded-xl bg-card p-6 shadow-2xl border border-border text-center">
            <Upload className="size-10 text-primary animate-bounce" />
            <p className="text-lg font-semibold">여기에 MIDI 파일을 놓으세요</p>
            <p className="text-sm text-muted-foreground">.mid 또는 .midi 파일 자동 분석</p>
          </div>
        </div>
      )}

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
              className="min-w-32"
              disabled={player.loadingAudio}
              onClick={() => (player.playing ? player.pause() : player.play())}
            >
              {player.loadingAudio ? (
                <>
                  <Loader2 className="animate-spin" />
                  음원 로딩 중...
                </>
              ) : player.playing ? (
                <>
                  <Pause />
                  일시정지
                </>
              ) : (
                <>
                  <Play />
                  재생
                </>
              )}
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
            <div className="flex items-center rounded-lg border border-border bg-muted/40 p-0.5">
              <button
                type="button"
                onClick={() => setStageMode("3d")}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  stageMode === "3d"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                ✨ 3D 손모양
              </button>
              <button
                type="button"
                onClick={() => setStageMode("2d")}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  stageMode === "2d"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                2D 평면
              </button>
            </div>

            <Button
              variant="default"
              className="bg-amber-600 hover:bg-amber-500 text-white font-semibold shadow-sm"
              onClick={() => {
                setStageMode("3d");
                setCinemaMode(true);
              }}
            >
              <Clapperboard className="size-4" />
              시네마 모드
            </Button>

            <input
              ref={fileRef}
              type="file"
              accept=".mid,.midi,audio/midi"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onFile(file);
                e.target.value = "";
              }}
            />
            <Button
              variant="outline"
              className="min-h-10"
              disabled={loading}
              onClick={() => fileRef.current?.click()}
            >
              <Upload />
              {loading ? "분석 중..." : "MIDI 올리기"}
            </Button>
          </div>
        </div>
      </header>

      {/* Fullscreen Cinema Mode Overlay */}
      {cinemaMode && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black text-white">
          {/* Top Bar with Song Info & Exit */}
          <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between bg-gradient-to-b from-black/80 via-black/40 to-transparent p-6">
            <div>
              <p className="text-xs uppercase tracking-widest text-amber-400 font-semibold">Concert Grand Cinema</p>
              <h2 className="font-display text-2xl tracking-tight text-white">{lesson.titleKo}</h2>
              <p className="text-sm text-neutral-300">{lesson.composer}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCinemaMode(false)}
              className="border-neutral-700 bg-black/60 text-neutral-200 hover:bg-neutral-800 hover:text-white"
            >
              <X className="size-4 mr-1.5" />
              나가기 (ESC)
            </Button>
          </div>

          {/* Main 3D Concert Stage */}
          <div className="h-full w-full flex-1">
            <PianoStage3D frame={player.frame} range={player.range} />
          </div>

          {/* Subtitle & Floating Cinematic Controls */}
          <div className="absolute bottom-0 left-0 right-0 z-30 flex flex-col items-center gap-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent pb-8 pt-12 px-6">
            {/* Cinematic Subtitle Quote */}
            <p className="font-display text-2xl md:text-3xl font-light tracking-wide text-white/90 drop-shadow-md text-center">
              Enjoy the music!
            </p>

            {/* Minimalist Floating Player Controls */}
            <div className="flex w-full max-w-2xl items-center gap-4 rounded-full border border-white/10 bg-black/70 px-5 py-2.5 shadow-2xl backdrop-blur-xl">
              <Button
                size="sm"
                variant="ghost"
                className="text-white hover:bg-white/10"
                onClick={() => (player.playing ? player.pause() : player.play())}
              >
                {player.playing ? <Pause className="size-4" /> : <Play className="size-4" />}
              </Button>
              <span className="text-xs tabular-nums text-neutral-400">
                {player.time.toFixed(1)}s
              </span>
              <Slider
                min={0}
                max={Math.max(0.1, lesson.duration)}
                step={0.05}
                value={[player.time]}
                onValueChange={(v) => player.seek(v[0] ?? 0)}
                className="flex-1"
              />
              <span className="text-xs tabular-nums text-neutral-400">
                {lesson.duration.toFixed(1)}s
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto flex min-h-0 w-full max-w-[1700px] flex-1 flex-col lg:grid lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="flex shrink-0 flex-col gap-3 border-border p-3 lg:min-h-0 lg:overflow-y-auto lg:border-r">
          {/* Category Filter Tabs */}
          <section className="rounded-lg border border-border bg-card p-2.5">
            <p className="px-1 pb-2 text-[11px] font-bold tracking-wider text-muted-foreground uppercase">장르 카테고리</p>
            <div className="grid grid-cols-2 gap-1">
              {[
                { id: "all", label: "전체" },
                { id: "pop_ost", label: "🍿 팝 & OST" },
                { id: "classic", label: "🎻 클래식" },
                { id: "practice", label: "🎹 기초연습" },
              ].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedCategory(c.id as any)}
                  className={cn(
                    "rounded-md px-2 py-1.5 text-xs font-medium transition-all text-center",
                    selectedCategory === c.id
                      ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {/* Level Filter Pills */}
            <p className="px-1 pt-3 pb-1.5 text-[11px] font-bold tracking-wider text-muted-foreground uppercase">난이도 레벨</p>
            <div className="flex gap-1">
              {[
                { id: "all", label: "전체" },
                { id: "beginner", label: "입문" },
                { id: "intermediate", label: "중급" },
                { id: "advanced", label: "고급" },
              ].map((lvl) => (
                <button
                  key={lvl.id}
                  type="button"
                  onClick={() => setSelectedLevel(lvl.id as any)}
                  className={cn(
                    "flex-1 rounded-md px-1.5 py-1 text-[11px] font-medium transition-all text-center",
                    selectedLevel === lvl.id
                      ? "bg-foreground text-background font-bold"
                      : "bg-muted/40 text-muted-foreground hover:bg-muted",
                  )}
                >
                  {lvl.label}
                </button>
              ))}
            </div>
          </section>

          {/* Filtered Song List */}
          <section className="rounded-lg border border-border bg-card p-2">
            <div className="flex items-center justify-between px-2 pb-2">
              <span className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">곡 목록</span>
              <span className="text-[10px] text-muted-foreground">{filteredSongs.length}곡</span>
            </div>
            <div className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
              {filteredSongs.map((s) => {
                const active = lesson.id === s.id;
                const lvlInfo = levelLabels[s.level] || levelLabels.beginner;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setLesson(buildDemoLesson(s))}
                    className={cn(
                      "min-w-[180px] rounded-lg border p-2.5 text-left transition-all duration-150 lg:min-w-0",
                      active
                        ? "border-amber-500/50 bg-amber-500/10 shadow-xs"
                        : "border-transparent hover:border-border hover:bg-muted/50",
                    )}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <p className={cn("text-sm font-semibold truncate", active ? "text-amber-500 dark:text-amber-400" : "text-foreground")}>
                        {s.titleKo}
                      </p>
                      <span className={cn("shrink-0 rounded border px-1.5 py-0.2 text-[10px] font-medium", lvlInfo.color)}>
                        {lvlInfo.label}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground truncate">{s.composer}</p>
                    <p className="mt-1 text-[10px] text-neutral-400 line-clamp-1">{s.teach}</p>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="hidden rounded-lg border border-border bg-card p-3 lg:block">
            <p className="text-[11px] tracking-wide text-muted-foreground uppercase">화면 가이드</p>
            <ul className="mt-2 space-y-2 text-[12px] leading-snug">
              <li className="flex items-center gap-2">
                <span className="size-2 shrink-0 rounded-full bg-rh" />
                오른손 (Coral)
              </li>
              <li className="flex items-center gap-2">
                <span className="size-2 shrink-0 rounded-full bg-lh" />
                왼손 (Cyan)
              </li>
              <li className="flex items-center gap-2">
                <Hand className="size-3.5 shrink-0 text-muted-foreground" />
                숫자 1=엄지 · 5=새끼
              </li>
            </ul>
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
            {stageMode === "3d" ? (
              <PianoStage3D frame={player.frame} range={player.range} />
            ) : (
              <PianoStage frame={player.frame} range={player.range} />
            )}
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
