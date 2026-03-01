import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Send, Search } from "lucide-react";
import huwaylanLogo from "@/assets/huwaylan-logo.jpeg";
import EnrollmentForm, { type EnrollmentFormData } from "@/components/enrollment/EnrollmentForm";
import EnrollmentStatusCheck from "@/components/enrollment/EnrollmentStatusCheck";
import EnrollmentPrintTemplate from "@/components/enrollment/EnrollmentPrintTemplate";

const Enroll = () => {
  const [view, setView] = useState<"form" | "status">("form");
  const [submittedData, setSubmittedData] = useState<EnrollmentFormData | null>(null);

  if (submittedData) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background flex items-center justify-center p-4" dir="rtl">
        <Card className="max-w-md w-full text-center">
          <CardContent className="p-8 space-y-4">
            <CheckCircle2 className="w-16 h-16 mx-auto text-green-600" />
            <h2 className="text-xl font-bold">تم إرسال الطلب بنجاح</h2>
            <p className="text-muted-foreground text-sm">
              سيتم مراجعة طلبكم من قبل إدارة المجمع والتواصل معكم قريباً إن شاء الله.
            </p>
            <EnrollmentPrintTemplate data={submittedData} />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setSubmittedData(null); setView("status"); }}>
                <Search className="w-4 h-4 ml-2" />متابعة الطلب
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => setSubmittedData(null)}>
                <Send className="w-4 h-4 ml-2" />طلب جديد
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background" dir="rtl">
      <div className="max-w-lg mx-auto p-4 py-8 space-y-5">
        {/* Header */}
        <div className="text-center space-y-3">
          <img src={huwaylanLogo} alt="مجمع حويلان" className="w-16 h-16 rounded-2xl mx-auto object-contain" />
          <h1 className="text-xl font-bold">مجمع حويلان لتحفيظ القرآن الكريم</h1>
          <p className="text-muted-foreground text-sm">استمارة تسجيل طالب جديد</p>
        </div>

        {/* Toggle */}
        <div className="flex gap-2">
          <Button variant={view === "form" ? "default" : "outline"} className="flex-1" onClick={() => setView("form")}>
            <Send className="w-4 h-4 ml-2" />تقديم طلب
          </Button>
          <Button variant={view === "status" ? "default" : "outline"} className="flex-1" onClick={() => setView("status")}>
            <Search className="w-4 h-4 ml-2" />متابعة الطلب
          </Button>
        </div>

        {view === "form" && <EnrollmentForm onSubmitted={setSubmittedData} />}
        {view === "status" && <EnrollmentStatusCheck />}

        <p className="text-center text-xs text-muted-foreground">مجمع حويلان لتحفيظ القرآن الكريم</p>
      </div>
    </div>
  );
};

export default Enroll;
