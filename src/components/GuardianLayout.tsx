import { useState } from "react";
import { NavLink } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard,
  LogOut,
  Menu,
  X,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface GuardianLayoutProps {
  children: React.ReactNode;
  guardianName?: string;
}

const GuardianLayout = ({ children, guardianName }: GuardianLayoutProps) => {
  const [menuOpen, setMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-card/95 backdrop-blur border-b px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg gradient-gold flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <span className="font-bold text-foreground text-sm">بوابة ولي الأمر</span>
              {guardianName && (
                <p className="text-xs text-muted-foreground">{guardianName}</p>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMenuOpen(!menuOpen)}
            className="h-9 w-9"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>

        {/* Dropdown menu */}
        {menuOpen && (
          <div className="max-w-2xl mx-auto mt-2 border rounded-lg bg-card p-2 space-y-1">
            <NavLink
              to="/guardian"
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive ? "bg-primary/10 text-primary font-medium" : "text-foreground hover:bg-muted"
                }`
              }
            >
              <LayoutDashboard className="w-4 h-4" />
              الرئيسية
            </NavLink>
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
