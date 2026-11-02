"use client";

import React, { useId } from "react";

interface MiniSparklineProps {
  data: number[];
  color?: string;
  height?: number;
  width?: number;
  className?: string;
}

export function MiniSparkline({
  data = [],
  color = "#3984FF",
  height = 32,
  width = 96,
  className = "",
}: MiniSparklineProps) {
  const gradientId = useId();

  // Se não houver dados ou menos de 2 pontos
  const values = data && data.length > 0 ? data : [0, 0];
  const pointsCount = values.length;

  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;

  const svgWidth = 100;
  const svgHeight = 36;
  const paddingY = 4;
  const usableHeight = svgHeight - paddingY * 2;

  // Se todos os pontos forem iguais (ou zero), desenha linha sutil no meio
  const isFlat = minVal === maxVal;

  const coords = values.map((val, idx) => {
    const x = (idx / Math.max(pointsCount - 1, 1)) * svgWidth;
    const y = isFlat
      ? svgHeight / 2
      : svgHeight - paddingY - ((val - minVal) / range) * usableHeight;
    return { x, y };
  });

  // Gera path suave usando bezier
  let pathD = "";
  if (coords.length > 0) {
    pathD = `M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)}`;
    for (let i = 1; i < coords.length; i++) {
      const prev = coords[i - 1];
      const curr = coords[i];
      const midX = (prev.x + curr.x) / 2;
      pathD += ` C ${midX.toFixed(1)} ${prev.y.toFixed(1)}, ${midX.toFixed(1)} ${curr.y.toFixed(1)}, ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`;
    }
  }

  // Path fechado para o degradê de preenchimento
  const areaD = coords.length > 0
    ? `${pathD} L ${coords[coords.length - 1].x.toFixed(1)} ${svgHeight} L ${coords[0].x.toFixed(1)} ${svgHeight} Z`
    : "";

  return (
    <div
      style={{ width: `${width}px`, height: `${height}px` }}
      className={`shrink-0 overflow-hidden select-none pointer-events-none ${className}`}
      aria-hidden="true"
    >
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="w-full h-full overflow-visible"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.28} />
            <stop offset="100%" stopColor={color} stopOpacity={0.0} />
          </linearGradient>
        </defs>

        {/* Área preenchida com degradê suave */}
        {areaD && !isFlat && (
          <path d={areaD} fill={`url(#${gradientId})`} />
        )}

        {/* Linha principal da sparkline */}
        {pathD && (
          <path
            d={pathD}
            fill="none"
            stroke={color}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={isFlat ? "3 3" : undefined}
            opacity={isFlat ? 0.4 : 1}
          />
        )}
      </svg>
    </div>
  );
}

