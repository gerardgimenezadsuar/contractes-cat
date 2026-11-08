import type { ReactNode } from "react";

interface Props {
  title: ReactNode;
  /** Small uppercase line above the title, e.g. the section of the site. */
  eyebrow?: ReactNode;
  /** Short intro under the title. Paragraphs are spaced automatically. */
  children?: ReactNode;
  /** Buttons on the right (share, follow...). */
  actions?: ReactNode;
  className?: string;
}

/**
 * Title block for listing and information pages, in the same style as the
 * entity headers: serif title, muted intro of reading width, actions on the right.
 */
export default function PageHeader({ title, eyebrow, children, actions, className = "mb-8" }: Props) {
  return (
    <header className={`grid grid-cols-[minmax(0,1fr)] gap-2 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow ? <p className="text-xs font-medium uppercase tracking-wider text-accent">{eyebrow}</p> : null}
          <h1 className="font-display text-[1.75rem] font-semibold leading-tight text-gray-900 sm:text-3xl md:text-4xl [text-wrap:balance]">
            {title}
          </h1>
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      {children ? (
        <div className="max-w-3xl space-y-2 text-[15px] leading-relaxed text-gray-600">{children}</div>
      ) : null}
    </header>
  );
}
