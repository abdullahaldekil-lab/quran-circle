import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Aladhan API - Umm Al-Qura method (method=4), Riyadh coordinates
    const today = new Date();
    const dateStr = `${String(today.getDate()).padStart(2, "0")}-${String(today.getMonth() + 1).padStart(2, "0")}-${today.getFullYear()}`;
    
    // Buraidah, Saudi Arabia coordinates
    const url = `https://api.aladhan.com/v1/timings/${dateStr}?latitude=26.3260&longitude=43.9750&method=4&timezonestring=Asia/Riyadh`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Aladhan API error: ${response.status}`);
    }

    const data = await response.json();
    const timings = data.data.timings;

    const prayerTimes = {
      fajr: timings.Fajr,
      dhuhr: timings.Dhuhr,
      asr: timings.Asr,
      maghrib: timings.Maghrib,
      isha: timings.Isha,
      date: data.data.date.gregorian.date,
      hijri_date: `${data.data.date.hijri.day} ${data.data.date.hijri.month.ar} ${data.data.date.hijri.year}`,
    };

    return new Response(JSON.stringify(prayerTimes), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching prayer times:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
