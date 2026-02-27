"use client";

import dynamic from "next/dynamic";
import type {
  CompanyAggregation,
  MinorShareYear,
  ThresholdBucket,
  YearlyAggregation,
} from "@/lib/types";

function ChartSkeleton({ className }: { className: string }) {
  return <div className={`${className} w-full animate-pulse rounded skeleton-block`} aria-hidden="true" />;
}

const CompanyBarChartLazyImpl = dynamic(() => import("@/components/charts/CompanyBarChart"), {
  ssr: false,
  loading: () => <ChartSkeleton className="h-[400px]" />,
});

const YearlyTrendChartLazyImpl = dynamic(() => import("@/components/charts/YearlyTrendChart"), {
  ssr: false,
  loading: () => <ChartSkeleton className="h-[380px]" />,
});

const ThresholdChartLazyImpl = dynamic(() => import("@/components/charts/ThresholdChart"), {
  ssr: false,
  loading: () => <ChartSkeleton className="h-[400px]" />,
});

const MinorShareTrendChartLazyImpl = dynamic(() => import("@/components/charts/MinorShareTrendChart"), {
  ssr: false,
  loading: () => <ChartSkeleton className="h-[320px]" />,
});

interface CompanyBarChartProps {
  data: CompanyAggregation[];
}

interface YearlyTrendChartProps {
  data: YearlyAggregation[];
  dataKey?: "total" | "num_contracts";
  label?: string;
  color?: string;
}

interface ThresholdChartProps {
  data: ThresholdBucket[];
}

interface MinorShareTrendChartProps {
  data: MinorShareYear[];
}

export function CompanyBarChartLazy({ data }: CompanyBarChartProps) {
  return <CompanyBarChartLazyImpl data={data} />;
}

export function YearlyTrendChartLazy({
  data,
  dataKey,
  label,
  color,
}: YearlyTrendChartProps) {
  return (
    <YearlyTrendChartLazyImpl
      data={data}
      dataKey={dataKey}
      label={label}
      color={color}
    />
  );
}

export function ThresholdChartLazy({ data }: ThresholdChartProps) {
  return <ThresholdChartLazyImpl data={data} />;
}

export function MinorShareTrendChartLazy({ data }: MinorShareTrendChartProps) {
  return <MinorShareTrendChartLazyImpl data={data} />;
}
