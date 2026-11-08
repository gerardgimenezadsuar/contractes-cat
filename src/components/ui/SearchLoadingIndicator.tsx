"use client";

interface SearchLoadingIndicatorProps {
  text?: string;
  className?: string;
}

export default function SearchLoadingIndicator({
  text = "Cercant...",
  className = "",
}: SearchLoadingIndicatorProps) {
  return (
    <div
      className={`inline-flex items-center gap-2 text-xs font-medium text-accent ${className}`}
      role="status"
      aria-live="polite"
    >
      <span
        className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-accent/25 border-t-accent"
        aria-hidden="true"
      />
      <span>{text}</span>
    </div>
  );
}
