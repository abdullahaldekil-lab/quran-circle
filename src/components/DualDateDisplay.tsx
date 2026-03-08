import { formatDualDate } from "@/lib/hijri";

interface DualDateDisplayProps {
  date: Date | string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

/**
 * Displays date with Hijri as primary and Gregorian as secondary
 */
export function DualDateDisplay({ date, className = "", size = "md" }: DualDateDisplayProps) {
  const { hijri, gregorian } = formatDualDate(date);

  const sizeClasses = {
    sm: { primary: "text-sm", secondary: "text-xs" },
    md: { primary: "text-base", secondary: "text-sm" },
    lg: { primary: "text-lg", secondary: "text-base" },
  };

  return (
    <span className={`inline-flex flex-col ${className}`}>
      <span className={`${sizeClasses[size].primary} font-medium`}>{hijri}</span>
      <span className={`${sizeClasses[size].secondary} text-muted-foreground`}>{gregorian}</span>
    </span>
  );
}

interface InlineDualDateProps {
  date: Date | string;
  className?: string;
}

/**
 * Displays date inline: "15 رمضان 1447 ، 4 مارس 2026"
 */
export function InlineDualDate({ date, className = "" }: InlineDualDateProps) {
  const { hijri, gregorian } = formatDualDate(date);

  return (
    <span className={className}>
      <span className="font-medium">{hijri}</span>
      <span className="text-muted-foreground text-sm mr-1">، {gregorian}</span>
    </span>
  );
}

export default DualDateDisplay;
