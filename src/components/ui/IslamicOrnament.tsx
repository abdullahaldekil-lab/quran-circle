import React from "react";
import { cn } from "@/lib/utils";
import { Moon, Sparkles } from "lucide-react";

/**
 * Islamic 8-point geometric star (Rub el Hizb)
 */
export function EightPointStar({ className = "w-5 h-5 text-amber-500" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={cn("inline-block shrink-0 transition-transform duration-300", className)}
    >
      <path d="M12 2l2.4 3.6 4.3-.8-1 4.2 3.8 2.1-3 3.1 2.2 3.8-4.3.7-1.1 4.2L12 20.3l-2.4 2.7-1.1-4.2-4.3-.7 2.2-3.8-3-3.1 3.8-2.1-1-4.2 4.3.8L12 2z" />
      <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

/**
 * Decorative Islamic Divider with central ornament
 */
export function IslamicDivider({
  className = "",
  variant = "gold",
  title,
}: {
  className?: string;
  variant?: "gold" | "emerald" | "subtle";
  title?: string;
}) {
  const lineStyle =
    variant === "gold"
      ? "from-transparent via-amber-500/40 to-transparent"
      : variant === "emerald"
      ? "from-transparent via-emerald-600/40 to-transparent"
      : "from-transparent via-border to-transparent";

  const starColor =
    variant === "gold"
      ? "text-amber-500"
      : variant === "emerald"
      ? "text-emerald-700 dark:text-emerald-400"
      : "text-muted-foreground/60";

  return (
    <div className={cn("relative flex items-center justify-center my-4 w-full select-none", className)}>
      <div className={cn("flex-grow h-px bg-gradient-to-r", lineStyle)} />
      <div className="mx-3 flex items-center gap-2 px-2 py-0.5 rounded-full bg-background/80 backdrop-blur-sm border border-border/40 text-xs">
        <EightPointStar className={cn("w-3.5 h-3.5", starColor)} />
        {title && <span className="font-amiri font-semibold text-foreground/80 px-1">{title}</span>}
        <EightPointStar className={cn("w-3.5 h-3.5", starColor)} />
      </div>
      <div className={cn("flex-grow h-px bg-gradient-to-r", lineStyle)} />
    </div>
  );
}

/**
 * Quranic spiritual header greeting bar
 */
export function QuranicVerseHeader({
  quote = "﴿ وَرَتِّلِ الْقُرْآنَ تَرْتِيلًا ﴾",
  subtitle = "مجمع حويلان لتحفيظ القرآن الكريم",
  className = "",
}: {
  quote?: string;
  subtitle?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl p-5 md:p-6 text-white shadow-xl border border-amber-500/30",
        "bg-gradient-to-l from-emerald-950 via-emerald-900 to-emerald-950",
        className
      )}
    >
      {/* Subtle decorative background stars */}
      <div className="absolute top-2 right-4 opacity-15 pointer-events-none">
        <EightPointStar className="w-32 h-32 text-amber-400" />
      </div>
      <div className="absolute -bottom-8 -left-8 opacity-10 pointer-events-none">
        <EightPointStar className="w-40 h-40 text-amber-400" />
      </div>

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/15 border border-amber-400/40 text-amber-300 text-xs sm:text-sm font-semibold mb-2.5 shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span className="font-cairo">{subtitle}</span>
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold font-amiri text-amber-300 drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] tracking-wide leading-relaxed">
            {quote}
          </h2>
        </div>

        <div className="flex items-center gap-2 text-xs sm:text-sm text-amber-100 bg-emerald-950/70 backdrop-blur-md px-4 py-2.5 rounded-xl border border-amber-400/30 shadow-md">
          <Moon className="w-4 h-4 text-amber-400 shrink-0 fill-amber-400/20" />
          <span className="font-amiri font-semibold text-sm sm:text-base text-amber-200">«خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ»</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Gilded Islamic Badge
 */
export function IslamicBadge({
  children,
  variant = "gold",
  className = "",
}: {
  children: React.ReactNode;
  variant?: "gold" | "emerald" | "sand";
  className?: string;
}) {
  const variantStyles = {
    gold: "bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/30",
    emerald: "bg-emerald-600/10 text-emerald-800 dark:text-emerald-300 border-emerald-600/30",
    sand: "bg-amber-100/50 text-amber-900 dark:bg-emerald-950/40 dark:text-amber-200 border-amber-300/40",
  }[variant];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border backdrop-blur-sm transition-all",
        variantStyles,
        className
      )}
    >
      <EightPointStar className="w-3 h-3 text-current opacity-80" />
      {children}
    </span>
  );
}
