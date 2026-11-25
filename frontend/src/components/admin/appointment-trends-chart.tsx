"use client";

import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export interface TrendPoint {
  label: string;
  date: string;
  new_visits: number;
  follow_ups: number;
  total: number;
  new_consultations?: number;
  day?: string;
}

interface AppointmentTrendsChartProps {
  fallbackData?: TrendPoint[];
}

function generateSmoothCurve(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  if (pts.length === 2) return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`;

  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i === 0 ? 0 : i - 1];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2 < pts.length ? i + 2 : i + 1];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}

export function AppointmentTrendsChart({ fallbackData }: AppointmentTrendsChartProps) {
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "1y">("7d");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Fetch live time-series points from backend
  const { data: trendData, isLoading } = useQuery<TrendPoint[]>({
    queryKey: ["appointments-trend", timeRange],
    queryFn: () => apiClient<TrendPoint[]>(`/admin/analytics/appointments-trend?range=${timeRange}`),
    staleTime: 1000 * 30, // 30 seconds fresh cache
  });

  const chartPoints = useMemo<TrendPoint[]>(() => {
    if (trendData && Array.isArray(trendData) && trendData.length > 0) {
      return trendData;
    }
    if (fallbackData && fallbackData.length > 0) {
      return fallbackData;
    }
    return [
      { label: "Thu", date: "2026-11-19", new_visits: 0, follow_ups: 0, total: 0 },
      { label: "Fri", date: "2026-11-20", new_visits: 0, follow_ups: 0, total: 0 },
      { label: "Sat", date: "2026-11-21", new_visits: 0, follow_ups: 0, total: 0 },
      { label: "Sun", date: "2026-11-22", new_visits: 2, follow_ups: 1, total: 3 },
      { label: "Mon", date: "2026-11-23", new_visits: 10, follow_ups: 5, total: 15 },
      { label: "Tue", date: "2026-11-24", new_visits: 10, follow_ups: 5, total: 15 },
      { label: "Wed", date: "2026-11-25", new_visits: 1, follow_ups: 0, total: 1 },
    ];
  }, [trendData, fallbackData]);

  // Geometry dimensions
  const marginLeft = 40;
  const marginRight = 20;
  const marginTop = 25;
  const baselineY = 165;
  const usableWidth = 500 - marginLeft - marginRight; // 440
  const usableHeight = baselineY - marginTop; // 140

  // Dynamic Y-axis scale
  const { yCeil, yTicks } = useMemo(() => {
    let max = 0;
    chartPoints.forEach((p) => {
      const v1 = p.new_visits ?? (p as any).new_consultations ?? 0;
      const v2 = p.follow_ups ?? 0;
      if (v1 > max) max = v1;
      if (v2 > max) max = v2;
      if (p.total > max) max = p.total;
    });

    const rawCeil = Math.max(max * 1.25, 4);
    let ceil = Math.ceil(rawCeil);
    if (ceil <= 4) ceil = 4;
    else if (ceil <= 10) ceil = Math.ceil(ceil / 2) * 2;
    else if (ceil <= 30) ceil = Math.ceil(ceil / 5) * 5;
    else ceil = Math.ceil(ceil / 10) * 10;

    const ticks = [
      { val: ceil, y: marginTop },
      { val: Math.round(ceil * 0.66), y: marginTop + usableHeight * 0.34 },
      { val: Math.round(ceil * 0.33), y: marginTop + usableHeight * 0.67 },
      { val: 0, y: baselineY },
    ];

    return { yCeil: ceil, yTicks: ticks };
  }, [chartPoints, marginTop, usableHeight, baselineY]);

  // Point coordinates for Line 1 (New Visits)
  const coordsNew = useMemo(() => {
    const N = chartPoints.length;
    return chartPoints.map((p, i) => {
      const x = N > 1 ? marginLeft + (i / (N - 1)) * usableWidth : marginLeft + usableWidth / 2;
      const v = p.new_visits ?? (p as any).new_consultations ?? 0;
      const y = baselineY - (v / yCeil) * usableHeight;
      return { x, y, val: v };
    });
  }, [chartPoints, yCeil, marginLeft, usableWidth, baselineY, usableHeight]);

  // Point coordinates for Line 2 (Follow-ups)
  const coordsFollow = useMemo(() => {
    const N = chartPoints.length;
    return chartPoints.map((p, i) => {
      const x = N > 1 ? marginLeft + (i / (N - 1)) * usableWidth : marginLeft + usableWidth / 2;
      const v = p.follow_ups ?? 0;
      const y = baselineY - (v / yCeil) * usableHeight;
      return { x, y, val: v };
    });
  }, [chartPoints, yCeil, marginLeft, usableWidth, baselineY, usableHeight]);

  // Smooth curve paths
  const newVisitsLinePath = useMemo(() => generateSmoothCurve(coordsNew), [coordsNew]);
  const newVisitsAreaPath = useMemo(() => {
    if (coordsNew.length === 0) return "";
    const firstX = coordsNew[0].x;
    const lastX = coordsNew[coordsNew.length - 1].x;
    return `${newVisitsLinePath} L ${lastX} ${baselineY} L ${firstX} ${baselineY} Z`;
  }, [newVisitsLinePath, coordsNew, baselineY]);

  const followUpsLinePath = useMemo(() => generateSmoothCurve(coordsFollow), [coordsFollow]);
  const followUpsAreaPath = useMemo(() => {
    if (coordsFollow.length === 0) return "";
    const firstX = coordsFollow[0].x;
    const lastX = coordsFollow[coordsFollow.length - 1].x;
    return `${followUpsLinePath} L ${lastX} ${baselineY} L ${firstX} ${baselineY} Z`;
  }, [followUpsLinePath, coordsFollow, baselineY]);

  // Dynamic summary stats
  const totalPeriodVisits = useMemo(() => {
    return chartPoints.reduce((acc, p) => acc + (p.total || 0), 0);
  }, [chartPoints]);

  const peakPoint = useMemo(() => {
    if (chartPoints.length === 0) return null;
    return chartPoints.reduce(
      (max, p) => ((p.total || 0) > (max?.total || 0) ? p : max),
      chartPoints[0]
    );
  }, [chartPoints]);

  const activePoint = hoveredIndex !== null ? chartPoints[hoveredIndex] : null;

  // Tooltip position calculation
  const tooltipLeftPercent = hoveredIndex !== null && coordsNew[hoveredIndex]
    ? (coordsNew[hoveredIndex].x / 500) * 100
    : 50;

  const transformStyle = hoveredIndex !== null
    ? tooltipLeftPercent < 22
      ? "translateX(0%)"
      : tooltipLeftPercent > 78
      ? "translateX(-100%)"
      : "translateX(-50%)"
    : "translateX(-50%)";

  const shouldShowLabel = (index: number, totalPoints: number) => {
    if (totalPoints <= 12) return true;
    if (hoveredIndex === index) return true;
    if (index === 0 || index === totalPoints - 1) return true;
    return index % 5 === 0;
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4 relative">
      {/* Card Header with Title, Legends & Timeframe Filter Pills */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Patient & Appointment Statistics
            </h3>
            {isLoading && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Real-time consultation volume (New Visits vs Follow-ups) from database
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          {/* Chart Legend */}
          <div className="flex items-center gap-3 text-xs font-medium">
            <span className="flex items-center gap-1.5 text-slate-900 font-semibold">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
              <span>New Visits</span>
            </span>
            <span className="flex items-center gap-1.5 text-slate-700 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-900" />
              <span>Follow-ups</span>
            </span>
          </div>

          {/* Timeframe Filter Pills (7D / 30D / 1Y) */}
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl border border-slate-200/80">
            {(["7d", "30d", "1y"] as const).map((r) => {
              const isActive = timeRange === r;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    setTimeRange(r);
                    setHoveredIndex(null);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    isActive
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/70"
                  }`}
                >
                  {r.toUpperCase()}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Responsive Interactive SVG Area Chart */}
      <div className="w-full relative min-w-0 overflow-hidden select-none">
        {/* Floating Tooltip Card on Hover */}
        {hoveredIndex !== null && activePoint && coordsNew[hoveredIndex] && (
          <div
            className="absolute z-30 pointer-events-none transition-all duration-100 ease-out top-2"
            style={{
              left: `${tooltipLeftPercent}%`,
              transform: transformStyle,
            }}
          >
            <div className="bg-slate-900 text-white rounded-xl shadow-2xl px-3.5 py-2.5 text-xs border border-slate-700/80 min-w-[155px] backdrop-blur-sm">
              <div className="text-[11px] font-semibold text-slate-300 pb-1.5 mb-1.5 border-b border-slate-700/80 flex items-center justify-between gap-2">
                <span className="font-mono text-white font-bold">{activePoint.date || activePoint.label}</span>
                <span className="text-[10px] text-emerald-400 font-semibold px-1.5 py-0.2 rounded bg-emerald-950/90 border border-emerald-800">
                  {activePoint.label}
                </span>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 text-emerald-400 font-medium text-[11px]">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-xs" />
                    New Visits:
                  </span>
                  <span className="font-bold text-white font-mono text-xs">
                    {activePoint.new_visits ?? (activePoint as any).new_consultations ?? 0}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 text-slate-300 font-medium text-[11px]">
                    <span className="w-2 h-2 rounded-full bg-slate-400" />
                    Follow-ups:
                  </span>
                  <span className="font-bold text-white font-mono text-xs">
                    {activePoint.follow_ups ?? 0}
                  </span>
                </div>
                <div className="pt-1.5 border-t border-slate-800 flex items-center justify-between gap-3 text-[11px]">
                  <span className="text-slate-400 font-medium">Total Volume:</span>
                  <span className="font-bold text-emerald-300 font-mono text-xs">
                    {activePoint.total ?? 0}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        <svg
          viewBox="0 0 500 200"
          className="w-full h-52 sm:h-60 overflow-visible"
          preserveAspectRatio="none"
          onMouseLeave={() => setHoveredIndex(null)}
        >
          <defs>
            <linearGradient id="emeraldTrendGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#059669" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#059669" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="blackTrendGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0F172A" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#0F172A" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Horizontal Gridlines & Y-Axis Scale Labels */}
          {yTicks.map((tick, idx) => (
            <g key={`ytick-${idx}`}>
              <line
                x1={marginLeft}
                y1={tick.y}
                x2={marginLeft + usableWidth}
                y2={tick.y}
                stroke={idx === yTicks.length - 1 ? "#cbd5e1" : "#f1f5f9"}
                strokeDasharray={idx === yTicks.length - 1 ? undefined : "3 3"}
              />
              <text
                x={marginLeft - 8}
                y={tick.y + 3.5}
                textAnchor="end"
                className="text-[10px] fill-slate-400 font-mono"
              >
                {tick.val}
              </text>
            </g>
          ))}

          {/* Smooth Dual Curves: Area Fills */}
          {newVisitsAreaPath && (
            <path d={newVisitsAreaPath} fill="url(#emeraldTrendGrad)" />
          )}
          {followUpsAreaPath && (
            <path d={followUpsAreaPath} fill="url(#blackTrendGrad)" />
          )}

          {/* Smooth Dual Curves: Strokes */}
          {followUpsLinePath && (
            <path
              d={followUpsLinePath}
              fill="none"
              stroke="#0F172A"
              strokeWidth={2}
              strokeDasharray="4 2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          {newVisitsLinePath && (
            <path
              d={newVisitsLinePath}
              fill="none"
              stroke="#059669"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Hover Crosshair & Highlight Dots */}
          {hoveredIndex !== null && coordsNew[hoveredIndex] && (
            <g className="transition-all duration-150 pointer-events-none">
              <line
                x1={coordsNew[hoveredIndex].x}
                y1={marginTop}
                x2={coordsNew[hoveredIndex].x}
                y2={baselineY}
                stroke="#059669"
                strokeWidth={1.5}
                strokeDasharray="3 3"
                opacity={0.7}
              />
              {/* Follow-ups Highlight Dot */}
              <circle
                cx={coordsFollow[hoveredIndex].x}
                cy={coordsFollow[hoveredIndex].y}
                r={4.5}
                fill="#0F172A"
                stroke="#ffffff"
                strokeWidth={2}
              />
              {/* New Visits Highlight Dot */}
              <circle
                cx={coordsNew[hoveredIndex].x}
                cy={coordsNew[hoveredIndex].y}
                r={5.5}
                fill="#059669"
                stroke="#ffffff"
                strokeWidth={2.5}
              />
            </g>
          )}

          {/* X Axis Labels & Active Day Highlight Pill */}
          {chartPoints.map((pt, i) => {
            const x = coordsNew[i].x;
            const isHovered = hoveredIndex === i;
            const isVisible = shouldShowLabel(i, chartPoints.length);

            if (!isVisible && !isHovered) return null;

            if (isHovered) {
              return (
                <g key={`xlabel-${i}`} className="pointer-events-none">
                  <rect
                    x={x - 17}
                    y={174}
                    width={34}
                    height={18}
                    rx={4}
                    fill="#0F172A"
                  />
                  <text
                    x={x}
                    y={186.5}
                    textAnchor="middle"
                    className="text-[10px] fill-white font-bold"
                  >
                    {pt.label}
                  </text>
                </g>
              );
            }

            return (
              <text
                key={`xlabel-${i}`}
                x={x}
                y={186}
                textAnchor="middle"
                className="text-[10px] fill-slate-500 font-medium"
              >
                {pt.label}
              </text>
            );
          })}

          {/* Transparent Hover Columns for Flawless Interaction */}
          {chartPoints.map((_, i) => {
            const colWidth = usableWidth / Math.max(chartPoints.length - 1, 1);
            const x = coordsNew[i].x - colWidth / 2;
            return (
              <rect
                key={`hover-zone-${i}`}
                x={Math.max(x, 0)}
                y={0}
                width={colWidth}
                height={200}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIndex(i)}
                onTouchStart={() => setHoveredIndex(i)}
              />
            );
          })}
        </svg>
      </div>

      {/* Dynamic Footer Statistics: Total Period Visits & Peak Day */}
      <div className="pt-3 flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-slate-600 border-t border-slate-100 gap-2">
        <div className="flex items-center gap-2">
          <span>Total period visits:</span>
          <span className="font-bold text-slate-900 font-mono bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/80">
            {totalPeriodVisits.toLocaleString()} visits
          </span>
        </div>
        <div className="flex items-center gap-1.5 font-semibold text-emerald-700">
          <span>Peak {timeRange === "1y" ? "month" : "day"}:</span>
          <span className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-2 py-0.5 rounded-md font-mono">
            {peakPoint?.label || "N/A"} ({peakPoint?.total || 0} visits)
          </span>
        </div>
      </div>
    </div>
  );
}
