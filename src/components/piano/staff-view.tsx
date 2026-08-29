import type { FingeredNote, Lesson, LessonFrame } from "@/lib/piano/types";

function diatonicSteps(pitch: number): number {
  const pc = ((pitch % 12) + 12) % 12;
  const oct = Math.floor(pitch / 12) - 1;
  const dia = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6][pc] ?? 0;
  return oct * 7 + dia;
}

const GAP = 8;
const TREBLE_E4 = diatonicSteps(64);
const BASS_G2 = diatonicSteps(43);

function trebleY(pitch: number, origin: number): number {
  return origin + (TREBLE_E4 - diatonicSteps(pitch)) * (GAP / 2);
}

function bassY(pitch: number, origin: number): number {
  return origin + (BASS_G2 - diatonicSteps(pitch)) * (GAP / 2);
}

function accidental(pitch: number): string | null {
  const pc = ((pitch % 12) + 12) % 12;
  if ([1, 3, 6, 8, 10].includes(pc)) return "♯";
  return null;
}

function StaffLines({ x, y, w }: { x: number; y: number; w: number }) {
  return (
    <g>
      {Array.from({ length: 5 }, (_, i) => (
        <line
          key={i}
          x1={x}
          y1={y + i * GAP}
          x2={x + w}
          y2={y + i * GAP}
          stroke="var(--color-paper-ink)"
          strokeWidth={0.9}
          opacity={0.55}
        />
      ))}
    </g>
  );
}

function NoteHead({
  x,
  y,
  note,
  current,
  past,
}: {
  x: number;
  y: number;
  note: FingeredNote;
  current: boolean;
  past: boolean;
}) {
  const fill = current
    ? note.hand === "R"
      ? "var(--color-rh)"
      : "var(--color-lh)"
    : past
      ? "color-mix(in oklab, var(--color-paper-ink) 28%, transparent)"
      : "var(--color-paper-ink)";
  const acc = accidental(note.pitch);
  const stemUp = note.hand === "R" ? y > 70 : y > 168;
  const stemH = 22;
  return (
    <g opacity={past ? 0.55 : 1}>
      {acc && (
        <text
          x={x - 14}
          y={y + 4}
          fontSize={12}
          fill={fill}
          fontFamily="var(--font-display)"
        >
          {acc}
        </text>
      )}
      <ellipse
        cx={x}
        cy={y}
        rx={current ? 7.4 : 6.2}
        ry={current ? 5.4 : 4.5}
        transform={`rotate(-18 ${x} ${y})`}
        fill={note.duration >= 2 && !current ? "none" : fill}
        stroke={fill}
        strokeWidth={1.2}
      />
      {note.duration < 4 && (
        <line
          x1={stemUp ? x + 5.4 : x - 5.4}
          y1={y}
          x2={stemUp ? x + 5.4 : x - 5.4}
          y2={stemUp ? y - stemH : y + stemH}
          stroke={fill}
          strokeWidth={1.15}
        />
      )}
      <circle
        cx={x}
        cy={stemUp ? y + 14 : y - 14}
        r={7}
        fill={note.hand === "R" ? "var(--color-rh)" : "var(--color-lh)"}
        opacity={current ? 1 : 0.85}
      />
      <text
        x={x}
        y={stemUp ? y + 17.5 : y - 10.5}
        textAnchor="middle"
        fontSize={9.5}
        fontWeight={700}
        fill={note.hand === "R" ? "var(--color-rh-fg)" : "var(--color-lh-fg)"}
        fontFamily="var(--font-sans)"
      >
        {note.finger}
      </text>
    </g>
  );
}

export function StaffView({ lesson, frame }: { lesson: Lesson; frame: LessonFrame }) {
  const pxPerSec = 72;
  const padL = 52;
  const width = Math.max(640, padL + lesson.duration * pxPerSec + 48);
  const trebleOrigin = 28;
  const bassOrigin = 118;
  const height = 188;
  const playX = padL + frame.time * pxPerSec;
  const viewX = Math.max(0, playX - 160);

  return (
    <div className="max-w-full shrink-0 overflow-hidden rounded-lg border border-border bg-paper">
      <div className="flex items-center justify-between px-4 pt-2 pb-0.5">
        <p className="font-display text-sm text-paper-ink italic">
          {lesson.titleKo}
          <span className="ml-2 font-sans text-[11px] not-italic tracking-wide text-paper-ink/55">
            {lesson.composer} · {lesson.bpm} BPM · {lesson.timeSignature[0]}/{lesson.timeSignature[1]}
          </span>
        </p>
        <p className="font-sans text-[11px] text-paper-ink/50 tabular-nums">
          마디 {frame.measure}
        </p>
      </div>
      <div className="overflow-x-auto">
        <svg
          viewBox={`${viewX} 0 ${Math.min(width, 980)} ${height}`}
          className="h-[120px] w-full lg:h-[128px]"
          role="img"
          aria-label="운지 번호가 적힌 악보"
        >
          <StaffLines x={0} y={trebleOrigin} w={width} />
          <StaffLines x={0} y={bassOrigin} w={width} />
          <text x={12} y={trebleOrigin + 28} fontSize={28} fill="var(--color-paper-ink)" fontFamily="var(--font-display)">
            𝄞
          </text>
          <text x={12} y={bassOrigin + 30} fontSize={28} fill="var(--color-paper-ink)" fontFamily="var(--font-display)">
            𝄢
          </text>
          {lesson.measures.map((m) => {
            const x = padL + (m.start * 60) / lesson.bpm * pxPerSec;
            return (
              <g key={m.index}>
                <line
                  x1={x}
                  y1={trebleOrigin}
                  x2={x}
                  y2={bassOrigin + GAP * 4}
                  stroke="var(--color-paper-ink)"
                  opacity={0.18}
                />
                <text
                  x={x + 4}
                  y={trebleOrigin - 8}
                  fontSize={9}
                  fill="var(--color-paper-ink)"
                  opacity={0.4}
                  fontFamily="var(--font-sans)"
                >
                  {m.index}
                </text>
              </g>
            );
          })}
          {lesson.notes.map((n) => {
            const x = padL + n.start * pxPerSec;
            const y = n.hand === "R" ? trebleY(n.pitch, trebleOrigin) : bassY(n.pitch, bassOrigin);
            const current = frame.active.some((a) => a.id === n.id);
            const past = n.start + n.duration < frame.time;
            return <NoteHead key={n.id} x={x} y={y} note={n} current={current} past={past} />;
          })}
          <line
            x1={playX}
            y1={8}
            x2={playX}
            y2={height - 8}
            stroke="var(--color-paper-ink)"
            strokeWidth={1.2}
            opacity={0.45}
          />
        </svg>
      </div>
    </div>
  );
}
