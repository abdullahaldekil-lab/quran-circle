// Shared prayer-time resolution for the app and for scheduled functions.
//
// Two problems this fixes:
//
// 1. Timezone. The Deno runtime runs in UTC, so `new Date().setHours(h, m)` on an
//    "hh:mm" Riyadh prayer time produced a moment three hours off. It never mattered
//    because nothing was scheduled — it would have from the first cron run.
//
// 2. Repeat fetching. Each monitor tick used to invoke the `prayer-times` function,
//    which hit api.aladhan.com again. Times for a given day never change, so they are
//    cached in `prayer_times_cache`.

// deno-lint-ignore-file no-explicit-any

/** The academy's location — Buraidah, Saudi Arabia (Umm Al-Qura calculation). */
export const LOCATION = { latitude: 26.3260, longitude: 43.9750, method: 4 } as const;
export const TIMEZONE = "Asia/Riyadh";

export interface PrayerTimes {
  fajr: string;
  dhuhr: string;
  asr: string;
  maghrib: string;
  isha: string;
  date?: string;
  hijri_date?: string;
}

/** Today's date in Riyadh as YYYY-MM-DD, regardless of the server's timezone. */
export const riyadhToday = (now: Date = new Date()): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

/** Day of week in Riyadh: 0 = Sunday … 5 = Friday, 6 = Saturday. */
export const riyadhDayOfWeek = (now: Date = new Date()): number => {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: TIMEZONE, weekday: "short" }).format(now);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(name);
};

/** Friday and Saturday are the weekend in Saudi Arabia. */
export const isWeekend = (now: Date = new Date()): boolean => {
  const dow = riyadhDayOfWeek(now);
  return dow === 5 || dow === 6;
};

/**
 * Absolute instant for an "HH:mm" Riyadh wall-clock time on a given Riyadh date.
 * Anchored with an explicit +03:00 offset so it is correct from any server timezone.
 */
export const riyadhTimeToDate = (dateISO: string, hhmm: string): Date => {
  const [h, m] = hhmm.split(":").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  return new Date(`${dateISO}T${pad(h)}:${pad(m)}:00+03:00`);
};

async function fetchFromAladhan(dateISO: string): Promise<PrayerTimes> {
  const [y, m, d] = dateISO.split("-");
  const url =
    `https://api.aladhan.com/v1/timings/${d}-${m}-${y}` +
    `?latitude=${LOCATION.latitude}&longitude=${LOCATION.longitude}` +
    `&method=${LOCATION.method}&timezonestring=${TIMEZONE}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Aladhan API error: ${res.status}`);
  const json = await res.json();
  const t = json.data.timings;
  // Aladhan may append a timezone suffix such as "16:12 (+03)".
  const clean = (v: string) => String(v).trim().split(" ")[0];
  return {
    fajr: clean(t.Fajr),
    dhuhr: clean(t.Dhuhr),
    asr: clean(t.Asr),
    maghrib: clean(t.Maghrib),
    isha: clean(t.Isha),
    date: json.data.date.gregorian.date,
    hijri_date: `${json.data.date.hijri.day} ${json.data.date.hijri.month.ar} ${json.data.date.hijri.year}`,
  };
}

/** Prayer times for a Riyadh date, served from cache when available. */
export async function getPrayerTimes(admin: any, dateISO?: string): Promise<PrayerTimes> {
  const date = dateISO || riyadhToday();

  const { data: cached } = await admin
    .from("prayer_times_cache")
    .select("*")
    .eq("prayer_date", date)
    .maybeSingle();

  if (cached?.asr) {
    return {
      fajr: cached.fajr,
      dhuhr: cached.dhuhr,
      asr: cached.asr,
      maghrib: cached.maghrib,
      isha: cached.isha,
      hijri_date: cached.hijri_date,
    };
  }

  const times = await fetchFromAladhan(date);
  // Best-effort cache write — a failure here must not break the caller.
  await admin
    .from("prayer_times_cache")
    .upsert({ prayer_date: date, ...times, fetched_at: new Date().toISOString() }, {
      onConflict: "prayer_date",
    })
    .then(undefined, (e: unknown) => console.error("prayer cache write failed", e));

  return times;
}

export interface PreparationConfig {
  base_prayer?: string | null;
  offset_minutes?: number | null;
  auto_sync_asr?: boolean | null;
}

/**
 * When the circle day starts: the configured base prayer plus its offset.
 * `auto_sync_asr` pins the base prayer to Asr regardless of `base_prayer`.
 */
export const prepStartFor = (
  config: PreparationConfig | null | undefined,
  times: PrayerTimes,
  dateISO?: string,
): Date => {
  const date = dateISO || riyadhToday();
  const key = (config?.auto_sync_asr ? "asr" : (config?.base_prayer || "asr")) as keyof PrayerTimes;
  const hhmm = (times[key] as string) || times.asr;
  const start = riyadhTimeToDate(date, hhmm);
  start.setMinutes(start.getMinutes() + (config?.offset_minutes ?? 0));
  return start;
};

/** Whole minutes elapsed since the circle day started (negative before it starts). */
export const minutesSince = (start: Date, now: Date = new Date()): number =>
  Math.floor((now.getTime() - start.getTime()) / 60000);
