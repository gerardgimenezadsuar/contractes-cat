import { StatCardSkeleton, TableSkeleton } from "@/components/ui/Loading";

export default function CompanyDetailLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="animate-pulse mb-4 h-4 w-36 rounded bg-gray-200" />

      <div className="mb-1 flex items-start justify-between gap-3">
        <div className="animate-pulse h-10 w-2/3 rounded bg-gray-200" />
        <div className="animate-pulse h-9 w-9 rounded bg-gray-100" />
      </div>
      <div className="mb-8 flex flex-wrap items-center gap-2">
        <div className="animate-pulse h-5 w-44 rounded bg-gray-100" />
        <div className="animate-pulse h-6 w-20 rounded-full bg-blue-100" />
      </div>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </section>

      <section className="mb-12 grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div>
          <div className="animate-pulse mb-4 h-8 w-52 rounded bg-gray-200" />
          <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
            <div className="animate-pulse h-[340px] rounded bg-gray-100" />
          </div>
        </div>
        <div>
          <div className="animate-pulse mb-4 h-8 w-56 rounded bg-gray-200" />
          <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
            <TableSkeleton rows={6} />
          </div>
        </div>
      </section>

      <section className="mb-12">
        <div className="animate-pulse mb-4 h-8 w-80 rounded bg-gray-200" />
        <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
          <TableSkeleton rows={6} />
        </div>
      </section>

      <section>
        <div className="animate-pulse mb-4 h-8 w-48 rounded bg-gray-200" />
        <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
          <TableSkeleton rows={8} />
        </div>
      </section>
    </div>
  );
}
