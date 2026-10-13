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
import { useIsMobile } from "@/lib/use-is-mobile";

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
  const isMobile = useIsMobile();
  const currentYear = new Date().getFullYear();
  const chartData = data
    .filter((d) => parseInt(d.year, 10) <= currentYear)
    .map((d) => ({
      year: d.year,
      total: parseFloat(d.total),
      num_contracts: parseInt(d.num_contracts, 10),
    }));

  return (
    <ResponsiveContainer width="100%" height={isMobile ? 260 : 380}>
      <BarChart
        data={chartData}
        margin={{ top: 20, right: isMobile ? 4 : 12, left: isMobile ? -8 : 12, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="year" fontSize={isMobile ? 10 : 12} interval={isMobile ? 1 : 0} />
        <YAxis
          tickFormatter={(v) => formatCompactNumber(v)}
          fontSize={isMobile ? 10 : 12}
          width={isMobile ? 48 : 60}
        />
        <Tooltip
          formatter={(value) => [formatCompactNumber(value as number), label]}
          contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.07)" }}
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
