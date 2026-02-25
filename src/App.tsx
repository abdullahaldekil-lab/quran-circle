import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useEffect } from "react";
import AppLayout from "@/components/AppLayout";
import Health from "./pages/Health";
import Auth from "./pages/Auth";
import GuardianAuth from "./pages/GuardianAuth";
import GuardianDashboard from "./pages/GuardianDashboard";
import GuardianChildProfile from "./pages/GuardianChildProfile";
import Dashboard from "./pages/Dashboard";
import Students from "./pages/Students";
import Halaqat from "./pages/Halaqat";
import Recitation from "./pages/Recitation";
import Attendance from "./pages/Attendance";
import Instructions from "./pages/Instructions";
import StudentProfile from "./pages/StudentProfile";
import BulkImport from "./pages/BulkImport";
import Levels from "./pages/Levels";
import Rankings from "./pages/Rankings";
import Rewards from "./pages/Rewards";
import Trips from "./pages/Trips";
import Finance from "./pages/Finance";
import StrategicPlan from "./pages/StrategicPlan";
import KpiDashboard from "./pages/KpiDashboard";
import UserManagement from "./pages/UserManagement";
import ProfileSettings from "./pages/ProfileSettings";
import NotFound from "./pages/NotFound";
import NotAuthorized from "./pages/NotAuthorized";
import Documents from "./pages/Documents";
import Buses from "./pages/Buses";
import PreRegistration from "./pages/PreRegistration";
import Enroll from "./pages/Enroll";
import EnrollmentRequests from "./pages/EnrollmentRequests";
import Preparation from "./pages/Preparation";
import AcademicCalendar from "./pages/AcademicCalendar";
import AttendanceAuditLog from "./pages/AttendanceAuditLog";
import Madarij from "./pages/Madarij";
import MadarijEnrollment from "./pages/MadarijEnrollment";
import PermissionsManagement from "./pages/PermissionsManagement";
import QuranNarration from "./pages/QuranNarration";
import NarrationSession from "./pages/NarrationSession";
import NarrationReports from "./pages/NarrationReports";
import StudentNarrationProgress from "./pages/StudentNarrationProgress";
import StaffAttendance from "./pages/StaffAttendance";
import StaffAttendanceLog from "./pages/StaffAttendanceLog";
import StaffShiftManagement from "./pages/StaffShiftManagement";
import NotificationTemplates from "./pages/NotificationTemplates";
import NotificationLog from "./pages/NotificationLog";
import NotificationPreferences from "./pages/NotificationPreferences";
import SendNotification from "./pages/SendNotification";
import BulkEmail from "./pages/BulkEmail";
import Excellence from "./pages/Excellence";
import ExcellenceSession from "./pages/ExcellenceSession";
import ExcellenceReports from "./pages/ExcellenceReports";
import ExcellenceTracks from "./pages/ExcellenceTracks";
import DistinguishedStudents from "./pages/DistinguishedStudents";
import ExcellenceTrackSettings from "./pages/ExcellenceTrackSettings";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30000,
    },
  },
});

const ProtectedRoute = ({ children, path }: { children: React.ReactNode; path?: string }) => {
  const { session, loading } = useAuth();
  const { hasAccess } = useRole();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">جارٍ تحميل الجلسة...</p>
      </div>
    );
  }

  if (!session) return <Navigate to="/auth" replace />;
  if (path && !hasAccess(path)) return <Navigate to="/not-authorized" replace />;
  return <AppLayout>{children}</AppLayout>;
};

const AppRoutes = () => {
  // Global unhandled rejection handler
  useEffect(() => {
    const handler = (e: PromiseRejectionEvent) => {
      console.error("Unhandled rejection:", e.reason);
      e.preventDefault();
    };
    window.addEventListener("unhandledrejection", handler);
    return () => window.removeEventListener("unhandledrejection", handler);
  }, []);

  return (
    <Routes>
      {/* Safe boot - no auth, no DB */}
      <Route path="/health" element={<Health />} />

      {/* Public routes */}
      <Route path="/auth" element={<Auth />} />
      <Route path="/guardian-auth" element={<GuardianAuth />} />
      <Route path="/guardian" element={<GuardianDashboard />} />
      <Route path="/guardian/child/:id" element={<GuardianChildProfile />} />
      <Route path="/enroll" element={<Enroll />} />

      {/* Protected routes */}
      <Route path="/dashboard" element={<ProtectedRoute path="/dashboard"><Dashboard /></ProtectedRoute>} />
      <Route path="/students" element={<ProtectedRoute path="/students"><Students /></ProtectedRoute>} />
      <Route path="/students/:id" element={<ProtectedRoute path="/students"><StudentProfile /></ProtectedRoute>} />
      <Route path="/halaqat" element={<ProtectedRoute path="/halaqat"><Halaqat /></ProtectedRoute>} />
      <Route path="/recitation" element={<ProtectedRoute path="/recitation"><Recitation /></ProtectedRoute>} />
      <Route path="/attendance" element={<ProtectedRoute path="/attendance"><Attendance /></ProtectedRoute>} />
      <Route path="/instructions" element={<ProtectedRoute path="/instructions"><Instructions /></ProtectedRoute>} />
      <Route path="/bulk-import" element={<ProtectedRoute path="/bulk-import"><BulkImport /></ProtectedRoute>} />
      <Route path="/levels" element={<ProtectedRoute path="/levels"><Levels /></ProtectedRoute>} />
      <Route path="/rankings" element={<ProtectedRoute path="/rankings"><Rankings /></ProtectedRoute>} />
      <Route path="/rewards" element={<ProtectedRoute path="/rewards"><Rewards /></ProtectedRoute>} />
      <Route path="/trips" element={<ProtectedRoute path="/trips"><Trips /></ProtectedRoute>} />
      <Route path="/finance" element={<ProtectedRoute path="/finance"><Finance /></ProtectedRoute>} />
      <Route path="/strategic-plan" element={<ProtectedRoute path="/strategic-plan"><StrategicPlan /></ProtectedRoute>} />
      <Route path="/strategy" element={<ProtectedRoute path="/strategic-plan"><StrategicPlan /></ProtectedRoute>} />
      <Route path="/kpi-dashboard" element={<ProtectedRoute path="/kpi-dashboard"><KpiDashboard /></ProtectedRoute>} />
      <Route path="/user-management" element={<ProtectedRoute path="/user-management"><UserManagement /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute path="/profile"><ProfileSettings /></ProtectedRoute>} />
      <Route path="/documents" element={<ProtectedRoute path="/documents"><Documents /></ProtectedRoute>} />
      <Route path="/buses" element={<ProtectedRoute path="/buses"><Buses /></ProtectedRoute>} />
      <Route path="/pre-registration" element={<ProtectedRoute path="/pre-registration"><PreRegistration /></ProtectedRoute>} />
      <Route path="/enrollment-requests" element={<ProtectedRoute path="/enrollment-requests"><EnrollmentRequests /></ProtectedRoute>} />
      <Route path="/preparation" element={<ProtectedRoute path="/preparation"><Preparation /></ProtectedRoute>} />
      <Route path="/academic-calendar" element={<ProtectedRoute path="/academic-calendar"><AcademicCalendar /></ProtectedRoute>} />
      <Route path="/attendance-audit" element={<ProtectedRoute path="/attendance-audit"><AttendanceAuditLog /></ProtectedRoute>} />
      <Route path="/madarij" element={<ProtectedRoute path="/madarij"><Madarij /></ProtectedRoute>} />
      <Route path="/madarij/:enrollmentId" element={<ProtectedRoute path="/madarij"><MadarijEnrollment /></ProtectedRoute>} />
      <Route path="/permissions-management" element={<ProtectedRoute path="/permissions-management"><PermissionsManagement /></ProtectedRoute>} />
      <Route path="/quran-narration" element={<ProtectedRoute path="/quran-narration"><QuranNarration /></ProtectedRoute>} />
      <Route path="/quran-narration/:sessionId" element={<ProtectedRoute path="/quran-narration"><NarrationSession /></ProtectedRoute>} />
      <Route path="/quran-narration/reports" element={<ProtectedRoute path="/quran-narration"><NarrationReports /></ProtectedRoute>} />
      <Route path="/students/:id/narration-progress" element={<ProtectedRoute path="/students"><StudentNarrationProgress /></ProtectedRoute>} />

      <Route path="/excellence" element={<ProtectedRoute path="/excellence"><Excellence /></ProtectedRoute>} />
      <Route path="/excellence/:sessionId" element={<ProtectedRoute path="/excellence"><ExcellenceSession /></ProtectedRoute>} />
      <Route path="/excellence/reports" element={<ProtectedRoute path="/excellence"><ExcellenceReports /></ProtectedRoute>} />
      <Route path="/excellence/tracks" element={<ProtectedRoute path="/excellence"><ExcellenceTracks /></ProtectedRoute>} />
      <Route path="/excellence/distinguished" element={<ProtectedRoute path="/excellence"><DistinguishedStudents /></ProtectedRoute>} />
      <Route path="/excellence/track-settings" element={<ProtectedRoute path="/excellence"><ExcellenceTrackSettings /></ProtectedRoute>} />

      <Route path="/staff-attendance" element={<ProtectedRoute path="/staff-attendance"><StaffAttendance /></ProtectedRoute>} />
      <Route path="/staff-attendance-log" element={<ProtectedRoute path="/staff-attendance-log"><StaffAttendanceLog /></ProtectedRoute>} />
      <Route path="/staff-shifts" element={<ProtectedRoute path="/staff-shifts"><StaffShiftManagement /></ProtectedRoute>} />

      <Route path="/notification-templates" element={<ProtectedRoute path="/notification-templates"><NotificationTemplates /></ProtectedRoute>} />
      <Route path="/notification-log" element={<ProtectedRoute path="/notification-log"><NotificationLog /></ProtectedRoute>} />
      <Route path="/notification-preferences" element={<ProtectedRoute path="/notification-preferences"><NotificationPreferences /></ProtectedRoute>} />
      <Route path="/send-notification" element={<ProtectedRoute path="/send-notification"><SendNotification /></ProtectedRoute>} />
      <Route path="/bulk-email" element={<ProtectedRoute path="/bulk-email"><BulkEmail /></ProtectedRoute>} />

      <Route path="/not-authorized" element={<NotAuthorized />} />
      <Route path="/" element={<Navigate to="/auth" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
