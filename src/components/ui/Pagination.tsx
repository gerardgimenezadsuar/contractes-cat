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

  return (
    <nav aria-label="Paginació" className="flex items-center justify-between mt-4">
      <p className="text-sm text-gray-600">
        {((currentPage - 1) * pageSize + 1).toLocaleString("ca-ES")}–
        {Math.min(currentPage * pageSize, totalItems).toLocaleString("ca-ES")}{" "}
        de {totalItems.toLocaleString("ca-ES")}
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          aria-label="Pàgina anterior"
          className="px-3 py-1.5 text-sm rounded border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
        >
          Anterior
        </button>
        {getPageNumbers().map((page) =>
          page === "dots-left" || page === "dots-right" ? (
            <span key={page} className="px-2 text-gray-400" aria-label="Més pàgines">
              ...
            </span>
          ) : (
            <button
              key={page}
              onClick={() => onPageChange(page as number)}
              aria-current={page === currentPage ? "page" : undefined}
              aria-label={`Pàgina ${page}`}
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
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          aria-label="Pàgina següent"
          className="px-3 py-1.5 text-sm rounded border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
        >
          Següent
        </button>
      </div>
    </nav>
  );
}
