"use client";

import { useEffect, useState } from "react";

/** True below Tailwind's `sm` breakpoint (640px). False during SSR. */
export function useIsMobile(maxWidth = 639): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${maxWidth}px)`);
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, [maxWidth]);

  return isMobile;
}
