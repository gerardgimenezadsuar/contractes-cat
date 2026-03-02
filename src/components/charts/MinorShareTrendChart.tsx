"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import type { MinorShareYear } from "@/lib/types";
import { useTheme } from "@/components/theme/ThemeProvider";

interface Props {
  data: MinorShareYear[];
}

export default function MinorShareTrendChart({ data }: Props) {
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
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 8, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
        <XAxis dataKey="year" fontSize={12} tick={{ fill: axisTickColor }} />
        <YAxis
          domain={[0, 100]}
          fontSize={12}
          tickFormatter={(v) => `${Number(v).toFixed(0)}%`}
          tick={{ fill: axisTickColor }}
        />
        <Tooltip
          formatter={(value, name) => [
            `${Number(value).toFixed(1)}%`,
            name,
          ]}
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
          cursor={{ stroke: hoverCursorFill }}
        />
        <Legend />
        <Line
          type="monotone"
          dataKey="minor_contracts_share"
          name="% contractes menors"
          stroke="#e11d48"
          strokeWidth={2}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
        />
        <Line
          type="monotone"
          dataKey="minor_amount_share"
          name="% import en contractes menors"
          stroke="#64748b"
          strokeWidth={2}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
