import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { content, quizType, count } = await req.json();
    const safeContent = (content || "القيم الإسلامية والأخلاق القرآنية").toString().slice(0, 4000);
    const n = Math.min(Math.max(parseInt(count) || 5, 3), 10);

    const prompt = quizType === "essay"
      ? `أنت معلم قرآن كريم. من المحتوى التالي:\n"${safeContent}"\nأنشئ ${n} أسئلة مقالية قصيرة باللغة العربية للطلاب.\nأعد JSON فقط بهذا الشكل بدون أي نص إضافي ولا أكواد markdown:\n[{"question":"...","model_answer":"..."}]`
      : `أنت معلم قرآن كريم. من المحتوى التالي:\n"${safeContent}"\nأنشئ ${n} أسئلة اختيار من متعدد باللغة العربية للطلاب، كل سؤال له 4 خيارات وإجابة صحيحة واحدة.\nأعد JSON فقط بهذا الشكل بدون أي نص إضافي ولا أكواد markdown:\n[{"question":"...","options":["...","...","...","..."],"correct_index":0}]`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": LOVABLE_API_KEY,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (aiRes.status === 429) {
      return new Response(JSON.stringify({ error: "تم تجاوز حد الطلبات. حاول لاحقاً." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiRes.status === 402) {
      return new Response(JSON.stringify({ error: "الرصيد غير كافٍ. أضف رصيداً للذكاء الاصطناعي." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!aiRes.ok) {
      const t = await aiRes.text();
      return new Response(JSON.stringify({ error: `AI error ${aiRes.status}: ${t.slice(0, 200)}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiRes.json();
    const text: string = data?.choices?.[0]?.message?.content || "[]";
    const cleaned = text.replace(/```json|```/g, "").trim();

    let questions: any[] = [];
    try {
      questions = JSON.parse(cleaned);
    } catch {
      const m = cleaned.match(/\[[\s\S]*\]/);
      if (m) {
        try { questions = JSON.parse(m[0]); } catch { questions = []; }
      }
    }

    return new Response(JSON.stringify({ questions }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
