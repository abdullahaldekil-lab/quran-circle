import { supabase } from "@/integrations/supabase/client";
import { Navigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import huwaylanLogo from "@/assets/huwaylan-logo.jpeg";

const Auth = () => {
  const { session, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [authError, setAuthError] = useState("");

  // Single check: if already authenticated, redirect ONCE
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">جارٍ التحقق...</p>
      </div>
    );
  }
  if (session) return <Navigate to="/dashboard" replace />;

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setAuthError("");
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("تم تسجيل الدخول بنجاح");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        toast.success("تم إنشاء الحساب. يرجى تأكيد البريد الإلكتروني");
      }
    } catch (error: any) {
      setAuthError(error.message);
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <img src={huwaylanLogo} alt="مجمع حويلان" className="w-20 h-20 object-contain mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-foreground">مجمع حويلان</h1>
          <p className="text-muted-foreground mt-2">لإدارة حلقات تحفيظ القرآن الكريم</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-center">
              {isLogin ? "تسجيل الدخول" : "إنشاء حساب جديد"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAuth} className="space-y-4">
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="name">الاسم الكامل</Label>
                  <Input
                    id="name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="أدخل اسمك الكامل"
                    required={!isLogin}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">البريد الإلكتروني</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@email.com"
                  required
                  dir="ltr"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">كلمة المرور</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  dir="ltr"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "جارٍ التحميل..." : isLogin ? "دخول" : "إنشاء حساب"}
              </Button>
            </form>
            {authError && (
              <div className="mt-3 p-3 rounded-lg bg-destructive/10 text-destructive text-sm text-center">
                {authError}
              </div>
            )}
            <div className="mt-4 text-center space-y-2">
              <button
                type="button"
                className="text-sm text-primary hover:underline block w-full"
                onClick={() => { setIsLogin(!isLogin); setAuthError(""); }}
              >
                {isLogin ? "ليس لديك حساب؟ أنشئ واحداً" : "لديك حساب؟ سجّل الدخول"}
              </button>
              <a
                href="/guardian-auth"
                className="text-xs text-muted-foreground hover:underline block w-full"
              >
                دخول كولي أمر
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
