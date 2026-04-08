import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, User, Briefcase, CheckSquare, ScrollText } from "lucide-react";

interface SearchResult {
  id: string;
  title: string;
  subtitle?: string;
  type: "student" | "staff" | "task" | "request";
  path: string;
}

const GlobalSearch = ({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (q: string) => {
    if (!q || q.length < 2) { setResults([]); return; }
    setLoading(true);

    const [studentsRes, staffRes, tasksRes, requestsRes] = await Promise.all([
      supabase.from("students").select("id, full_name, halaqa_id").ilike("full_name", `%${q}%`).limit(5),
      supabase.from("profiles").select("id, full_name, role").ilike("full_name", `%${q}%`).limit(5),
      supabase.from("staff_tasks").select("id, title, status").ilike("title", `%${q}%`).limit(5),
      supabase.from("internal_requests").select("id, title, status").ilike("title", `%${q}%`).limit(5),
    ]);

    const items: SearchResult[] = [
      ...(studentsRes.data || []).map((s: any) => ({
        id: s.id, title: s.full_name, type: "student" as const, path: `/students/${s.id}`,
      })),
      ...(staffRes.data || []).map((s: any) => ({
        id: s.id, title: s.full_name, subtitle: s.role, type: "staff" as const, path: `/profile`,
      })),
      ...(tasksRes.data || []).map((t: any) => ({
        id: t.id, title: t.title, subtitle: t.status, type: "task" as const, path: `/staff-tasks`,
      })),
      ...(requestsRes.data || []).map((r: any) => ({
        id: r.id, title: r.title, subtitle: r.status, type: "request" as const, path: `/internal-requests`,
      })),
    ];

    setResults(items);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => search(query), 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  useEffect(() => {
    if (!open) { setQuery(""); setResults([]); }
  }, [open]);

  const typeIcon = (type: string) => {
    switch (type) {
      case "student": return <User className="w-4 h-4 text-primary" />;
      case "staff": return <Briefcase className="w-4 h-4 text-primary" />;
      case "task": return <CheckSquare className="w-4 h-4 text-primary" />;
      case "request": return <ScrollText className="w-4 h-4 text-primary" />;
      default: return null;
    }
  };

  const typeLabel = (type: string) => {
    switch (type) {
      case "student": return "طالب";
      case "staff": return "موظف";
      case "task": return "مهمة";
      case "request": return "طلب";
      default: return "";
    }
  };

  const handleSelect = (result: SearchResult) => {
    onOpenChange(false);
    navigate(result.path);
  };

  const grouped = {
    student: results.filter(r => r.type === "student"),
    staff: results.filter(r => r.type === "staff"),
    task: results.filter(r => r.type === "task"),
    request: results.filter(r => r.type === "request"),
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-md p-0 gap-0">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="text-sm font-medium">بحث شامل</DialogTitle>
        </DialogHeader>
        <div className="p-4 pt-2">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ابحث عن طالب، موظف، مهمة، طلب..."
              className="pr-10"
              autoFocus
            />
          </div>
        </div>

        <div className="max-h-80 overflow-y-auto px-4 pb-4">
          {loading && <p className="text-xs text-muted-foreground text-center py-4">جارٍ البحث...</p>}

          {!loading && query.length >= 2 && results.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">لا توجد نتائج</p>
          )}

          {(["student", "staff", "task", "request"] as const).map(type => {
            const items = grouped[type];
            if (items.length === 0) return null;
            return (
              <div key={type} className="mb-3">
                <p className="text-[10px] font-medium text-muted-foreground mb-1 flex items-center gap-1">
                  {typeIcon(type)} {type === "student" ? "الطلاب" : type === "staff" ? "الموظفون" : type === "task" ? "المهام" : "الطلبات"}
                </p>
                {items.map(item => (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted text-right transition-colors"
                  >
                    {typeIcon(item.type)}
                    <span className="text-sm flex-1 truncate">{item.title}</span>
                    {item.subtitle && <Badge variant="outline" className="text-[10px]">{item.subtitle}</Badge>}
                  </button>
                ))}
              </div>
            );
          })}
        </div>

        <div className="border-t p-2 text-center">
          <p className="text-[10px] text-muted-foreground">Ctrl+K للبحث السريع</p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GlobalSearch;