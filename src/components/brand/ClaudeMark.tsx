// Simplified spark mark in Claude's orange, used only to indicate the Claude connector.
const RAYS = [
  { angle: 0, len: 9 },
  { angle: 30, len: 6.5 },
  { angle: 60, len: 9 },
  { angle: 90, len: 6.5 },
  { angle: 120, len: 9 },
  { angle: 150, len: 6.5 },
  { angle: 180, len: 9 },
  { angle: 210, len: 6.5 },
  { angle: 240, len: 9 },
  { angle: 270, len: 6.5 },
  { angle: 300, len: 9 },
  { angle: 330, len: 6.5 },
];

export default function ClaudeMark({
  className = "h-6 w-6",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="-12 -12 24 24"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <g stroke="#D97757" strokeWidth="2.6" strokeLinecap="round">
        {RAYS.map(({ angle, len }) => (
          <line
            key={angle}
            x1="0"
            y1="-2"
            x2="0"
            y2={-len}
            transform={`rotate(${angle})`}
          />
        ))}
      </g>
    </svg>
  );
}
