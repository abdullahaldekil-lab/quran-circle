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
  Bus,
  DollarSign,
  Target,
  BarChart3,
  Settings,
  UserCog,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import huwaylanLogo from "@/assets/huwaylan-logo.jpeg";

const allNavItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "لوحة التحكم" },
  { to: "/students", icon: Users, label: "الطلاب" },
  { to: "/halaqat", icon: BookOpen, label: "الحلقات" },
  { to: "/recitation", icon: ClipboardList, label: "التسميع" },
  { to: "/attendance", icon: CheckSquare, label: "الحضور" },
  { to: "/instructions", icon: MessageSquare, label: "التعليمات" },
  { to: "/levels", icon: GraduationCap, label: "المستويات" },
  { to: "/rankings", icon: Trophy, label: "الترتيب" },
  { to: "/rewards", icon: Gift, label: "الحوافز" },
  { to: "/trips", icon: Bus, label: "الرحلات" },
  { to: "/finance", icon: DollarSign, label: "المالية" },
  { to: "/strategic-plan", icon: Target, label: "الخطة الاستراتيجية" },
  { to: "/kpi-dashboard", icon: BarChart3, label: "مؤشرات الأداء" },
  { to: "/bulk-import", icon: Upload, label: "إضافة جماعية" },
  { to: "/user-management", icon: Settings, label: "إدارة المستخدمين" },
  { to: "/profile", icon: UserCog, label: "الملف الشخصي" },
];

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const { profile, signOut } = useAuth();
  const { hasAccess } = useRole();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const navItems = allNavItems.filter((item) => hasAccess(item.to));

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

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
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
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </header>

        <div className="p-4 lg:p-8">{children}</div>
      </main>
    </div>
  );
};

export default AppLayout;
