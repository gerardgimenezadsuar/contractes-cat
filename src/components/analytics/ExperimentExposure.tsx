"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics";

/** Reports once per page view that the visitor saw this variant of an experiment. */
export default function ExperimentExposure({ experiment, variant }: { experiment: string; variant: string }) {
  useEffect(() => {
    trackEvent("experiment_view", { experiment, variant });
  }, [experiment, variant]);
  return null;
}
