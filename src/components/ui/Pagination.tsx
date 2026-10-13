"use client";

interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

type PaginationToken = number | "dots-left" | "dots-right";

export default function Pagination({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
}: PaginationProps) {
  const totalPages = Math.ceil(totalItems / pageSize);

  if (totalPages <= 1) return null;

  const getPageNumbers = () => {
    const pages: PaginationToken[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("dots-left");
      for (
        let i = Math.max(2, currentPage - 1);
        i <= Math.min(totalPages - 1, currentPage + 1);
        i++
      ) {
        pages.push(i);
      }
      if (currentPage < totalPages - 2) pages.push("dots-right");
      pages.push(totalPages);
    }
    return pages;
  };

  const rangeLabel = `${((currentPage - 1) * pageSize + 1).toLocaleString("ca-ES")}–${Math.min(
    currentPage * pageSize,
    totalItems
  ).toLocaleString("ca-ES")} de ${totalItems.toLocaleString("ca-ES")}`;

  const prevDisabled = currentPage <= 1;
  const nextDisabled = currentPage >= totalPages;

  return (
    <nav className="mt-4" aria-label="Paginació">
      {/* Mobile: previous / page x of y / next with large touch targets */}
      <div className="sm:hidden">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={prevDisabled}
            className="min-h-11 flex-1 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-800 disabled:opacity-40 disabled:cursor-not-allowed active:bg-gray-50"
          >
            ← Anterior
          </button>
          <span className="shrink-0 px-1 text-xs text-gray-600 whitespace-nowrap">
            Pàg. {currentPage.toLocaleString("ca-ES")} de {totalPages.toLocaleString("ca-ES")}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={nextDisabled}
            className="min-h-11 flex-1 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-800 disabled:opacity-40 disabled:cursor-not-allowed active:bg-gray-50"
          >
            Següent →
          </button>
        </div>
        <p className="mt-2 text-center text-xs text-gray-500">{rangeLabel}</p>
      </div>

      {/* Desktop: numbered pages */}
      <div className="hidden sm:flex items-center justify-between">
        <p className="text-sm text-gray-600">{rangeLabel}</p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={prevDisabled}
            className="px-3 py-1.5 text-sm rounded border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Anterior
          </button>
          {getPageNumbers().map((page) =>
            page === "dots-left" || page === "dots-right" ? (
              <span key={page} className="px-2 text-gray-400">
                ...
              </span>
            ) : (
              <button
                type="button"
                key={page}
                onClick={() => onPageChange(page as number)}
                aria-current={page === currentPage ? "page" : undefined}
                className={`px-3 py-1.5 text-sm rounded border ${
                  page === currentPage
                    ? "bg-gray-900 text-white border-gray-900"
                    : "border-gray-300 hover:bg-gray-50"
                }`}
              >
                {page}
              </button>
            )
          )}
          <button
            type="button"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={nextDisabled}
            className="px-3 py-1.5 text-sm rounded border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Següent
          </button>
        </div>
      </div>
    </nav>
  );
}
