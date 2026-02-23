interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  trend?: number | null; // percentage change, positive = up, negative = down
  trendLabel?: string;
  compact?: boolean;
}

export default function StatCard({
  title,
  value,
  subtitle,
  trend,
  trendLabel,
  compact = false,
}: StatCardProps) {
  return (
    <div className={`bg-white rounded-lg border border-gray-100 shadow-sm ${compact ? "p-4" : "p-6"}`}>
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <p className={`mt-1 font-bold text-gray-900 ${compact ? "text-2xl" : "text-3xl"}`}>{value}</p>
      {trend != null && (
        <p className={`mt-1 text-sm font-medium ${trend >= 0 ? "text-green-600" : "text-red-600"}`}>
          {trend >= 0 ? "▲" : "▼"} {Math.abs(trend).toFixed(1)}%
          {trendLabel && (
            <span className="ml-1 font-normal text-gray-400 text-xs">{trendLabel}</span>
          )}
        </p>
      )}
      {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
    </div>
  );
}
