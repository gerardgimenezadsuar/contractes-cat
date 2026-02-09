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

interface Props {
  data: CompanyAggregation[];
}

export default function CompanyBarChart({ data }: Props) {
  const [isMobile, setIsMobile] = useState(false);

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
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis
          type="number"
          tickFormatter={(v) => formatCompactNumber(v)}
          fontSize={isMobile ? 10 : 12}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={isMobile ? 120 : 220}
          fontSize={isMobile ? 10 : 11}
          tick={{ fill: "#374151" }}
        />
        <Tooltip
          formatter={(value) => [
            formatCompactNumber(value as number),
            "Import total",
          ]}
          labelFormatter={(_label, payload) =>
            payload?.[0]?.payload?.fullName || _label
          }
          contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.07)" }}
        />
        <Bar dataKey="total" fill="#1e3a5f" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
