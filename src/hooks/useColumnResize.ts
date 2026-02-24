"use client";

import { useState, useCallback, useRef, useEffect } from "react";

export interface ColumnDef {
  id: string;
  /** Initial width as a percentage (0-100) */
  initialWidthPct: number;
}

export function useColumnResize(
  columns: ColumnDef[],
  tableRef: React.RefObject<HTMLTableElement | null>
) {
  const [widths, setWidths] = useState<Record<string, number>>({});
  const dragState = useRef<{
    startX: number;
    startWidthLeft: number;
    startWidthRight: number;
    leftId: string;
    rightId: string;
  } | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const initializedRef = useRef(false);
  const handlersRef = useRef<{ move: (e: MouseEvent) => void; up: () => void } | null>(null);

  // Initialize widths from percentages when table mounts
  useEffect(() => {
    const table = tableRef.current;
    if (!table || initializedRef.current) return;

    const observer = new ResizeObserver(() => {
      if (initializedRef.current) return;
      const tableWidth = table.offsetWidth;
      if (tableWidth === 0) return;
      const newWidths: Record<string, number> = {};
      for (const col of columns) {
        newWidths[col.id] = (col.initialWidthPct / 100) * tableWidth;
      }
      setWidths(newWidths);
      initializedRef.current = true;
    });
    observer.observe(table);
    return () => observer.disconnect();
  }, [columns, tableRef]);

  const cleanup = useCallback(() => {
    if (handlersRef.current) {
      document.removeEventListener("mousemove", handlersRef.current.move);
      document.removeEventListener("mouseup", handlersRef.current.up);
      handlersRef.current = null;
    }
    dragState.current = null;
    setIsResizing(false);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  const startResize = useCallback(
    (colIndex: number, e: React.MouseEvent) => {
      if (colIndex >= columns.length - 1) return;
      e.preventDefault();
      e.stopPropagation();
      const leftId = columns[colIndex].id;
      const rightId = columns[colIndex + 1].id;
      dragState.current = {
        startX: e.clientX,
        startWidthLeft: widths[leftId] || 0,
        startWidthRight: widths[rightId] || 0,
        leftId,
        rightId,
      };
      setIsResizing(true);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      const onMove = (ev: MouseEvent) => {
        const state = dragState.current;
        if (!state) return;
        const delta = ev.clientX - state.startX;
        const minW = 60;
        const newLeft = state.startWidthLeft + delta;
        const newRight = state.startWidthRight - delta;
        if (newLeft >= minW && newRight >= minW) {
          setWidths((prev) => ({
            ...prev,
            [state.leftId]: newLeft,
            [state.rightId]: newRight,
          }));
        }
      };

      const onUp = () => cleanup();

      handlersRef.current = { move: onMove, up: onUp };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [columns, widths, cleanup]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  return { widths, startResize, isResizing };
}
