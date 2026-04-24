type WordmarkProps = {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
};

const SIZES: Record<NonNullable<WordmarkProps["size"]>, string> = {
  sm: "text-xl",
  md: "text-2xl",
  lg: "text-4xl sm:text-5xl",
  xl: "text-5xl sm:text-7xl",
};

export function Wordmark({ size = "md", className = "" }: WordmarkProps) {
  return (
    <span
      className={`font-serif font-bold tracking-tight ${SIZES[size]} ${className}`}
    >
      <span className="text-gold-400">Nu</span>
      <span className="text-foreground">Answers</span>
    </span>
  );
}
