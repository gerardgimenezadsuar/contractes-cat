import ChatGPTMark from "@/components/brand/ChatGPTMark";
import ClaudeMark from "@/components/brand/ClaudeMark";

const SIZES = {
  sm: { badge: "h-5 w-5", mark: "h-3 w-3", overlap: "-ml-1.5" },
  lg: { badge: "h-11 w-11", mark: "h-6 w-6", overlap: "-ml-3" },
} as const;

/** ChatGPT and Claude marks as two overlapping round badges: the assistants with a one-click install. */
export default function AssistantMarks({ size = "sm", className = "" }: { size?: keyof typeof SIZES; className?: string }) {
  const s = SIZES[size];
  const badge = `flex ${s.badge} shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white ring-2 ring-white`;
  return (
    <span className={`inline-flex items-center ${className}`} aria-hidden="true">
      <span className={`${badge} relative z-10 text-gray-900`}>
        <ChatGPTMark className={s.mark} />
      </span>
      <span className={`${badge} ${s.overlap}`}>
        <ClaudeMark className={s.mark} />
      </span>
    </span>
  );
}
