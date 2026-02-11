import { Button } from "@/components/ui/button";
import { ShieldX } from "lucide-react";
import { useNavigate } from "react-router-dom";

const NotAuthorized = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4" dir="rtl">
      <div className="text-center space-y-6 max-w-md">
        <ShieldX className="w-20 h-20 text-destructive mx-auto" />
        <h1 className="text-3xl font-bold text-foreground">غير مصرح</h1>
        <p className="text-lg text-muted-foreground">
          لا تملك صلاحية الوصول لهذه الصفحة
        </p>
        <Button onClick={() => navigate("/dashboard")} size="lg">
          العودة للوحة التحكم
        </Button>
      </div>
    </div>
  );
};

export default NotAuthorized;
