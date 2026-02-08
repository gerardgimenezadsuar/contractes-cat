"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { YearlyAggregation } from "@/lib/types";
import { formatCompactNumber } from "@/lib/utils";

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
  color = "#1f2937",
}: Props) {
  const chartData = data.map((d) => ({
    year: d.year,
    total: parseFloat(d.total),
    num_contracts: parseInt(d.num_contracts, 10),
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart
        data={chartData}
        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="year" fontSize={12} />
        <YAxis
          tickFormatter={(v) => formatCompactNumber(v)}
          fontSize={12}
        />
        <Tooltip
          formatter={(value) => [formatCompactNumber(value as number), label]}
        />
        <Line
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={2}
          dot={{ r: 4 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
