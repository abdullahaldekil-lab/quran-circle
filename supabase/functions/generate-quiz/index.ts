import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { memorizedContent, difficulty, studentName } = await req.json();

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const difficultyMap: Record<string, string> = {
      easy: "أسئلة سهلة وواضحة تناسب المبتدئين، ركّز على الآيات المشهورة وبدايات السور",
      medium: "أسئلة متوسطة الصعوبة، تشمل آيات من منتصف السور وربط بين الآيات",
      hard: "أسئلة صعبة تتطلب حفظاً متقناً، تشمل آيات متشابهة وتفاصيل دقيقة",
    };

    const prompt = `أنت معلم قرآن كريم متخصص. أنشئ 5 أسئلة اختبار شفهي للطالب "${studentName}" من المقرر المحفوظ التالي: ${memorizedContent}.

مستوى الصعوبة: ${difficultyMap[difficulty] || difficultyMap.medium}

أنواع الأسئلة المطلوبة (نوّع بينها واستخدم 5 أنواع مختلفة):
1. complete_verse: أكمل الآية — اذكر بداية آية واطلب إكمالها
2. next_verse: ما الآية التي تلي — اذكر آية واسأل عن التي بعدها
3. which_surah: في أي سورة وردت الآية — اذكر آية واسأل عن اسم سورتها
4. verse_count: عدد آيات السورة — اسأل عن عدد آيات سورة محددة من المقرر
5. surah_contains: ما اسم السورة التي تحتوي على — اذكر موضوعاً أو كلمة مميزة

مهم جداً:
- الأسئلة يجب أن تكون فقط من المقرر المحدد (${memorizedContent})
- اكتب الآيات بالرسم العثماني الصحيح
- اذكر الإجابة المتوقعة بدقة

أرجع النتيجة بصيغة JSON فقط بالشكل التالي (بدون أي نص إضافي قبله أو بعده):
{
  "questions": [
    {
      "question_number": 1,
      "question_type": "complete_verse",
      "question_text": "نص السؤال",
      "expected_answer": "الإجابة المتوقعة"
    }
  ]
}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`AI API error: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Parse JSON from response - handle markdown code blocks
    let jsonStr = content;
    const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1].trim();
    } else {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) jsonStr = jsonMatch[0];
    }

    const questions = JSON.parse(jsonStr);

    return new Response(JSON.stringify(questions), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Generate quiz error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
