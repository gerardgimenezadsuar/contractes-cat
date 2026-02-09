"use client";

import { useEffect, useState } from "react";
import SearchLoadingIndicator from "@/components/ui/SearchLoadingIndicator";

interface SearchInputProps {
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  debounceMs?: number;
  loading?: boolean;
  loadingText?: string;
}

export default function SearchInput({
  placeholder = "Cerca...",
  value,
  onChange,
  debounceMs = 400,
  loading = false,
  loadingText = "Cercant registres...",
}: SearchInputProps) {
  const [local, setLocal] = useState(value);

  useEffect(() => {
    setLocal(value);
  }, [value]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (local !== value) onChange(local);
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [local, debounceMs, onChange, value]);

  return (
    <div className="relative">
      <svg
        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
      <input
        type="text"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        placeholder={placeholder}
        aria-busy={loading}
        className={`w-full pl-10 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent ${
          loading ? "pr-40" : "pr-4"
        }`}
      />
      {loading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <SearchLoadingIndicator text={loadingText} />
        </div>
      )}
    </div>
  );
}
