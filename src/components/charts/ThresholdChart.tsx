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

interface Props {
  data: ThresholdBucket[];
}

export default function ThresholdChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart
        data={data}
        margin={{ top: 5, right: 30, left: 20, bottom: 32 }}
      >
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="label"
          fontSize={12}
          angle={-32}
          textAnchor="end"
          height={72}
          interval={2}
          tickMargin={8}
          tickFormatter={(label) => String(label).split("-")[0]}
        />
        <YAxis tickFormatter={(v) => formatNumber(v)} fontSize={12} />
        <Tooltip
          formatter={(value) => [formatNumber(value as number), "Contractes"]}
          labelFormatter={(label) => `Rang: ${label} EUR (sense IVA)`}
        />
        <ReferenceLine
          x="14.5k-15.0k"
          stroke="#dc2626"
          strokeDasharray="3 3"
          label={{ value: "Tram final <15k", position: "top", fill: "#dc2626", fontSize: 11 }}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {data.map((entry, index) => (
            <Cell
              key={index}
              fill={entry.range_start >= 14500 ? "#dc2626" : "#1f2937"}
              fillOpacity={entry.range_start >= 14500 ? 1 : 0.8}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
