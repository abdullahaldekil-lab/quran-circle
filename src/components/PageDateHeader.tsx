import { Moon } from "lucide-react";
import { getCurrentFullDateHeader } from "@/lib/hijri";
import { EightPointStar } from "@/components/ui/IslamicOrnament";
import { cn } from "@/lib/utils";

interface PageDateHeaderProps {
  className?: string;
}

/**
 * Displays full date header: "الأربعاء، 15 رمضان 1447 (4 مارس 2026)"
 */
export function PageDateHeader({ className = "" }: PageDateHeaderProps) {
  const dateHeader = getCurrentFullDateHeader();

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-amber-500/10 dark:bg-emerald-950/40 border border-amber-500/25 dark:border-emerald-800/40 text-xs sm:text-sm font-medium text-amber-900 dark:text-amber-200 shadow-sm backdrop-blur-sm",
        className
      )}
    >
      <Moon className="w-4 h-4 text-amber-500 fill-amber-500/20 shrink-0" />
      <span className="font-amiri font-bold text-sm tracking-wide">{dateHeader}</span>
      <EightPointStar className="w-3.5 h-3.5 text-amber-500/70 shrink-0 hidden sm:inline-block" />
    </div>
  );
}

export default PageDateHeader;
