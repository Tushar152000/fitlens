/**
 * Five-segment progress bar from Figma "Frame 23" (3828:3121): 5 px round-capped strokes of uneven
 * length; done steps are solid purple, the rest 10% purple.
 */
const SEGMENTS: [number, number][] = [
  [2.5, 17.5],
  [33.5, 157.5],
  [173.5, 229.5],
  [245.5, 325.5],
  [341.5, 356.5],
];

export function WelcomeProgress({ step }: { step: number }) {
  return (
    <svg
      width={359}
      height={5}
      viewBox="0 0 359 5"
      fill="none"
      role="progressbar"
      aria-label="Setup progress"
      aria-valuemin={1}
      aria-valuemax={SEGMENTS.length}
      aria-valuenow={step}
      className="max-w-full"
    >
      {SEGMENTS.map(([x1, x2], i) => (
        <path
          key={x1}
          d={`M${x1} 2.5H${x2}`}
          stroke="var(--color-fitr8)"
          strokeOpacity={i < step ? 1 : 0.1}
          strokeWidth={5}
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}
