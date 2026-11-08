"use client";

import { trackEvent } from "@/lib/analytics";

interface Props {
  href: string;
  /** "empresa" or "organisme", for analytics. */
  page: string;
}

/** Link to the page's RSS feed of new contracts, styled like the share button. */
export default function FollowFeedLink({ href, page }: Props) {
  return (
    <a
      href={href}
      type="application/rss+xml"
      title="Rep els contractes nous al teu lector RSS (Feedly, Inoreader, Thunderbird...)"
      onClick={() => trackEvent("follow_feed", { page })}
      className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
    >
      <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5 text-orange-500" fill="currentColor">
        <circle cx="3" cy="13" r="2" />
        <path d="M1 7.5v2a5.5 5.5 0 0 1 5.5 5.5h2A7.5 7.5 0 0 0 1 7.5Z" />
        <path d="M1 2.5v2A10.5 10.5 0 0 1 11.5 15h2A12.5 12.5 0 0 0 1 2.5Z" />
      </svg>
      Segueix
    </a>
  );
}
