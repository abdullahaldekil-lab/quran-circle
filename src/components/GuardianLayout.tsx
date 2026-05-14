import { useState } from "react";
import { NavLink } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard, LogOut, Menu, X, MessageSquare, CalendarOff,
  Star, Settings, UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import huwaylanLogo from "@/assets/huwaylan-logo.jpeg";
import GuardianNotificationBell from "@/components/GuardianNotificationBell";

interface GuardianLayoutProps {
  children: React.ReactNode;
  guardianName?: string;
}

const navItems = [
  { to: "/guardian", label: "الرئيسية", icon: LayoutDashboard },
  { to: "/guardian/link-request", label: "إضافة ابن", icon: UserPlus },
  { to: "/guardian/messages", label: "الرسائل", icon: MessageSquare },
  { to: "/guardian/excuses", label: "الاستئذان المسبق", icon: CalendarOff },
  { to: "/guardian/evaluation", label: "تقييم المعلم", icon: Star },
  { to: "/guardian/settings", label: "الإعدادات", icon: Settings },
];

const GuardianLayout = ({ children, guardianName }: GuardianLayoutProps) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const handleSignOut = async () => { await supabase.auth.signOut(); };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-card/95 backdrop-blur border-b px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={huwaylanLogo} alt="شعار مجمع حويلان لتحفيظ القرآن الكريم" className="w-9 h-9 rounded-lg object-contain" />
            <div>
              <span className="font-bold text-foreground text-sm">بوابة ولي الأمر</span>
              {guardianName && <p className="text-xs text-muted-foreground">{guardianName}</p>}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <GuardianNotificationBell />
            <Button
              variant="ghost" size="icon" onClick={() => setMenuOpen(!menuOpen)} className="h-9 w-9"
              aria-label={menuOpen ? "إغلاق القائمة" : "فتح القائمة"} aria-expanded={menuOpen}
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        {menuOpen && (
          <div className="max-w-2xl mx-auto mt-2 border rounded-lg bg-card p-2 space-y-1">
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to} to={to} end={to === "/guardian"}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                    isActive ? "bg-primary/10 text-primary font-medium" : "text-foreground hover:bg-muted"
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                {label}
              </NavLink>
            ))}
            <button
              onClick={handleSignOut}
              className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-destructive hover:bg-destructive/10 w-full transition-colors"
            >
              <LogOut className="w-4 h-4" />
              تسجيل الخروج
            </button>
          </div>
        )}
      </header>

      <main className="max-w-2xl mx-auto p-4 pb-8">{children}</main>
    </div>
  );
};

export default GuardianLayout;
