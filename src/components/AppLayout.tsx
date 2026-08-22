import { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import GlobalSearch from "@/components/GlobalSearch";
import OnboardingTour from "@/components/OnboardingTour";
import PageDateHeader from "@/components/PageDateHeader";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  ClipboardList,
  ClipboardCheck,
  ClipboardSignature,
  HeartHandshake,
  FileText,
  History,
  MessageSquare,
  LogOut,
  Menu,
  X,
  Search,
  CheckSquare,
  Upload,
  GraduationCap,
  Trophy,
  Gift,
  Bus as BusIcon,
  DollarSign,
  Target,
  BarChart3,
  Settings,
  UserCog,
  FolderOpen,
  Clock,
  CalendarDays,
  ChevronDown,
  School,
  Award,
  Briefcase,
  UserPlus,
  ShieldCheck,
  ScrollText,
  Send,
  Mail,
  Star,
  UserX,
  QrCode,
  Brain,
  type LucideIcon,
  Sun,
  Library,
  FileSpreadsheet,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import huwaylanLogo from "@/assets/huwaylan-logo.jpeg";
import NotificationBell from "@/components/NotificationBell";
import { combinedBadgeCount, combinedBadgeTitle } from "@/lib/workHub";

interface NavItem {
  to: string;
  icon: LucideIcon;
  label: string;
}

interface SubGroup {
  id: string;
  label: string;
  icon: LucideIcon;
  items: NavItem[];
}

interface NavGroup {
  id: string;
  label: string;
  icon: LucideIcon;
  color: string;
  items: NavItem[];
  subGroups?: SubGroup[];
}

const standaloneItems: NavItem[] = [
  { to: "/dashboard", icon: LayoutDashboard, label: "لوحة التحكم" },
  { to: "/work-hub", icon: Target, label: "المهام والطلبات" },
];

const navGroups: NavGroup[] = [
  {
    id: "admin-affairs",
    label: "الشؤون الإدارية",
    icon: Briefcase,
    color: "text-sky-400",
    items: [
      { to: "/admin-dashboard", icon: LayoutDashboard, label: "لوحة الشؤون الإدارية" },
      { to: "/students", icon: Users, label: "الطلاب" },
      { to: "/inactive-students", icon: UserX, label: "الطلاب المنقطعون" },
      { to: "/halaqat", icon: BookOpen, label: "الحلقات" },
      { to: "/attendance", icon: CheckSquare, label: "الحضور" },
      { to: "/attendance-audit", icon: ClipboardList, label: "سجل التدقيق" },
      { to: "/student-attendance-report", icon: BarChart3, label: "تقرير حضور الطلاب" },
      { to: "/staff-attendance", icon: CheckSquare, label: "حضور العاملين" },
      { to: "/staff-attendance-log", icon: ClipboardList, label: "سجل حضور العاملين" },
      { to: "/student-portal", icon: QrCode, label: "بوابة الطالب" },
    ],
    subGroups: [
      {
        id: "enrollment-sub",
        label: "القبول والتسجيل",
        icon: UserPlus,
        items: [
          { to: "/pre-registration", icon: UserCog, label: "التسجيل المسبق" },
          { to: "/enrollment-requests", icon: ClipboardList, label: "طلبات الالتحاق" },
          { to: "/bulk-import", icon: Upload, label: "إضافة جماعية" },
        ],
      },
      {
        id: "messages-sub",
        label: "الرسائل",
        icon: MessageSquare,
        items: [
          { to: "/admin/guardian-messages", icon: MessageSquare, label: "رسائل أولياء الأمور" },
          { to: "/admin/guardian-whatsapp", icon: MessageSquare, label: "إرسال واتساب جماعي" },
          { to: "/send-notification", icon: Send, label: "إرسال إشعار" },
          { to: "/bulk-email", icon: Mail, label: "بريد جماعي" },
          { to: "/notification-log", icon: ClipboardList, label: "سجل الإشعارات" },
        ],
      },
    ],
  },
  {
    id: "academic",
    label: "الشؤون الأكاديمية",
    icon: School,
    color: "text-emerald-400",
    items: [
      { to: "/halaqat", icon: BookOpen, label: "حلقات التحفيظ" },
      { to: "/recitation", icon: ClipboardList, label: "التسميع" },
      { to: "/levels", icon: GraduationCap, label: "المستويات" },
      { to: "/quran-narration", icon: ScrollText, label: "يوم السرد" },
      { to: "/narration-test", icon: ScrollText, label: "اختبار السرد" },
      { to: "/review-test", icon: ClipboardList, label: "اختبار المراجعة" },
      { to: "/narration-stats", icon: CalendarDays, label: "إحصائيات السرد" },
      { to: "/nazem-export", icon: FileSpreadsheet, label: "تصدير لناظم" },
      { to: "/instructions", icon: MessageSquare, label: "التعليمات" },
      { to: "/summer-programs", icon: Sun, label: "البرامج الصيفية" },
      { to: "/narration-test-settings", icon: Settings, label: "إعدادات اختبار السرد" },
    ],
    subGroups: [
      {
        id: "madarij-sub",
        label: "برنامج مدارج",
        icon: BookOpen,
        items: [
          { to: "/madarij", icon: BookOpen, label: "برنامج مدارج" },
          { to: "/madarij-report", icon: BarChart3, label: "تقارير مدارج" },
        ],
      },
      {
        id: "excellence-sub",
        label: "مسار التميّز",
        icon: Trophy,
        items: [
          { to: "/excellence", icon: Trophy, label: "مسار التميّز" },
          { to: "/excellence/tracks", icon: Award, label: "إدارة المسارات" },
          { to: "/excellence/distinguished", icon: Star, label: "الطلاب المميزون" },
          { to: "/excellence/track-settings", icon: Settings, label: "إعدادات المسارات" },
          { to: "/excellence-comparison", icon: Trophy, label: "مقارنة المتميزين" },
        ],
      },
      {
        id: "tests-subgroup",
        label: "الاختبارات",
        icon: ClipboardList,
        items: [
          { to: "/student-quiz", icon: GraduationCap, label: "الاختبار الذكي" },
          { to: "/program-quiz", icon: Brain, label: "اختبارات البرامج" },
        ],
      },
      {
        id: "results-subgroup",
        label: "النتائج والتقارير",
        icon: BarChart3,
        items: [
          { to: "/quiz-results", icon: BarChart3, label: "نتائج الاختبار" },
          { to: "/quiz-comparison", icon: Trophy, label: "مقارنة الحلقات" },
        ],
      },
    ],
  },
  {
    id: "talqeen",
    label: "حلقات التلقين",
    icon: ScrollText,
    color: "text-lime-300",
    items: [
      { to: "/talqeen-halaqat", icon: ScrollText, label: "حلقات التلقين" },
      { to: "/talqeen-programs", icon: BookOpen, label: "برامج التلقين" },
      { to: "/talqeen-curricula", icon: ScrollText, label: "مناهج التلقين" },
      { to: "/talqeen-supervisor", icon: LayoutDashboard, label: "متابعة التلقين" },
    ],
  },
  {
    id: "program-supervision",
    label: "إشراف البرنامج",
    icon: Library,
    color: "text-indigo-300",
    items: [
      { to: "/programs-overview", icon: LayoutDashboard, label: "إشراف البرامج" },
      { to: "/program-materials", icon: Library, label: "مواد البرامج" },
      { to: "/tarbawi-programs", icon: HeartHandshake, label: "البرامج التربوية" },
      { to: "/tarbawi-follow-up", icon: ClipboardCheck, label: "متابعة البرامج" },
      { to: "/tarbawi-exams", icon: ClipboardList, label: "اختبارات البرامج" },
      { to: "/tarbawi-leaderboard", icon: Trophy, label: "لوحة الصدارة" },
      { to: "/tarbawi-reports", icon: FileText, label: "التقارير التربوية" },
      { to: "/tarbawi-surveys", icon: ClipboardSignature, label: "استبيانات الأثر" },
      { to: "/tarbawi-calendar", icon: CalendarDays, label: "تقويم البرامج" },
      { to: "/tarbawi-practice-quiz", icon: Sparkles, label: "اختبارات تجريبية ذكية" },
      { to: "/tarbawi-history", icon: History, label: "السجل التربوي" },
    ],
  },
  {
    id: "calendar",
    label: "التقويم والتحضير",
    icon: CalendarDays,
    color: "text-blue-300",
    items: [
      { to: "/academic-calendar", icon: CalendarDays, label: "التقويم الأكاديمي" },
      { to: "/preparation", icon: Clock, label: "وقت التحضير" },
    ],
  },
  {
    id: "rewards",
    label: "التحفيز والمكافآت",
    icon: Award,
    color: "text-amber-400",
    items: [
      { to: "/rankings", icon: Trophy, label: "الترتيب" },
      { to: "/rewards", icon: Gift, label: "الحوافز" },
    ],
  },
  {
    id: "operations",
    label: "العمليات والخدمات",
    icon: Briefcase,
    color: "text-violet-400",
    items: [
      { to: "/trips", icon: BusIcon, label: "الرحلات" },
      { to: "/buses", icon: BusIcon, label: "الباصات" },
      { to: "/documents", icon: FolderOpen, label: "المستندات" },
    ],
  },
  {
    id: "finance",
    label: "المالية والتخطيط",
    icon: DollarSign,
    color: "text-teal-400",
    items: [
      { to: "/finance", icon: DollarSign, label: "المالية" },
      { to: "/strategic-plan", icon: Target, label: "الخطة الاستراتيجية" },
      { to: "/kpi-dashboard", icon: BarChart3, label: "مؤشرات الأداء" },
    ],
  },
  {
    id: "staff-affairs",
    label: "شؤون الموظفين",
    icon: Users,
    color: "text-cyan-400",
    items: [
      { to: "/staff-attendance", icon: CheckSquare, label: "حضور العاملين" },
      { to: "/staff-attendance-log", icon: ClipboardList, label: "سجل الحضور" },
      { to: "/staff-shifts", icon: Clock, label: "جداول الدوام" },
      { to: "/staff-qr-management", icon: ShieldCheck, label: "نقاط بصمة QR" },
      { to: "/staff-qr-checkin", icon: CheckSquare, label: "بصمة الحضور (QR)" },
    ],
  },
  {
    id: "admin",
    label: "الإدارة والإعدادات",
    icon: ShieldCheck,
    color: "text-orange-400",
    items: [
      { to: "/user-management", icon: Settings, label: "إدارة المستخدمين" },
      { to: "/permissions-management", icon: ShieldCheck, label: "إدارة الصلاحيات" },
      { to: "/notification-templates", icon: MessageSquare, label: "قوالب الإشعارات" },
      { to: "/notification-preferences", icon: CheckSquare, label: "تفضيلات الإشعارات" },
      { to: "/profile", icon: UserCog, label: "الملف الشخصي" },
    ],
  },
];

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const { profile, signOut } = useAuth();
  const { hasAccess, role } = useRole();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [urgentTasksCount, setUrgentTasksCount] = useState(0);
  const location = useLocation();

  // Ctrl+K shortcut for global search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (!profile?.id) return;
    const fetchPending = async () => {
      const { count } = await supabase
        .from("internal_requests")
        .select("id", { count: "exact", head: true })
        .or(`to_user_id.eq.${profile.id},to_role.eq.${role}`)
        .in("status", ["new", "in_progress"]);
      setPendingRequestsCount(count || 0);
    };
    fetchPending();
  }, [profile?.id, role, location.pathname]);

  // Fetch urgent pending tasks count
  useEffect(() => {
    if (!profile?.id) return;
    const fetchUrgentTasks = async () => {
      const { count } = await supabase
        .from("staff_tasks")
        .select("id", { count: "exact", head: true })
        .or(`assigned_to.eq.${profile.id},assigned_to_role.eq.${role}`)
        .in("status", ["pending", "in_progress", "overdue"])
        .eq("priority", "عاجل");
      setUrgentTasksCount(count || 0);
    };
    fetchUrgentTasks();

    // Realtime subscription for urgent tasks count
    const channel = supabase
      .channel("urgent-tasks-sidebar")
      .on("postgres_changes", { event: "*", schema: "public", table: "staff_tasks" }, () => {
        fetchUrgentTasks();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profile?.id, role]);
  // Determine which groups are open based on active route
  const getInitialOpenGroups = () => {
    const open: Record<string, boolean> = {};
    navGroups.forEach((group) => {
      const hasActiveItem = group.items.some((item) => location.pathname.startsWith(item.to));
      const hasActiveSubGroup = group.subGroups?.some((sub) =>
        sub.items.some((item) => location.pathname.startsWith(item.to))
      );
      if (hasActiveItem || hasActiveSubGroup) {
        open[group.id] = true;
      }
      // Also open subgroups that have active items
      group.subGroups?.forEach((sub) => {
        if (sub.items.some((item) => location.pathname.startsWith(item.to))) {
          open[sub.id] = true;
        }
      });
    });
    return open;
  };

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(getInitialOpenGroups);

  // Auto-expand groups & subgroups when route changes
  useEffect(() => {
    setOpenGroups(getInitialOpenGroups());
  }, [location.pathname]);

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredStandalone = standaloneItems.filter((item) => hasAccess(item.to));

  const filteredGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => hasAccess(item.to)),
      subGroups: group.subGroups?.map((sub) => ({
        ...sub,
        items: sub.items.filter((item) => hasAccess(item.to)),
      })).filter((sub) => sub.items.length > 0),
    }))
    .filter((group) => group.items.length > 0 || (group.subGroups && group.subGroups.length > 0));

  return (
    <div className="min-h-dvh flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-foreground/30 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 h-dvh w-68 gradient-sidebar z-50 transition-transform duration-300 flex flex-col shadow-2xl border-l border-sidebar-border ${
          sidebarOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="p-5 border-b border-sidebar-border/80 bg-black/10">
          <div className="flex items-center gap-3">
            <div className="relative p-0.5 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 shadow-md">
              <img src={huwaylanLogo} alt="مجمع حويلان" className="w-11 h-11 rounded-[10px] object-cover bg-white" />
            </div>
            <div>
              <h2 className="font-bold text-base text-sidebar-foreground font-cairo tracking-wide">مجمع حويلان</h2>
              <p className="text-[11px] text-amber-300/90 font-amiri font-medium">لتحفيظ القرآن الكريم</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto custom-scrollbar">
          {/* Global Search Button */}
          <button
            onClick={() => setSearchOpen(true)}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground transition-all duration-200 mb-2 border border-sidebar-border/50 bg-white/5 shadow-sm"
          >
            <Search className="w-4 h-4 text-amber-400" />
            <span className="flex-1 text-right text-xs">البحث الشامل...</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-sidebar-accent/80 text-amber-300 font-mono">⌘K</span>
          </button>
          {/* Standalone items */}
          {filteredStandalone.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-gradient-to-l from-sidebar-accent to-sidebar-accent/60 text-amber-300 font-bold border-r-4 border-amber-400 shadow-sm"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground"
                }`
              }
            >
              <item.icon className="w-4 h-4" />
              <span className="flex-1">{item.label}</span>
              {item.to === "/work-hub" && combinedBadgeCount(pendingRequestsCount, urgentTasksCount) > 0 && (
                <span
                  className="bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center animate-pulse"
                  title={combinedBadgeTitle(pendingRequestsCount, urgentTasksCount)}
                >
                  {combinedBadgeCount(pendingRequestsCount, urgentTasksCount) > 9
                    ? "9+"
                    : combinedBadgeCount(pendingRequestsCount, urgentTasksCount)}
                </span>
              )}
            </NavLink>
          ))}

          {/* Grouped items */}
          {filteredGroups.map((group) => {
            const isOpen = openGroups[group.id] || false;
            const hasActiveChild = group.items.some((item) =>
              location.pathname.startsWith(item.to)
            ) || group.subGroups?.some((sub) =>
              sub.items.some((item) => location.pathname.startsWith(item.to))
            );

            return (
              <div key={group.id} className="pt-0.5">
                <button
                  onClick={() => toggleGroup(group.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                    hasActiveChild
                      ? "bg-sidebar-accent/70 text-sidebar-foreground font-semibold"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/30 hover:text-sidebar-foreground"
                  }`}
                >
                  <group.icon className={`w-4 h-4 ${group.color} shrink-0`} />
                  <span className="flex-1 text-right text-xs sm:text-sm">{group.label}</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-sidebar-foreground/50 transition-transform duration-200 ${
                      isOpen ? "rotate-180 text-amber-400" : ""
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="mt-1 mr-3.5 border-r-2 border-amber-500/30 pr-2 space-y-0.5">
                    {/* Regular items */}
                    {group.items.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        onClick={() => setSidebarOpen(false)}
                        className={({ isActive }) =>
                          `flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs sm:text-sm transition-all duration-150 ${
                            isActive
                              ? "bg-sidebar-accent text-amber-300 font-bold shadow-xs border-r-2 border-amber-400"
                              : "text-sidebar-foreground/65 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground"
                          }`
                        }
                      >
                        <item.icon className="w-3.5 h-3.5" />
                        <span className="flex-1">{item.label}</span>
                        {item.to === "/work-hub" && combinedBadgeCount(pendingRequestsCount, urgentTasksCount) > 0 && (
                          <span
                            className="bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center animate-pulse"
                            title={combinedBadgeTitle(pendingRequestsCount, urgentTasksCount)}
                          >
                            {combinedBadgeCount(pendingRequestsCount, urgentTasksCount) > 9
                              ? "9+"
                              : combinedBadgeCount(pendingRequestsCount, urgentTasksCount)}
                          </span>
                        )}
                      </NavLink>
                    ))}

                    {/* Sub-groups (nested accordions) */}
                    {group.subGroups?.map((subGroup) => {
                      const isSubOpen = openGroups[subGroup.id] || false;
                      const hasActiveSubChild = subGroup.items.some((item) =>
                        location.pathname.startsWith(item.to)
                      );

                      return (
                        <div key={subGroup.id} className="pt-0.5">
                          <button
                            onClick={() => toggleGroup(subGroup.id)}
                            className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                              hasActiveSubChild
                                ? "bg-sidebar-accent/60 text-sidebar-foreground font-semibold"
                                : "text-sidebar-foreground/60 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground"
                            }`}
                          >
                            <subGroup.icon className="w-3.5 h-3.5" />
                            <span className="flex-1 text-right">{subGroup.label}</span>
                            <ChevronDown
                              className={`w-3 h-3 text-sidebar-foreground/50 transition-transform duration-200 ${
                                isSubOpen ? "rotate-180" : ""
                              }`}
                            />
                          </button>

                          {isSubOpen && (
                            <div className="mt-0.5 mr-2.5 border-r border-amber-500/20 pr-1.5 space-y-0.5">
                              {subGroup.items.map((item) => (
                                <NavLink
                                  key={item.to}
                                  to={item.to}
                                  onClick={() => setSidebarOpen(false)}
                                  className={({ isActive }) =>
                                    `flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs transition-colors ${
                                      isActive
                                        ? "bg-sidebar-accent text-amber-300 font-bold"
                                        : "text-sidebar-foreground/60 hover:bg-sidebar-accent/30 hover:text-sidebar-foreground"
                                    }`
                                  }
                                >
                                  <item.icon className="w-3 h-3" />
                                  <span>{item.label}</span>
                                </NavLink>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="p-3.5 border-t border-sidebar-border/80 bg-black/15">
          <div className="flex items-center gap-2.5 mb-2.5 px-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center text-white text-sm font-bold shadow-sm">
              {profile?.full_name?.[0] || "م"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-sidebar-foreground truncate">
                {profile?.full_name || "مستخدم"}
              </p>
              <p className="text-[11px] text-amber-200/70 truncate">
                {profile?.position_title || profile?.role || ""}
              </p>
            </div>
            <NotificationBell />
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-sidebar-foreground/75 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 text-xs rounded-xl"
            onClick={signOut}
          >
            <LogOut className="w-3.5 h-3.5 ml-2 text-rose-400" />
            تسجيل الخروج
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-h-dvh flex flex-col bg-islamic-pattern">
        {/* Mobile header */}
        <header className="lg:hidden sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border/70 px-4 py-2.5 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5">
            <img src={huwaylanLogo} alt="مجمع حويلان" className="w-8 h-8 rounded-lg object-contain border border-amber-400/40" />
            <span className="font-bold text-foreground font-cairo text-sm">مجمع حويلان</span>
          </div>
          <div className="flex items-center gap-1.5">
            <NotificationBell />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label={sidebarOpen ? "إغلاق القائمة" : "فتح القائمة"}
              aria-expanded={sidebarOpen}
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </header>

        {/* Desktop Top Header Bar with Islamic Hijri pill */}
        <header className="hidden lg:flex items-center justify-between px-8 py-3.5 border-b border-border/60 bg-background/80 backdrop-blur-md sticky top-0 z-20 shadow-xs">
          <div className="flex items-center gap-3">
            <PageDateHeader />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-border bg-card/80 hover:bg-card text-xs text-muted-foreground transition-all shadow-xs"
            >
              <Search className="w-3.5 h-3.5 text-amber-500" />
              <span>بحث سريع...</span>
              <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono text-muted-foreground">⌘K</kbd>
            </button>
            <NotificationBell />
          </div>
        </header>

        <div className="p-4 lg:p-8 flex-1">{children}</div>
      </main>
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
      <OnboardingTour />
    </div>
  );
};

export default AppLayout;
