import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import AppLayout from "@/components/AppLayout";
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
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children, path }: { children: React.ReactNode; path?: string }) => {
  const { session, loading } = useAuth();
  const { hasAccess } = useRole();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!session) return <Navigate to="/auth" replace />;
  if (path && !hasAccess(path)) return <Navigate to="/dashboard" replace />;
  return <AppLayout>{children}</AppLayout>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/guardian-auth" element={<GuardianAuth />} />
            <Route path="/guardian" element={<GuardianDashboard />} />
            <Route path="/guardian/child/:id" element={<GuardianChildProfile />} />
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
            <Route path="/kpi-dashboard" element={<ProtectedRoute path="/kpi-dashboard"><KpiDashboard /></ProtectedRoute>} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
