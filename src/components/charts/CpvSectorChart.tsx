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
import { formatCompactNumber, formatNumber } from "@/lib/utils";
import { useTheme } from "@/components/theme/ThemeProvider";

interface SectorData {
  sector: string;
  code: string;
  total: number;
  num_contracts: number;
}

interface Props {
  data: SectorData[];
}

export default function CpvSectorChart({ data }: Props) {
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

  const maxChars = isMobile ? 18 : 35;

  const chartData = data.map((d) => ({
    name:
      d.sector.length > maxChars
        ? d.sector.slice(0, maxChars) + "…"
        : d.sector,
    fullName: d.sector,
    code: d.code,
    total: d.total,
    num_contracts: d.num_contracts,
  }));

  return (
    <ResponsiveContainer width="100%" height={Math.max(400, data.length * 36)}>
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
          width={isMobile ? 140 : 250}
          fontSize={isMobile ? 10 : 11}
          tick={{ fill: axisTickColor }}
        />
        <Tooltip
          formatter={(value) => [
            formatCompactNumber(value as number),
            "Import total",
          ]}
          labelFormatter={(_label, payload) => {
            const entry = payload?.[0]?.payload;
            if (!entry) return _label;
            return `${entry.fullName} (CPV ${entry.code}) — ${formatNumber(entry.num_contracts)} contractes`;
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
        <Bar dataKey="total" fill="#2563eb" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
