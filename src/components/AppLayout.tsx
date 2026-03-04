import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  ClipboardList,
  MessageSquare,
  LogOut,
  Menu,
  X,
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
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import huwaylanLogo from "@/assets/huwaylan-logo.jpeg";
import NotificationBell from "@/components/NotificationBell";

interface NavItem {
  to: string;
  icon: LucideIcon;
  label: string;
}

interface NavGroup {
  id: string;
  label: string;
  icon: LucideIcon;
  color: string;
  items: NavItem[];
}

const standaloneItems: NavItem[] = [
  { to: "/dashboard", icon: LayoutDashboard, label: "لوحة التحكم" },
];

const navGroups: NavGroup[] = [
  {
    id: "halaqat-group",
    label: "الحلقات",
    icon: BookOpen,
    color: "text-emerald-300",
    items: [
      { to: "/halaqat", icon: BookOpen, label: "حلقات التحفيظ" },
      { to: "/quran-narration", icon: ScrollText, label: "حلقات التلقين" },
    ],
  },
  {
    id: "academic",
    label: "الشؤون الأكاديمية",
    icon: School,
    color: "text-emerald-400",
    items: [
      { to: "/students", icon: Users, label: "الطلاب" },
      { to: "/inactive-students", icon: UserX, label: "طلاب غير نشطين" },
      { to: "/recitation", icon: ClipboardList, label: "التسميع" },
      { to: "/levels", icon: GraduationCap, label: "المستويات" },
      { to: "/preparation", icon: Clock, label: "وقت التحضير" },
      { to: "/madarij", icon: BookOpen, label: "برنامج مدارج" },
    ],
  },
  {
    id: "excellence",
    label: "التميز",
    icon: Trophy,
    color: "text-yellow-400",
    items: [
      { to: "/excellence", icon: Trophy, label: "مسار التميّز" },
      { to: "/excellence/tracks", icon: Award, label: "إدارة المسارات" },
      { to: "/excellence/distinguished", icon: Star, label: "الطلاب المميزون" },
      { to: "/excellence/track-settings", icon: Settings, label: "إعدادات المسارات" },
    ],
  },
  {
    id: "attendance",
    label: "الحضور والانضباط",
    icon: CheckSquare,
    color: "text-sky-400",
    items: [
      { to: "/attendance", icon: CheckSquare, label: "الحضور" },
      { to: "/attendance-audit", icon: ClipboardList, label: "سجل التدقيق" },
      { to: "/academic-calendar", icon: CalendarDays, label: "التقويم الأكاديمي" },
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
      { to: "/instructions", icon: MessageSquare, label: "التعليمات" },
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
    id: "enrollment",
    label: "القبول والتسجيل",
    icon: UserPlus,
    color: "text-rose-400",
    items: [
      { to: "/pre-registration", icon: UserCog, label: "التسجيل المسبق" },
      { to: "/enrollment-requests", icon: ClipboardList, label: "طلبات الالتحاق" },
      { to: "/bulk-import", icon: Upload, label: "إضافة جماعية" },
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
      { to: "/notification-log", icon: ClipboardList, label: "سجل الإشعارات" },
      { to: "/notification-preferences", icon: CheckSquare, label: "تفضيلات الإشعارات" },
      { to: "/send-notification", icon: Send, label: "إرسال إشعار" },
      { to: "/bulk-email", icon: Mail, label: "بريد جماعي" },
      { to: "/profile", icon: UserCog, label: "الملف الشخصي" },
    ],
  },
];

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const { profile, signOut } = useAuth();
  const { hasAccess } = useRole();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  // Determine which groups are open based on active route
  const getInitialOpenGroups = () => {
    const open: Record<string, boolean> = {};
    navGroups.forEach((group) => {
      if (group.items.some((item) => location.pathname.startsWith(item.to))) {
        open[group.id] = true;
      }
    });
    return open;
  };

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(getInitialOpenGroups);

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredStandalone = standaloneItems.filter((item) => hasAccess(item.to));

  const filteredGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => hasAccess(item.to)),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <div className="min-h-screen flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-foreground/30 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 h-screen w-64 gradient-sidebar z-50 transition-transform duration-300 flex flex-col ${
          sidebarOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="p-6 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <img src={huwaylanLogo} alt="مجمع حويلان" className="w-10 h-10 rounded-xl object-contain" />
            <div>
              <h2 className="font-bold text-sidebar-foreground">مجمع حويلان</h2>
              <p className="text-xs text-sidebar-foreground/70">تحفيظ القرآن</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {/* Standalone items */}
          {filteredStandalone.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </NavLink>
          ))}

          {/* Grouped items */}
          {filteredGroups.map((group) => {
            const isOpen = openGroups[group.id] || false;
            const hasActiveChild = group.items.some((item) =>
              location.pathname.startsWith(item.to)
            );

            return (
              <div key={group.id}>
                <button
                  onClick={() => toggleGroup(group.id)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    hasActiveChild
                      ? "bg-sidebar-accent/60 text-sidebar-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/30 hover:text-sidebar-foreground"
                  }`}
                >
                  <group.icon className={`w-5 h-5 ${group.color} shrink-0`} />
                  <span className="flex-1 text-right">{group.label}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-sidebar-foreground/50 transition-transform duration-200 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="mt-0.5 mr-4 border-r border-sidebar-border/40 pr-2 space-y-0.5">
                    {group.items.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        onClick={() => setSidebarOpen(false)}
                        className={({ isActive }) =>
                          `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                            isActive
                              ? "bg-sidebar-accent text-sidebar-primary font-medium"
                              : "text-sidebar-foreground/65 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground"
                          }`
                        }
                      >
                        <item.icon className="w-4 h-4" />
                        {item.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 mb-3 px-2">
            <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center text-sidebar-foreground text-sm font-bold">
              {profile?.full_name?.[0] || "م"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {profile?.full_name || "مستخدم"}
              </p>
              <p className="text-xs text-sidebar-foreground/60 truncate">
                {profile?.position_title || profile?.role || ""}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
            onClick={signOut}
          >
            <LogOut className="w-4 h-4 ml-2" />
            تسجيل الخروج
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-h-screen">
        {/* Mobile header */}
        <header className="lg:hidden sticky top-0 z-30 bg-background/95 backdrop-blur border-b px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={huwaylanLogo} alt="مجمع حويلان" className="w-8 h-8 rounded-lg object-contain" />
            <span className="font-bold text-foreground">مجمع حويلان</span>
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </header>

        {/* Desktop notification bell */}
        <div className="hidden lg:flex justify-end p-4 pb-0">
          <NotificationBell />
        </div>

        <div className="p-4 lg:p-8">{children}</div>
      </main>
    </div>
  );
};

export default AppLayout;
