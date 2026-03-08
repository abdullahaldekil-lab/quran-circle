import { CalendarDays } from "lucide-react";
import { getCurrentFullDateHeader } from "@/lib/hijri";

interface PageDateHeaderProps {
  className?: string;
}

/**
 * Displays full date header: "الأربعاء، 15 رمضان 1447 (4 مارس 2026)"
 */
export function PageDateHeader({ className = "" }: PageDateHeaderProps) {
  const dateHeader = getCurrentFullDateHeader();

  return (
    <div className={`flex items-center gap-2 text-sm text-muted-foreground ${className}`}>
      <CalendarDays className="w-4 h-4" />
      <span>{dateHeader}</span>
    </div>
  );
}

export default PageDateHeader;
