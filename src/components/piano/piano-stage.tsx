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

function organicFingerPath(
  bx: number,
  by: number,
  mx: number,
  my: number,
  tx: number,
  ty: number,
  wBase: number,
  wMid: number,
  wTip: number,
): string {
  // Vector base -> mid
  const d1x = mx - bx;
  const d1y = my - by;
  const len1 = Math.hypot(d1x, d1y) || 1;
  const n1x = -d1y / len1;
  const n1y = d1x / len1;

  // Vector mid -> tip
  const d2x = tx - mx;
  const d2y = ty - my;
  const len2 = Math.hypot(d2x, d2y) || 1;
  const n2x = -d2y / len2;
  const n2y = d2x / len2;

  // Normal blend at knuckle & mid joint
  const p1L = { x: bx + n1x * (wBase * 0.9), y: by + n1y * (wBase * 0.9) };
  const p1R = { x: bx - n1x * (wBase * 0.9), y: by - n1y * (wBase * 0.9) };

  const p2L = { x: mx + ((n1x + n2x) / 2) * (wMid * 0.95), y: my + ((n1y + n2y) / 2) * (wMid * 0.95) };
  const p2R = { x: mx - ((n1x + n2x) / 2) * (wMid * 0.95), y: my - ((n1y + n2y) / 2) * (wMid * 0.95) };

  const p3L = { x: tx + n2x * wTip, y: ty + n2y * wTip };
  const p3R = { x: tx - n2x * wTip, y: ty - n2y * wTip };

  // Smooth connected contour around the whole finger
  return [
    `M ${p1L.x} ${p1L.y}`,
    `Q ${p2L.x} ${p2L.y} ${p3L.x} ${p3L.y}`,
    `A ${wTip} ${wTip * 1.1} 0 0 1 ${p3R.x} ${p3R.y}`,
    `Q ${p2R.x} ${p2R.y} ${p1R.x} ${p1R.y}`,
    `Z`,
  ].join(" ");
}

const FINGER_WIDTH: Record<Finger, [number, number, number]> = {
  1: [12.5, 10.8, 9.2],
  2: [10.2, 8.6, 7.6],
  3: [10.8, 9.1, 7.8],
  4: [9.8, 8.2, 7.2],
  5: [8.5, 7.2, 6.4],
};

const KNUC_UP: Record<Finger, number> = { 1: 14, 2: 26, 3: 31, 4: 26, 5: 20 };

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
  const palmY = keyBottom + (hand === "R" ? 104 : 126) + wristBounce;
  const palmX = pose.palmX;
  const accent = hand === "R" ? "var(--color-rh)" : "var(--color-lh)";
  const stroke = ghost ? accent : "color-mix(in oklab, var(--color-skin-line) 85%, transparent)";
  const strokeDash = ghost ? "6 5" : undefined;
  const opacity = ghost ? 0.5 : pose.opacity;

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

  // Knuckle offsets relative to palm center
  const KNUCKLE_REST_DX: Record<Finger, number> = hand === "R"
    ? { 1: -33, 2: -15, 3: 2, 4: 19, 5: 33 }
    : { 1: 33, 2: 15, 3: -2, 4: -19, 5: -33 };

  const bases = tips.map((tip) => {
    const defaultKnuckleX = palmX + KNUCKLE_REST_DX[tip.f];
    const pull = Math.max(-10, Math.min(10, (tip.x - defaultKnuckleX) * 0.22));
    const inward = hand === "R" ? 1 : -1;
    const thumbBonus = tip.f === 1 ? inward * 4 : 0;
    return {
      f: tip.f,
      x: defaultKnuckleX + pull + thumbBonus,
      y: palmY - KNUC_UP[tip.f],
    };
  });

  // Organic Palm & Wrist Contour
  const bThumb = bases.find((b) => b.f === 1)!;
  const bIndex = bases.find((b) => b.f === 2)!;
  const bMiddle = bases.find((b) => b.f === 3)!;
  const bPinky = bases.find((b) => b.f === 5)!;

  const palmLeft = hand === "R" ? bThumb.x - 14 : bPinky.x - 10;
  const palmRight = hand === "R" ? bPinky.x + 10 : bThumb.x + 14;
  const wristY = palmY + 48;
  const wristL = palmX - 22;
  const wristR = palmX + 22;

  // Natural hand dorsal skin path (wrist -> thumb mount -> knuckle arch -> pinky edge -> wrist)
  const palmPath = hand === "R"
    ? [
        `M ${wristL} ${wristY}`,
        `C ${wristL - 8} ${palmY + 24} ${palmLeft} ${palmY + 12} ${bThumb.x - 8} ${bThumb.y + 6}`,
        `Q ${bIndex.x - 8} ${bIndex.y + 4} ${bIndex.x} ${bIndex.y}`,
        `Q ${bMiddle.x} ${bMiddle.y - 3} ${bPinky.x} ${bPinky.y}`,
        `C ${palmRight + 6} ${bPinky.y + 12} ${palmRight + 4} ${palmY + 26} ${wristR} ${wristY}`,
        `Z`,
      ].join(" ")
    : [
        `M ${wristR} ${wristY}`,
        `C ${wristR + 8} ${palmY + 24} ${palmRight} ${palmY + 12} ${bThumb.x + 8} ${bThumb.y + 6}`,
        `Q ${bIndex.x + 8} ${bIndex.y + 4} ${bIndex.x} ${bIndex.y}`,
        `Q ${bMiddle.x} ${bMiddle.y - 3} ${bPinky.x} ${bPinky.y}`,
        `C ${palmLeft - 6} ${bPinky.y + 12} ${palmLeft - 4} ${palmY + 26} ${wristL} ${wristY}`,
        `Z`,
      ].join(" ");

  const skinFill = ghost
    ? "transparent"
    : hand === "R"
      ? "url(#rh-skin-grad)"
      : "url(#lh-skin-grad)";

  return (
    <g opacity={opacity} style={{ transition: "opacity 180ms ease" }}>
      {/* Palm and Wrist */}
      <path
        d={palmPath}
        fill={skinFill}
        stroke={stroke}
        strokeWidth={ghost ? 1.6 : 1.2}
        strokeDasharray={strokeDash}
        style={{ filter: ghost ? "none" : "drop-shadow(0 4px 12px rgba(0,0,0,0.14))" }}
      />

      {/* Subtle Knuckle Highlights */}
      {!ghost && (
        <path
          d={`M ${bIndex.x} ${bIndex.y + 2} Q ${bMiddle.x} ${bMiddle.y} ${bPinky.x} ${bPinky.y + 2}`}
          fill="none"
          stroke={accent}
          strokeWidth={1.2}
          strokeDasharray="2 6"
          opacity={0.35}
        />
      )}

      {/* Fingers */}
      {tips.map((tip) => {
        const base = bases.find((b) => b.f === tip.f)!;
        const [wBase, wMid, wTip] = FINGER_WIDTH[tip.f];
        const thumbBend = tip.f === 1 ? (hand === "R" ? -14 : 14) : 0;
        const midX = (base.x + tip.x) / 2 + thumbBend;
        const midY = (base.y + tip.y) / 2 + (tip.f === 1 ? 5 : 0);
        const pressing = tip.press === 1;

        const fingerPath = organicFingerPath(
          base.x,
          base.y,
          midX,
          midY,
          tip.x,
          tip.y,
          wBase,
          wMid,
          wTip,
        );

        return (
          <g key={`${ghost ? "g" : "h"}-${hand}-${tip.f}`}>
            {/* Finger Body */}
            <path
              d={fingerPath}
              fill={pressing && !ghost ? accent : skinFill}
              stroke={stroke}
              strokeWidth={ghost ? 1.5 : 1.15}
              strokeDasharray={strokeDash}
              style={{
                transition: "fill 90ms ease, d 50ms linear",
                filter: pressing && !ghost ? "drop-shadow(0 2px 8px rgba(0,0,0,0.22))" : "none",
              }}
            />

            {/* Knuckle Crease Line */}
            {!ghost && (
              <line
                x1={midX - (hand === "R" ? 4 : -4)}
                y1={midY - 2}
                x2={midX + (hand === "R" ? 4 : -4)}
                y2={midY + 2}
                stroke={pressing ? "rgba(255,255,255,0.4)" : "color-mix(in oklab, var(--color-skin-line) 60%, transparent)"}
                strokeWidth={1}
                strokeLinecap="round"
              />
            )}

            {/* Finger Tip and Pressing Effects */}
            {!ghost && (
              <>
                {/* Strike Ripple Impact Ring */}
                {pressing && tip.impact > 0.04 && (
                  <circle
                    cx={tip.x}
                    cy={tip.y}
                    r={12 + (1 - tip.impact) * 14}
                    fill="none"
                    stroke={accent}
                    strokeWidth={2.2 * tip.impact}
                    opacity={tip.impact * 0.9}
                  />
                )}

                {/* Fingertip Badge */}
                <circle
                  cx={tip.x}
                  cy={tip.y}
                  r={pressing ? 11 + tip.impact * 2.8 : 8.8}
                  fill={pressing ? accent : "var(--color-card)"}
                  stroke={accent}
                  strokeWidth={pressing ? 2 : 1.4}
                  style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.18))" }}
                />

                {/* Finger Number Label */}
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

            {/* Ghost Target Marker */}
            {ghost && (
              <circle
                cx={tip.x}
                cy={tip.y}
                r={6}
                fill="none"
                stroke={accent}
                strokeDasharray="3 2"
                strokeWidth={1.3}
              />
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
      <div className="pointer-events-none absolute top-3 left-4 z-10 text-[11px] tracking-wide text-muted-foreground font-semibold">
        ✨ 88건반 전체 피아노 · 연주자 2D 시점
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
