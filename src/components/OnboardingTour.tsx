import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { useNavigate } from "react-router-dom";
import { LayoutDashboard, Users, BookOpen, ClipboardList, Trophy, GraduationCap, BarChart3, MessageSquare, ChevronRight, ChevronLeft, X } from "lucide-react";

interface Step {
  title: string;
  description: string;
  icon: any;
  route?: string;
  roles?: string[]; // restrict to these roles; undefined = all
}

const ALL_STEPS: Step[] = [
  {
    title: "مرحباً بك في منصة حلقات حويلان",
    description: "هذه جولة سريعة للتعرف على أهم الأقسام في النظام. يمكنك تخطيها في أي وقت والعودة لها لاحقاً من إعدادات الحساب.",
    icon: LayoutDashboard,
  },
  {
    title: "لوحة التحكم الرئيسية",
    description: "تعرض لك ملخصاً شاملاً عن الحلقات، الطلاب، الحضور، ومؤشرات الأداء الرئيسية في مكان واحد.",
    icon: LayoutDashboard,
    route: "/dashboard",
  },
  {
    title: "إدارة الطلاب والحلقات",
    description: "من هنا يمكنك إضافة الطلاب، توزيعهم على الحلقات، ومتابعة بياناتهم وحالتهم الدراسية.",
    icon: Users,
    route: "/students",
    roles: ["manager", "secretary", "supervisor", "admin_staff"],
  },
  {
    title: "إدخال التسميع",
    description: "ثلاث بطاقات منفصلة: الحفظ الجديد، المراجعة، والربط — مع تصنيف للأخطاء (لحن جلي/خفي/تردد/نسيان).",
    icon: BookOpen,
    route: "/recitation",
    roles: ["manager", "supervisor", "teacher", "assistant_teacher"],
  },
  {
    title: "تسجيل الحضور",
    description: "سجّل حضور الطلاب يومياً (حاضر، غائب، متأخر، مستأذن). تظهر التنبيهات تلقائياً عند تكرار الغياب.",
    icon: ClipboardList,
    route: "/attendance",
  },
  {
    title: "نظام التميز",
    description: "متابعة جلسات الطلاب المتميزين، تقييم أدائهم، وإصدار تقارير شهرية مع مقارنة بين الطلاب.",
    icon: Trophy,
    route: "/excellence",
    roles: ["manager", "supervisor", "teacher"],
  },
  {
    title: "اختبار السرد والمراجعة",
    description: "نظام موحد للاختبارات الدورية مع توثيق النتائج، تتبع المحاولات، وطباعة التقارير.",
    icon: GraduationCap,
    route: "/narration-test",
    roles: ["manager", "supervisor", "teacher"],
  },
  {
    title: "مؤشرات الأداء",
    description: "لوحة شاملة لمتابعة أداء الحلقات والمعلمين، مع تقارير مرئية وإحصائيات مفصلة.",
    icon: BarChart3,
    route: "/kpi-dashboard",
    roles: ["manager", "supervisor"],
  },
  {
    title: "الإشعارات والمراسلات",
    description: "نظام مراسلات داخلية، إشعارات لحظية، وتنبيهات WhatsApp لأولياء الأمور.",
    icon: MessageSquare,
    route: "/internal-requests",
  },
];

const ONBOARDING_KEY = "onboarding-completed-v1";

const OnboardingTour = () => {
  const { user } = useAuth();
  const { role } = useRole();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(0);

  // Filter steps by role
  const steps = ALL_STEPS.filter((s) => !s.roles || s.roles.includes(role));

  useEffect(() => {
    if (!user) return;
    const completed = localStorage.getItem(`${ONBOARDING_KEY}-${user.id}`);
    if (!completed) {
      const timer = setTimeout(() => setOpen(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [user]);

  const finish = () => {
    if (user) localStorage.setItem(`${ONBOARDING_KEY}-${user.id}`, new Date().toISOString());
    setOpen(false);
    setCurrent(0);
  };

  const next = () => {
    const step = steps[current];
    if (step.route) navigate(step.route);
    if (current < steps.length - 1) setCurrent((c) => c + 1);
    else finish();
  };

  const prev = () => setCurrent((c) => Math.max(0, c - 1));

  if (!steps.length) return null;
  const step = steps[current];
  const Icon = step.icon;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && finish()}>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Icon className="w-6 h-6 text-primary" />
            </div>
            <div className="flex gap-1">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 w-6 rounded-full transition-colors ${i === current ? "bg-primary" : i < current ? "bg-primary/50" : "bg-muted"}`}
                />
              ))}
            </div>
          </div>
          <DialogTitle className="text-right text-lg pt-3">{step.title}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground leading-relaxed text-right">{step.description}</p>
        <DialogFooter className="flex-row justify-between gap-2 sm:justify-between">
          <Button variant="ghost" size="sm" onClick={finish}>
            <X className="w-4 h-4 ml-1" />
            تخطّي الجولة
          </Button>
          <div className="flex gap-2">
            {current > 0 && (
              <Button variant="outline" size="sm" onClick={prev}>
                <ChevronRight className="w-4 h-4" />
                السابق
              </Button>
            )}
            <Button size="sm" onClick={next}>
              {current < steps.length - 1 ? "التالي" : "ابدأ الآن"}
              {current < steps.length - 1 && <ChevronLeft className="w-4 h-4" />}
            </Button>
          </div>
        </DialogFooter>
        <p className="text-xs text-center text-muted-foreground">
          الخطوة {current + 1} من {steps.length}
        </p>
      </DialogContent>
    </Dialog>
  );
};

export default OnboardingTour;
