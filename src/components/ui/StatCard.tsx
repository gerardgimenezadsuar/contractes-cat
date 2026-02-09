import Link from "next/link";

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  valueHref?: string;
  valueLinkTitle?: string;
}

export default function StatCard({
  title,
  value,
  subtitle,
  valueHref,
  valueLinkTitle,
}: StatCardProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-6">
      <p className="text-sm font-medium text-gray-500">{title}</p>
      {valueHref ? (
        <Link
          href={valueHref}
          title={valueLinkTitle}
          className="mt-1 inline-block text-3xl font-bold text-gray-900 underline decoration-dotted underline-offset-4 hover:text-gray-700"
        >
          {value}
        </Link>
      ) : (
        <p className="mt-1 text-3xl font-bold text-gray-900">{value}</p>
      )}
      {subtitle && (
        <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
      )}
    </div>
  );
}
