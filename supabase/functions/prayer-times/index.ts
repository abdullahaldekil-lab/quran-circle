// Prayer times for the app (Attendance page, Preparation settings).
//
// Delegates to ../_shared/prayer.ts so the client and the scheduled monitors read the
// same cached values and the same coordinates — previously every request re-fetched
// from api.aladhan.com, and the monitors invoked this function on each tick.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getPrayerTimes, riyadhToday } from "../_shared/prayer.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const date = riyadhToday();
    const times = await getPrayerTimes(supabase, date);

    return new Response(JSON.stringify({ ...times, date: times.date ?? date }), {
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
