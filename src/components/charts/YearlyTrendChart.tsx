"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { YearlyAggregation } from "@/lib/types";
import { formatCompactNumber } from "@/lib/utils";
import { useTheme } from "@/components/theme/ThemeProvider";

interface Props {
  data: YearlyAggregation[];
  dataKey?: "total" | "num_contracts";
  label?: string;
  color?: string;
}

export default function YearlyTrendChart({
  data,
  dataKey = "total",
  label = "Import total",
  color = "#1e3a5f",
}: Props) {
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
  const currentYear = new Date().getFullYear();
  const chartData = data
    .filter((d) => parseInt(d.year, 10) <= currentYear)
    .map((d) => ({
      year: d.year,
      total: parseFloat(d.total),
      num_contracts: parseInt(d.num_contracts, 10),
    }));

  return (
    <ResponsiveContainer width="100%" height={380}>
      <BarChart
        data={chartData}
        margin={{ top: 20, right: 12, left: 12, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
        <XAxis dataKey="year" fontSize={12} tick={{ fill: axisTickColor }} />
        <YAxis
          tickFormatter={(v) => formatCompactNumber(v)}
          fontSize={12}
          tick={{ fill: axisTickColor }}
        />
        <Tooltip
          formatter={(value) => [formatCompactNumber(value as number), label]}
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
          dataKey={dataKey}
          fill={color}
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
