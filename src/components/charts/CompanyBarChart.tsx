"use client";

import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { CompanyAggregation } from "@/lib/types";
import { formatCompactNumber } from "@/lib/utils";
import { useTheme } from "@/components/theme/ThemeProvider";

interface Props {
  data: CompanyAggregation[];
}

export default function CompanyBarChart({ data }: Props) {
  const [isMobile, setIsMobile] = useState(false);
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

  const maxChars = isMobile ? 16 : 30;

  const chartData = data.map((d) => ({
    name:
      d.denominacio_adjudicatari.length > maxChars
        ? d.denominacio_adjudicatari.slice(0, maxChars) + "…"
        : d.denominacio_adjudicatari,
    fullName: d.denominacio_adjudicatari,
    total: parseFloat(d.total),
  }));

  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 5, right: 30, left: isMobile ? 0 : 20, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={gridColor} />
        <XAxis
          type="number"
          tickFormatter={(v) => formatCompactNumber(v)}
          fontSize={isMobile ? 10 : 12}
          tick={{ fill: axisTickColor }}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={isMobile ? 120 : 220}
          fontSize={isMobile ? 10 : 11}
          tick={{ fill: axisTickColor }}
        />
        <Tooltip
          formatter={(value) => [
            formatCompactNumber(value as number),
            "Import total",
          ]}
          labelFormatter={(_label, payload) =>
            payload?.[0]?.payload?.fullName || _label
          }
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
        <Bar dataKey="total" fill="#1e3a5f" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
