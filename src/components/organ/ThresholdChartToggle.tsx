"use client";

import { useState } from "react";
import type { ThresholdBucket } from "@/lib/types";
import { ThresholdChartLazy } from "@/components/charts/LazyCharts";
import { trackEvent } from "@/lib/analytics";

/** Folded histogram: the chart (and its JS) only loads when someone opens it. */
export default function ThresholdChartToggle({ data }: { data: ThresholdBucket[] }) {
  const [open, setOpen] = useState(false);
  return (
    <details
      className="mt-2"
      onToggle={(event) => {
        const isOpen = (event.currentTarget as HTMLDetailsElement).open;
        setOpen(isOpen);
        if (isOpen) trackEvent("threshold_chart_open", { page: "organisme" });
      }}
    >
      <summary className="cursor-pointer text-sm font-medium text-gray-600 hover:text-gray-900">
        Veure la distribució per imports
      </summary>
      {open ? (
        <div className="mt-3">
          <ThresholdChartLazy data={data} />
        </div>
      ) : null}
    </details>
  );
}
