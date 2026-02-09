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
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis
          type="number"
          tickFormatter={(v) => formatCompactNumber(v)}
          fontSize={isMobile ? 10 : 12}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={isMobile ? 140 : 250}
          fontSize={isMobile ? 10 : 11}
          tick={{ fill: "#374151" }}
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
          contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.07)" }}
        />
        <Bar dataKey="total" fill="#2563eb" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
