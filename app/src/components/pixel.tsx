import type { ReactNode } from "react";
import { dissolveRows } from "./bitmaps";
/**
 * Pixel art drawn as SVG squares from small text bitmaps, so it stays crisp at
 * any size and needs no image files. Each character is one pixel; "." is empty.
 */

const palette: Record<string, string> = {
  k: "var(--color-on-lime)",
  l: "var(--color-lime)",
  d: "var(--color-lime-deep)",
  v: "var(--color-violet)",
  p: "var(--color-violet-ink)",
  y: "var(--color-amber)",
  w: "var(--color-ink)",
  g: "var(--color-line)",
};

export function Pixels({ rows, className = "", title }: { rows: string[]; className?: string; title?: string }) {
  const width = Math.max(...rows.map((r) => r.length));
  const rects: ReactNode[] = [];
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      const fill = palette[ch];
      if (fill) rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} fill={fill} />);
    }),
  );
  return (
    <svg
      viewBox={`0 0 ${width} ${rows.length}`}
      className={`pixel ${className}`}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {rects}
    </svg>
  );
}

/**
 * The scattered-pixel ground from the reference, generated so it is the same
 * on every load: dense at the bottom, thinning out towards the top.
 */
export function Dissolve({ width = 64, height = 14, className = "" }: { width?: number; height?: number; className?: string }) {
  return <Pixels rows={dissolveRows(width, height)} className={className} />;
}
