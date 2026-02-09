"use client";

import { useMemo, useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  BarChart,
  Bar,
  Cell,
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
  enableYearFilter?: boolean;
}

export default function YearlyTrendChart({
  data,
  dataKey = "total",
  label = "Import total",
  color = "#1e3a5f",
  enableYearFilter = false,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentYear = new Date().getFullYear();
  const selectedYear = useMemo(() => {
    if (!enableYearFilter) return null;
    const rawYear = searchParams.get("year");
    if (!rawYear || !/^\d{4}$/.test(rawYear)) return null;
    return rawYear;
  }, [enableYearFilter, searchParams]);

  const chartData = useMemo(
    () =>
      data
        .filter((d) => parseInt(d.year, 10) <= currentYear)
        .map((d) => ({
          year: d.year,
          total: parseFloat(d.total),
          num_contracts: parseInt(d.num_contracts, 10),
        })),
    [currentYear, data]
  );
  const hasSelectedYearInData = useMemo(
    () => Boolean(selectedYear) && chartData.some((point) => point.year === selectedYear),
    [chartData, selectedYear]
  );

  const handleBarClick = useCallback(
    (entry: unknown) => {
      if (!enableYearFilter) return;
      const clickedYear = (entry as { payload?: { year?: string } })?.payload?.year;
      if (!clickedYear) return;

      const params = new URLSearchParams(searchParams.toString());
      if (selectedYear === clickedYear) {
        params.delete("year");
      } else {
        params.set("year", clickedYear);
      }

      const queryString = params.toString();
      router.replace(queryString ? `${pathname}?${queryString}` : pathname, {
        scroll: false,
      });
    },
    [enableYearFilter, pathname, router, searchParams, selectedYear]
  );

  return (
    <ResponsiveContainer width="100%" height={380}>
      <BarChart data={chartData} margin={{ top: 20, right: 12, left: 12, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="year" fontSize={12} />
        <YAxis tickFormatter={(v) => formatCompactNumber(v)} fontSize={12} />
        <Tooltip
          formatter={(value) => [formatCompactNumber(value as number), label]}
          contentStyle={{
            borderRadius: "8px",
            border: "1px solid #e5e7eb",
            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.07)",
          }}
        />
        <Bar
          dataKey={dataKey}
          fill={color}
          radius={[4, 4, 0, 0]}
          onClick={enableYearFilter ? handleBarClick : undefined}
          cursor={enableYearFilter ? "pointer" : "default"}
        >
          {chartData.map((point) => {
            const isSelected = selectedYear === point.year;
            const isDimmed = hasSelectedYearInData && !isSelected;
            return (
              <Cell
                key={`year-cell-${point.year}`}
                fillOpacity={isDimmed ? 0.3 : 1}
                stroke={isSelected ? "#0f172a" : undefined}
                strokeWidth={isSelected ? 1.5 : 0}
              />
            );
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
