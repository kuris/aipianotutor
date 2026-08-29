import { useEffect, useRef } from "react";
import {
  BLACK_KEY_H,
  BLACK_KEY_W,
  fingerHomePitches,
  isBlackKey,
  isWhiteKey,
  keyCenterX,
  keyboardWidth,
  KEY_TOP,
  noteLetter,
  pitchName,
  STAGE_H,
  WHITE_KEY_H,
  WHITE_KEY_W,
  type KeyRange,
} from "@/lib/piano/geometry";
import type { Finger, HandFrame, LessonFrame } from "@/lib/piano/types";

function capsule(x1: number, y1: number, x2: number, y2: number, r1: number, r2: number): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const a1x = x1 + nx * r1;
  const a1y = y1 + ny * r1;
  const a2x = x2 + nx * r2;
  const a2y = y2 + ny * r2;
  const b2x = x2 - nx * r2;
  const b2y = y2 - ny * r2;
  const b1x = x1 - nx * r1;
  const b1y = y1 - ny * r1;
  return `M ${a1x} ${a1y} L ${a2x} ${a2y} A ${r2} ${r2} 0 0 1 ${b2x} ${b2y} L ${b1x} ${b1y} A ${r1} ${r1} 0 0 1 ${a1x} ${a1y} Z`;
}

const FINGER_WIDTH: Record<Finger, [number, number]> = {
  1: [11.5, 8.8],
  2: [9.4, 7.1],
  3: [9.8, 7.3],
  4: [8.9, 6.9],
  5: [7.6, 6.1],
};

const KNUC_UP: Record<Finger, number> = { 1: 12, 2: 24, 3: 28, 4: 24, 5: 18 };

function HandSvg({
  pose,
  range,
  ghost,
}: {
  pose: HandFrame;
  range: KeyRange;
  ghost?: boolean;
}) {
  const hand = pose.hand;
  const keyBottom = KEY_TOP + WHITE_KEY_H;
  // Wrist & palm slight drop bounce on strike
  const wristBounce = ghost ? 0 : (pose.strikeImpact ?? 0) * 4.2;
  const palmY = keyBottom + (hand === "R" ? 102 : 124) + wristBounce;
  const palmX = pose.palmX;
  const accent = hand === "R" ? "var(--color-rh)" : "var(--color-lh)";
  const fill = ghost ? "transparent" : "var(--color-skin)";
  const stroke = ghost ? accent : "var(--color-skin-line)";
  const strokeDash = ghost ? "6 5" : undefined;
  const opacity = ghost ? 0.55 : pose.opacity;

  const anchors = ghost && pose.nextNotes.length
    ? pose.nextNotes.map((n) => ({ finger: n.finger, pitch: n.pitch }))
    : pose.fingers.length
      ? pose.fingers
      : pose.restPitches.map((pitch, i) => ({ finger: ((i + 1) as Finger), pitch }));

  const homes = fingerHomePitches(hand, anchors);

  const tips = ([1, 2, 3, 4, 5] as Finger[]).map((f) => {
    const pressed = !ghost && pose.fingers.find((p) => p.finger === f);
    const pitch = pressed ? pressed.pitch : homes[f - 1]!;
    const black = isBlackKey(pitch);
    const restY = black ? KEY_TOP + BLACK_KEY_H + 6 : keyBottom - 8;
    const fullPressY = black ? KEY_TOP + BLACK_KEY_H - 10 : keyBottom - 30;
    const depth = pressed ? (pressed.pressDepth ?? 1) : 0;
    const impact = pressed ? (pressed.strikeImpact ?? 0) : 0;
    const y = restY + (fullPressY - restY) * Math.min(1.28, Math.max(0, depth * 1.04));

    return {
      f,
      pitch,
      x: keyCenterX(pitch, range.start),
      y,
      press: pressed ? 1 : 0,
      depth,
      impact,
    };
  });

  const bases = tips.map((tip) => {
    const inward = hand === "R" ? 1 : -1;
    const thumbPull = tip.f === 1 ? inward * 18 : 0;
    return {
      f: tip.f,
      x: palmX * 0.38 + tip.x * 0.62 + thumbPull,
      y: palmY - KNUC_UP[tip.f],
    };
  });

  const palmLeft = Math.min(...bases.map((b) => b.x)) - 10;
  const palmRight = Math.max(...bases.map((b) => b.x)) + 10;
  const wristY = palmY + 40;
  const wristPath = capsule(palmX, palmY + 10, palmX, wristY, 20, 15);
  const palmPath = [
    `M ${palmLeft + 10} ${palmY + 18}`,
    `Q ${palmX} ${palmY + 24} ${palmRight - 10} ${palmY + 18}`,
    `L ${palmRight} ${palmY - 4}`,
    `Q ${palmX} ${palmY - 12} ${palmLeft} ${palmY - 4}`,
    "Z",
  ].join(" ");

  return (
    <g opacity={opacity} style={{ transition: "opacity 180ms ease" }}>
      <path d={wristPath} fill={fill} stroke={stroke} strokeWidth={ghost ? 1.6 : 1.15} strokeDasharray={strokeDash} />
      <path d={palmPath} fill={fill} stroke={stroke} strokeWidth={ghost ? 1.6 : 1.15} strokeDasharray={strokeDash} />
      {tips.map((tip) => {
        const base = bases.find((b) => b.f === tip.f)!;
        const [w1, w2] = FINGER_WIDTH[tip.f];
        const thumbBend = tip.f === 1 ? (hand === "R" ? -14 : 14) : 0;
        const midX = (base.x + tip.x) / 2 + thumbBend;
        const midY = (base.y + tip.y) / 2 + (tip.f === 1 ? 6 : 0);
        const pressing = tip.press === 1;
        return (
          <g key={`${ghost ? "g" : "h"}-${hand}-${tip.f}`}>
            <path
              d={capsule(base.x, base.y, midX, midY, w1, w1 * 0.92)}
              fill={fill}
              stroke={stroke}
              strokeWidth={1.1}
              strokeDasharray={strokeDash}
            />
            <path
              d={capsule(midX, midY, tip.x, tip.y, w1 * 0.9, w2)}
              fill={pressing && !ghost ? accent : fill}
              stroke={stroke}
              strokeWidth={1.1}
              strokeDasharray={strokeDash}
            />
            {!ghost && (
              <>
                {pressing && tip.impact > 0.04 && (
                  <circle
                    cx={tip.x}
                    cy={tip.y}
                    r={11 + (1 - tip.impact) * 11}
                    fill="none"
                    stroke={accent}
                    strokeWidth={1.8 * tip.impact}
                    opacity={tip.impact * 0.85}
                  />
                )}
                <circle
                  cx={tip.x}
                  cy={tip.y}
                  r={pressing ? 10.5 + tip.impact * 2.5 : 8.5}
                  fill={pressing ? accent : "var(--color-background)"}
                  stroke={accent}
                  strokeWidth={pressing ? 1.8 : 1.4}
                />
                <text
                  x={tip.x}
                  y={tip.y + 4.2}
                  textAnchor="middle"
                  fill={pressing ? (hand === "R" ? "var(--color-rh-fg)" : "var(--color-lh-fg)") : accent}
                  fontSize={11.5}
                  fontWeight={700}
                  fontFamily="var(--font-sans)"
                >
                  {tip.f}
                </text>
              </>
            )}
            {ghost && (
              <circle cx={tip.x} cy={tip.y} r={6} fill="none" stroke={accent} strokeDasharray="3 2" strokeWidth={1.3} />
            )}
          </g>
        );
      })}
    </g>
  );
}

function PrepareArrow({ from, to, y, color }: { from: number; to: number; y: number; color: string }) {
  if (Math.abs(to - from) < 14) return null;
  const dir = to > from ? 1 : -1;
  const x1 = from + dir * 10;
  const x2 = to - dir * 12;
  return (
    <g>
      <line x1={x1} y1={y} x2={x2} y2={y} stroke={color} strokeWidth={2} strokeDasharray="7 5" opacity={0.85} />
      <polygon
        points={`${x2},${y} ${x2 - dir * 10},${y - 5} ${x2 - dir * 10},${y + 5}`}
        fill={color}
        opacity={0.9}
      />
    </g>
  );
}

function Keyboard({ range, frame }: { range: KeyRange; frame: LessonFrame }) {
  const keys: number[] = [];
  for (let p = range.start; p <= range.end; p++) keys.push(p);
  const whites = keys.filter(isWhiteKey);
  const blacks = keys.filter(isBlackKey);
  const y = KEY_TOP;
  const active = new Map(frame.active.map((n) => [n.pitch, n.hand]));
  const next = new Set([...frame.right.nextNotes, ...frame.left.nextNotes].map((n) => n.pitch));

  return (
    <g>
      {whites.map((p, i) => {
        const x = i * WHITE_KEY_W;
        const hand = active.get(p);
        const isNext = next.has(p) && !hand;
        const isRh = hand === "R";
        const isLh = hand === "L";
        return (
          <g key={p}>
            <rect
              x={x + 0.8}
              y={y}
              width={WHITE_KEY_W - 1.6}
              height={WHITE_KEY_H}
              rx={3.5}
              fill={
                isRh
                  ? "color-mix(in oklab, var(--color-rh) 65%, var(--color-key-white))"
                  : isLh
                    ? "color-mix(in oklab, var(--color-lh) 65%, var(--color-key-white))"
                    : "var(--color-key-white)"
              }
              stroke={hand ? (isRh ? "var(--color-rh)" : "var(--color-lh)") : "var(--color-background)"}
              strokeWidth={hand ? 1.6 : 1}
            />
            {isNext && (
              <rect
                x={x + 4}
                y={y + 4}
                width={WHITE_KEY_W - 8}
                height={WHITE_KEY_H - 8}
                rx={2.5}
                fill="none"
                stroke="var(--color-muted-foreground)"
                strokeDasharray="4 3"
                opacity={0.75}
              />
            )}
            {(noteLetter(p) === "C" || hand) && (
              <text
                x={x + WHITE_KEY_W / 2}
                y={y + 20}
                textAnchor="middle"
                fill={hand ? (isRh ? "var(--color-rh-fg)" : "var(--color-lh-fg)") : "var(--color-background)"}
                opacity={hand ? 0.9 : 0.4}
                fontSize={10}
                fontWeight={hand ? 700 : 400}
                fontFamily="var(--font-sans)"
              >
                {pitchName(p)}
              </text>
            )}
          </g>
        );
      })}
      {blacks.map((p) => {
        const x = keyCenterX(p, range.start) - BLACK_KEY_W / 2;
        const hand = active.get(p);
        const isRh = hand === "R";
        const isLh = hand === "L";
        return (
          <rect
            key={p}
            x={x}
            y={y}
            width={BLACK_KEY_W}
            height={BLACK_KEY_H}
            rx={2.5}
            fill={
              isRh
                ? "color-mix(in oklab, var(--color-rh) 58%, var(--color-key-black))"
                : isLh
                  ? "color-mix(in oklab, var(--color-lh) 58%, var(--color-key-black))"
                  : "var(--color-key-black)"
            }
            stroke={hand ? (isRh ? "var(--color-rh)" : "var(--color-lh)") : "var(--color-background)"}
            strokeWidth={hand ? 1.4 : 0.6}
          />
        );
      })}
    </g>
  );
}

export function PianoStage({ frame, range }: { frame: LessonFrame; range: KeyRange }) {
  const width = Math.max(keyboardWidth(range.start, range.end), 320);
  const scroller = useRef<HTMLDivElement>(null);
  const rhGhost = frame.right.preparing && frame.right.nextPalmX != null;
  const lhGhost = frame.left.preparing && frame.left.nextPalmX != null;

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const focus = (frame.right.palmX + frame.left.palmX) / 2;
    const next = Math.max(0, focus - el.clientWidth / 2);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ left: next, behavior: reduce ? "auto" : "smooth" });
  }, [frame.right.palmX, frame.left.palmX]);

  return (
    <div className="relative flex h-full max-w-full flex-col overflow-hidden rounded-xl border border-border bg-card">
      <div className="pointer-events-none absolute top-3 left-4 z-10 text-[11px] tracking-wide text-muted-foreground">
        연주자 시점 · 양손이 건반 아래쪽에서 올라갑니다
      </div>
      <div className="pointer-events-none absolute bottom-3 left-4 z-10 text-[11px] tracking-wide text-lh">
        왼손 {frame.left.active ? "연주" : frame.left.preparing ? "다음 자리 준비" : "대기"}
      </div>
      <div className="pointer-events-none absolute right-4 bottom-3 z-10 text-[11px] tracking-wide text-rh">
        오른손 {frame.right.active ? "연주" : frame.right.preparing ? "다음 자리 준비" : "대기"}
      </div>
      <div ref={scroller} className="flex min-h-0 max-w-full flex-1 items-center justify-center overflow-x-auto overscroll-x-contain">
        <svg
          viewBox={`0 0 ${width} ${STAGE_H}`}
          className="mx-auto block h-[240px] w-full max-w-full lg:h-[380px]"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="건반 아래쪽에서 올라오는 양손"
        >
          <rect width={width} height={STAGE_H} fill="var(--color-card)" />
          <Keyboard range={range} frame={frame} />
          {rhGhost && (
            <HandSvg
              pose={{ ...frame.right, palmX: frame.right.nextPalmX!, fingers: [], opacity: 0.5 }}
              range={range}
              ghost
            />
          )}
          {lhGhost && (
            <HandSvg
              pose={{ ...frame.left, palmX: frame.left.nextPalmX!, fingers: [], opacity: 0.5 }}
              range={range}
              ghost
            />
          )}
          <HandSvg pose={frame.right} range={range} />
          <HandSvg pose={frame.left} range={range} />
          {frame.right.preparing && frame.right.nextPalmX != null && (
            <PrepareArrow
              from={frame.right.palmX}
              to={frame.right.nextPalmX}
              y={STAGE_H - 42}
              color="var(--color-rh)"
            />
          )}
          {frame.left.preparing && frame.left.nextPalmX != null && (
            <PrepareArrow
              from={frame.left.palmX}
              to={frame.left.nextPalmX}
              y={STAGE_H - 22}
              color="var(--color-lh)"
            />
          )}
        </svg>
      </div>
    </div>
  );
}
