"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { formatNumber, formatCompactNumber } from "@/lib/utils";
import { useTheme } from "@/components/theme/ThemeProvider";

interface Props {
  data: { name: string; value: number; amount: number }[];
}

function formatCompactCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)} k`;
  return `${Math.round(value)}`;
}

export default function ContractTypeChart({ data }: Props) {
  const [isMobile, setIsMobile] = useState(false);
  const [scaleMode, setScaleMode] = useState<"log" | "linear">("log");
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const axisTickColor = isDark ? "#9ca3af" : "#4b5563";
  const gridColor = isDark ? "#1f2937" : "#e5e7eb";
  const tooltipBg = isDark ? "rgba(15,23,42,0.97)" : "#ffffff";
  const tooltipBorder = isDark ? "#1f2937" : "#e5e7eb";
  const tooltipLabelColor = isDark ? "#9ca3af" : "#6b7280";
  const tooltipItemColor = isDark ? "#f9fafb" : "#111827";
  const hoverCursorFill = isDark
    ? "rgba(148, 163, 184, 0.22)"
    : "rgba(148, 163, 184, 0.15)";

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const chartData = useMemo(() => {
    const sorted = [...data].sort((a, b) => b.value - a.value);
    const totalContracts = sorted.reduce((sum, entry) => sum + entry.value, 0);
    const topCount = isMobile ? 6 : 8;
    const top = sorted.slice(0, topCount);
    const rest = sorted.slice(topCount);
    const maxChars = isMobile ? 18 : 28;

    const base = top.map((entry) => ({
      name:
        entry.name.length > maxChars
          ? `${entry.name.slice(0, maxChars)}…`
          : entry.name,
      fullName: entry.name,
      value: entry.value,
      amount: entry.amount,
      share: totalContracts > 0 ? (entry.value / totalContracts) * 100 : 0,
    }));

    if (!rest.length) return base;

    const others = rest.reduce(
      (acc, entry) => ({
        value: acc.value + entry.value,
        amount: acc.amount + entry.amount,
      }),
      { value: 0, amount: 0 }
    );

    return [
      ...base,
      {
        name: "Altres tipus",
        fullName: `Altres tipus (${rest.length})`,
        value: others.value,
        amount: others.amount,
        share: totalContracts > 0 ? (others.value / totalContracts) * 100 : 0,
      },
    ];
  }, [data, isMobile]);

  const maxValue = useMemo(
    () => chartData.reduce((acc, entry) => Math.max(acc, entry.value), 0),
    [chartData]
  );

  const xTicks = useMemo(() => {
    if (maxValue <= 0) return undefined;
    if (scaleMode === "linear") return undefined;
    const ticks: number[] = [];
    let tick = 1;
    while (tick < maxValue) {
      ticks.push(tick);
      tick *= 10;
    }
    ticks.push(maxValue);
    return ticks;
  }, [maxValue, scaleMode]);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-gray-500">Eix X: nombre de contractes</p>
        <div className="inline-flex rounded-md border border-gray-200 bg-gray-50 p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setScaleMode("linear")}
            className={`rounded px-2 py-1 transition-all duration-150 ${
              scaleMode === "linear" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600"
            }`}
          >
            Lineal
          </button>
          <button
            type="button"
            onClick={() => setScaleMode("log")}
            className={`rounded px-2 py-1 transition-all duration-150 ${
              scaleMode === "log" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600"
            }`}
          >
            Log
          </button>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={Math.max(320, chartData.length * 42)}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 5, right: 12, left: isMobile ? 0 : 12, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={gridColor} />
          <XAxis
            type="number"
            scale={scaleMode}
            domain={scaleMode === "log" ? [1, Math.max(maxValue, 1)] : [0, "auto"]}
            ticks={xTicks}
            tickFormatter={(value) => formatCompactCount(value)}
            fontSize={isMobile ? 10 : 12}
            tick={{ fill: axisTickColor }}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={isMobile ? 130 : 210}
            fontSize={isMobile ? 10 : 11}
            tick={{ fill: axisTickColor }}
          />
          <Tooltip
            formatter={(value, _name, props) => {
              const entry = props.payload;
              return [
                `${formatNumber(value as number)} contractes (${entry.share.toFixed(1)}%)`,
                entry.fullName,
              ];
            }}
            labelFormatter={(_label, payload) => {
              const entry = payload?.[0]?.payload;
              if (!entry) return _label;
              return `${entry.fullName} — ${formatCompactNumber(entry.amount)}`;
            }}
            contentStyle={{
              borderRadius: "8px",
              border: `1px solid ${tooltipBorder}`,
              boxShadow: isDark
                ? "0 18px 45px rgba(15,23,42,0.8)"
                : "0 4px 6px -1px rgb(0 0 0 / 0.07)",
              backgroundColor: tooltipBg,
              color: tooltipItemColor,
            }}
            labelStyle={{ color: tooltipLabelColor, fontSize: 12 }}
            itemStyle={{ color: tooltipItemColor, fontSize: 13 }}
            cursor={{ fill: hoverCursorFill }}
          />
          <Bar
            dataKey="value"
            fill="#1e3a5f"
            radius={[0, 4, 4, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
