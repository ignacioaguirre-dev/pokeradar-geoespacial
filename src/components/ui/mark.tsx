// The shape mark of the notices, also reused where a control stands for a notice (the movement help)
const MARKS = {
  info: { glyph: "i", color: "text-foreground" },
  success: { glyph: "✓", color: "text-foreground" },
  error: { glyph: "!", color: "text-alert" },
} as const;

export type MarkVariant = keyof typeof MARKS;

// Decorative: what it marks always carries its own name or text
export function Mark({ variant }: { variant: MarkVariant }) {
  const { glyph, color } = MARKS[variant];
  return (
    <span aria-hidden="true" className={`font-mono text-subtitle font-bold ${color}`}>
      {glyph}
    </span>
  );
}
