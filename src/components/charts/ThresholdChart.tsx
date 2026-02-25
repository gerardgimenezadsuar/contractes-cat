"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
  Cell,
} from "recharts";
import type { ThresholdBucket } from "@/lib/types";
import { formatNumber } from "@/lib/utils";
import { useTheme } from "@/components/theme/ThemeProvider";

interface Props {
  data: ThresholdBucket[];
}

export default function ThresholdChart({ data }: Props) {
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

  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart
        data={data}
        margin={{ top: 5, right: 30, left: 20, bottom: 32 }}
      >
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
        <XAxis
          dataKey="label"
          fontSize={12}
          angle={-32}
          textAnchor="end"
          height={72}
          interval={2}
          tickMargin={8}
          tickFormatter={(label) => String(label).split("-")[0]}
          tick={{ fill: axisTickColor }}
        />
        <YAxis
          tickFormatter={(v) => formatNumber(v)}
          fontSize={12}
          tick={{ fill: axisTickColor }}
        />
        <Tooltip
          formatter={(value) => [formatNumber(value as number), "Contractes"]}
          labelFormatter={(label) => `Rang: ${label} EUR (sense IVA)`}
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
        <ReferenceLine
          x="14.5k-15.0k"
          stroke="#dc2626"
          strokeDasharray="3 3"
          label={{ value: "Tram final <15k", position: "top", fill: "#dc2626", fontSize: 11 }}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {data.map((entry) => (
            <Cell
              key={`${entry.range_start}-${entry.range_end}`}
              fill={entry.range_start >= 14500 ? "#dc2626" : "#1e3a5f"}
              fillOpacity={entry.range_start >= 14500 ? 1 : 0.8}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
