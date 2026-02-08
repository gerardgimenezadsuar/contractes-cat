import { StatCardSkeleton } from "@/components/ui/Loading";

export default function HomeLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="animate-pulse mb-12">
        <div className="h-10 bg-gray-200 rounded w-96 mb-4" />
        <div className="h-6 bg-gray-100 rounded w-[600px]" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-64 mb-4" />
        <div className="h-[400px] bg-gray-100 rounded" />
      </div>
    </div>
  );
}
