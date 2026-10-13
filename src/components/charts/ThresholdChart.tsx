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
import { useIsMobile } from "@/lib/use-is-mobile";

interface Props {
  data: ThresholdBucket[];
}

export default function ThresholdChart({ data }: Props) {
  const isMobile = useIsMobile();
  return (
    <ResponsiveContainer width="100%" height={isMobile ? 300 : 400}>
      <BarChart
        data={data}
        margin={{ top: 5, right: isMobile ? 8 : 30, left: isMobile ? -8 : 20, bottom: 32 }}
      >
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="label"
          fontSize={isMobile ? 10 : 12}
          angle={-32}
          textAnchor="end"
          height={72}
          interval={isMobile ? 5 : 2}
          tickMargin={8}
          tickFormatter={(label) => String(label).split("-")[0]}
        />
        <YAxis tickFormatter={(v) => formatNumber(v)} fontSize={isMobile ? 10 : 12} width={isMobile ? 48 : 60} />
        <Tooltip
          formatter={(value) => [formatNumber(value as number), "Contractes"]}
          labelFormatter={(label) => `Rang: ${label} EUR (sense IVA)`}
          contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.07)" }}
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
