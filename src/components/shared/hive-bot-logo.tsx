"use client";

import { useId } from "react";

type Props = {
  size?: number;
  className?: string;
  /** Static by default. When loading=true (AI answering), runs the draw-in
   *  animation to signal "thinking". */
  loading?: boolean;
  /** "solid" = gold hex on navy container (FAB + header + bubbles).
   *  "soft"   = navy hex on light/gold-tint container. */
  variant?: "solid" | "soft";
  title?: string;
};

/**
 * HiveBotLogo — WorkHive's AI assistant mark.
 *
 * FORM (exact path from the uploaded `workhive-mark-light.svg`):
 *  A pointy-top OPEN hexagon — regular hexagon, circumradius 144, centred at
 *  (256,256) in a 512 viewBox, stroke-width 44, rounded caps + joins. The gap
 *  is a segment of the TOP-RIGHT edge (from ~26% to ~74% of that edge), so
 *  the stroke runs: top-right-edge(partial) → right → bottom-right →
 *  bottom-left → left → top-left → top → top-right-edge(partial), stopping
 *  with the gap centred on the top-right diagonal.
 *
 *  Original path (kept verbatim):
 *  M347.8 165 L380.7 184 L380.7 328 L256 400 L131.3 328 L131.3 184 L256 112 L288.9 131
 *
 * PALETTE (website colours, not the original #D97757 orange):
 *  • solid → WorkHive gold gradient (oklch 0.86→0.62 hue 84→72). Light stop
 *    is deep enough to hold its own on white pages — the mark no longer sits
 *    on a navy disc.
 *  • soft  → WorkHive navy gradient (oklch 0.50→0.24 hue 264)
 *
 * VIEWBOX:
 *  "88 88 336 336" — tight square crop centred on (256,256): stroke bounds are
 *  x 109.3–402.7 / y 90–422, so the mark fills the box with a 2-unit guard.
 *  No dead padding → whatever flex/grid centres the SVG box centres the MARK.
 *
 * ANIMATION:
 *  • Idle (loading=false): completely static — the mark just sits there.
 *  • Loading (loading=true, AI answering): the path draw-in loop runs
 *    (stroke-dashoffset 100→0→hold→fade→100, 2.4s) — the "thinking" signal.
 *  Keyframes ship inline (Tailwind 4 tree-shakes custom @keyframes in
 *  globals.css when their referencing class is dynamic).
 */
export function HiveBotLogo({
  size = 40,
  className,
  loading = false,
  variant = "solid",
  title = "HiveBot AI",
}: Props) {
  const isSolid = variant === "solid";
  const gid = `hb-${variant}-${useId()}`;

  // Exact path from workhive-mark-light.svg (unchanged).
  const openHexPath =
    "M347.8 165 L380.7 184 L380.7 328 L256 400 L131.3 328 L131.3 184 L256 112 L288.9 131";

  return (
    <span
      className={className}
      style={{
        position: "relative",
        display: "inline-block",
        width: size,
        height: size,
      }}
      role="img"
      aria-label={title}
    >
      <span className="sr-only">{title}</span>

      {/* Inline <style> — Tailwind 4 tree-shakes custom @keyframes in
          globals.css when their referencing class is dynamic, so we ship the
          keyframes here to guarantee they reach the browser. */}
      <style>{`
        @keyframes hb-draw-${variant} {
          0%   { stroke-dashoffset: 100; opacity: 0.35; }
          45%  { stroke-dashoffset: 0;   opacity: 1; }
          82%  { stroke-dashoffset: 0;   opacity: 1; }
          92%  { stroke-dashoffset: 0;   opacity: 0.5; }
          100% { stroke-dashoffset: 100; opacity: 0.35; }
        }
      `}</style>

      <svg
        width={size}
        height={size}
        viewBox="88 88 336 336"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: "block" }}
      >
        <title>{title}</title>
        <defs>
          {/* Gold gradient (solid) / navy gradient (soft) — WorkHive palette.
              userSpaceOnUse coords follow the hexagon's own diagonal. */}
          <linearGradient id={`${gid}-grad`} x1="131" y1="112" x2="381" y2="400" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={isSolid ? "oklch(0.86 0.15 84)" : "oklch(0.50 0.15 264)"} />
            <stop offset="100%" stopColor={isSolid ? "oklch(0.62 0.17 72)" : "oklch(0.24 0.10 264)"} />
          </linearGradient>
        </defs>

        {/* The open hexagon — exact uploaded geometry, recoloured.
            pathLength=100 normalises dash math for the draw-in loop.
            Idle: fully drawn, static. Loading: draw-in loop. */}
        <path
          d={openHexPath}
          pathLength={100}
          stroke={`url(#${gid}-grad)`}
          strokeWidth="44"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            strokeDasharray: 100,
            strokeDashoffset: loading ? 100 : 0,
            animation: loading
              ? `hb-draw-${variant} 2.4s ease-in-out infinite`
              : undefined,
          }}
        />
      </svg>
    </span>
  );
}
