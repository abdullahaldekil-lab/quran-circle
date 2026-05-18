import { formatDateHijriOnly } from "@/lib/hijri";

interface DualDateDisplayProps {
  date: Date | string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function DualDateDisplay({ date, className = "", size = "md" }: DualDateDisplayProps) {
  const hijri = formatDateHijriOnly(date);

  const sizeClasses = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-lg",
  };

  return (
    <span className={`inline-flex flex-col ${className}`}>
      <span className={`${sizeClasses[size]} font-medium`}>{hijri}</span>
    </span>
  );
}

interface InlineDualDateProps {
  date: Date | string;
  className?: string;
}

export function InlineDualDate({ date, className = "" }: InlineDualDateProps) {
  const hijri = formatDateHijriOnly(date);

  return (
    <span className={`font-medium ${className}`}>{hijri}</span>
  );
}

export default DualDateDisplay;
