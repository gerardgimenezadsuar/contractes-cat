export default function Loading() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-200" />
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="animate-pulse">
      <div className="h-10 skeleton-block rounded mb-4" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 skeleton-block rounded mb-2" />
      ))}
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="skeleton-card rounded-lg p-6 animate-pulse">
      <div className="h-4 skeleton-block rounded w-24 mb-2" />
      <div className="h-8 skeleton-block rounded w-32" />
    </div>
  );
}
