"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

const VB_W = 100;
const VB_H = 32;
const PAD_Y = 3; // keeps the stroke and end dot inside the viewBox

export interface SparklineProps {
  /** Series ordered oldest → newest. */
  data: number[];
  /** `down` = price fell (good for the buyer) and renders emerald. */
  tone?: "auto" | "up" | "down" | "neutral";
  className?: string;
  ariaLabel?: string;
}

const TONE_COLOR = {
  down: "#10B981",
  up: "#F87171",
  neutral: "#38BDF8",
} as const;

export function Sparkline({
  data,
  tone = "auto",
  className,
  ariaLabel,
}: SparklineProps) {
  const gradientId = useId();

  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min;

  const x = (i: number) => (i / (data.length - 1)) * VB_W;
  // Flat series sit on the centre line instead of dividing by zero.
  const y = (v: number) =>
    span === 0
      ? VB_H / 2
      : PAD_Y + (1 - (v - min) / span) * (VB_H - PAD_Y * 2);

  const points = data.map((v, i) => `${x(i).toFixed(2)},${y(v).toFixed(2)}`);
  const line = `M${points.join(" L")}`;
  const area = `${line} L${VB_W},${VB_H} L0,${VB_H} Z`;

  const direction =
    tone !== "auto"
      ? tone
      : data[data.length - 1] < data[0]
        ? "down"
        : data[data.length - 1] > data[0]
          ? "up"
          : "neutral";
  const color = TONE_COLOR[direction];

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      preserveAspectRatio="none"
      role={ariaLabel ? "img" : "presentation"}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
      className={cn("h-8 w-full overflow-visible", className)}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      <path d={area} fill={`url(#${gradientId})`} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {/* Current-price marker. A vertical tick rather than a dot: the viewBox
          is stretched horizontally, which would squash a circle into an ellipse. */}
      <line
        x1={VB_W}
        y1={y(data[data.length - 1])}
        x2={VB_W}
        y2={VB_H}
        stroke={color}
        strokeWidth="1.5"
        strokeOpacity="0.55"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
