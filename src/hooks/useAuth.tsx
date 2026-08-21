import { useEffect, useState, useCallback, useMemo, createContext, useContext, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

// أعمدة profiles المستخدمة فعلياً في التطبيق — أي حقل جديد يتطلب إضافته هنا وفي PROFILE_COLUMNS
export interface AuthProfile {
  id: string;
  full_name: string;
  role: string;
  phone: string | null;
  avatar_url: string | null;
  job_title: string | null;
  department: string | null;
  position_title: string | null;
  last_login_at: string | null;
  created_at: string;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: AuthProfile | null;
  /** true ما دامت الجلسة أو البروفايل قيد التحميل — لا تعتمد على الدور قبل أن تصير false */
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  refreshProfile: async () => {},
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

const PROFILE_COLUMNS =
  "id, full_name, role, phone, avatar_url, job_title, department, position_title, last_login_at, created_at";

const RETRY_DELAY_MS = 500;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// أحداث مثل TOKEN_REFRESHED قد تعيد نفس الجلسة؛ الحفاظ على هوية الكائن يقلّل إعادة الرسم
const isSameSession = (a: Session | null, b: Session | null) =>
  !!a &&
  !!b &&
  a.access_token === b.access_token &&
  a.user.id === b.user.id &&
  a.user.updated_at === b.user.updated_at;

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  const activeUserIdRef = useRef<string | null>(null); // بروفايل مُطبَّق فعلياً
  const inflightUserRef = useRef<string | null>(null); // جلب قيد التنفيذ
  const sawAuthEventRef = useRef(false); // وصل حدث مصادقة قبل نتيجة getSession
  const mountedRef = useRef(true);

  const loadProfile = useCallback(async (userId: string) => {
    inflightUserRef.current = userId;
    setProfile(null);
    setProfileLoading(true);

    try {
      for (let attempt = 1; attempt <= 2; attempt++) {
        const { data, error } = await supabase
          .from("profiles")
          .select(PROFILE_COLUMNS)
          .eq("id", userId)
          .maybeSingle();

        // تجاوزه مستخدم أحدث أو تسجيل خروج أو إزالة المكوّن
        if (!mountedRef.current || inflightUserRef.current !== userId) return;

        if (!error) {
          const row = (data as AuthProfile | null) ?? null;
          setProfile(row);
          // صف مفقود (قد يتأخر تريغر الإنشاء بعد التسجيل): اترك الحارس مفتوحاً ليعيد المحاولة
          activeUserIdRef.current = row ? userId : null;
          return;
        }

        console.error(`[auth] profile fetch failed (attempt ${attempt})`, error);
        if (attempt === 1) {
          await sleep(RETRY_DELAY_MS);
          if (!mountedRef.current || inflightUserRef.current !== userId) return;
        }
      }

      setProfile(null);
      activeUserIdRef.current = null; // اسمح بإعادة المحاولة عند حدث المصادقة التالي
    } finally {
      // لا تُطفئ التحميل إن كان جلبٌ أحدث قد استولى على السباق
      if (inflightUserRef.current === userId) {
        inflightUserRef.current = null;
        if (mountedRef.current) setProfileLoading(false);
      }
    }
  }, []);

  const applySession = useCallback(
    (newSession: Session | null) => {
      const userId = newSession?.user?.id ?? null;

      if (!userId) {
        activeUserIdRef.current = null;
        inflightUserRef.current = null;
        setProfile(null);
        setProfileLoading(false);
        return;
      }
      if (inflightUserRef.current === userId) return; // جلبٌ جارٍ لنفس المستخدم
      if (activeUserIdRef.current === userId) {
        setProfileLoading(false); // احتياط: لا تترك مؤشر التحميل عالقاً
        return;
      }
      void loadProfile(userId);
    },
    [loadProfile],
  );

  useEffect(() => {
    mountedRef.current = true;

    // 1. المستمع أولاً، ثم الجلسة الابتدائية
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mountedRef.current) return;
      sawAuthEventRef.current = true;
      setSession((prev) => (isSameSession(prev, newSession) ? prev : newSession));

      // تبديل مستخدم: أسقط البروفايل القديم وعلّم التحميل فوراً وبشكل متزامن
      const uid = newSession?.user?.id ?? null;
      if (uid && uid !== activeUserIdRef.current && inflightUserRef.current !== uid) {
        setProfile(null);
        setProfileLoading(true);
      }
      // setTimeout لتجنب deadlock المكتبة عند استدعاء الشبكة داخل كولباك المصادقة
      setTimeout(() => {
        if (mountedRef.current) applySession(newSession);
      }, 0);
    });

    // 2. الجلسة الابتدائية — applySession يزيل ازدواج الجلب عبر حراسة refs
    supabase.auth
      .getSession()
      .then(({ data: { session: initialSession } }) => {
        if (!mountedRef.current) return;
        if (sawAuthEventRef.current) return; // حدث INITIAL_SESSION سبقنا ومعه حالة أحدث
        setSession(initialSession);
        applySession(initialSession);
      })
      .catch((e) => console.error("[auth] init failed", e))
      .finally(() => {
        if (mountedRef.current) setInitializing(false);
      });

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, [applySession]);

  const currentUserId = session?.user?.id ?? null;

  // منفذ لإعادة الجلب يدوياً بعد تعديل البروفايل — الحارس يمنع الجلب التلقائي المتكرر
  const refreshProfile = useCallback(async () => {
    if (!currentUserId) return;
    inflightUserRef.current = null;
    activeUserIdRef.current = null;
    await loadProfile(currentUserId);
  }, [currentUserId, loadProfile]);

  const signOut = useCallback(async () => {
    // أبطل أي جلب قيد التنفيذ قبل مسح الحالة، وإلا أعاد بروفايل المستخدم السابق بعد الخروج
    inflightUserRef.current = null;
    activeUserIdRef.current = null;
    sawAuthEventRef.current = true;
    setProfile(null);
    setProfileLoading(false);
    setSession(null);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) console.error("[auth] signOut failed", error);
    } catch (e) {
      // الحالة المحلية مُسحت أصلاً؛ لا تُبقِ المستخدم داخل التطبيق بسبب فشل شبكة
      console.error("[auth] signOut failed", e);
    }
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading: initializing || profileLoading,
      refreshProfile,
      signOut,
    }),
    [session, profile, initializing, profileLoading, refreshProfile, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
