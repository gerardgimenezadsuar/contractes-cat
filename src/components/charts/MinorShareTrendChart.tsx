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

interface Props {
  data: MinorShareYear[];
}

export default function MinorShareTrendChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 8, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="year" fontSize={12} />
        <YAxis
          domain={[0, 100]}
          fontSize={12}
          tickFormatter={(v) => `${Number(v).toFixed(0)}%`}
        />
        <Tooltip
          formatter={(value, name) => [
            `${Number(value).toFixed(1)}%`,
            name,
          ]}
        />
        <Legend />
        <Line
          type="monotone"
          dataKey="minor_contracts_share"
          name="% contractes menors"
          stroke="#dc2626"
          strokeWidth={2}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
        />
        <Line
          type="monotone"
          dataKey="minor_amount_share"
          name="% import en contractes menors"
          stroke="#1f2937"
          strokeWidth={2}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
