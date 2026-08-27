import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Book, Video, FileText, Link as LinkIcon, Plus, Trash2, Library, Pencil, EyeOff, Music, Eye, Play, Users, Clock, ListOrdered, Info } from "lucide-react";
import MaterialFormDialog, { type MaterialRow } from "@/components/programs/MaterialFormDialog";
import MaterialPlayer from "@/components/programs/MaterialPlayer";
import {
  MATERIAL_AUDIENCES,
  MATERIAL_AUDIENCE_LABELS,
  MATERIAL_LABELS,
  MATERIAL_TYPES,
  materialAudience,
  type MaterialType,
} from "@/lib/materialType";
import {
  aggregateStats,
  emptyStats,
  totalStats,
  type MaterialStats,
  type MaterialViewRow,
} from "@/lib/materialViews";
import { PROGRAMS, programLabel } from "@/lib/programs";


const TYPE_ICON: Record<MaterialType, typeof Book> = {
  book: Book,
  video: Video,
  audio: Music,
  file: FileText,
  link: LinkIcon,
};

const TYPE_COLOR: Record<MaterialType, string> = {
  book: "text-emerald-500",
  video: "text-red-500",
  audio: "text-blue-500",
  file: "text-amber-500",
  link: "text-purple-500",
};

export default function ProgramMaterials() {
  const { isManager, isSupervisor } = useRole();
  const canManage = isManager || isSupervisor;
  const [searchParams, setSearchParams] = useSearchParams();

  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [audienceFilter, setAudienceFilter] = useState<string>("all");
  const programFilter = searchParams.get("program") || "all";
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MaterialRow | null>(null);
  const [stats, setStats] = useState<Record<string, MaterialStats>>({});

  const load = useCallback(async () => {
    const { data, error } = await (supabase as any)
      .from("program_materials")
      .select("*")
      .order("order_index", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) return toast.error(error.message);
    setMaterials((data || []) as MaterialRow[]);
  }, []);

  // View tracking is readable by staff only; a failure here must not break the library.
  const loadStats = useCallback(async () => {
    const { data, error } = await (supabase as any)
      .from("program_material_views")
      .select("material_id,event_type,seconds_watched,completion_percent,student_id,student_code,viewed_at")
      .order("viewed_at", { ascending: false })
      .limit(5000);
    if (error) return;
    setStats(aggregateStats((data || []) as MaterialViewRow[]));
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadStats(); }, [loadStats]);


  const setProgramFilter = (key: string) => {
    const next = new URLSearchParams(searchParams);
    if (key === "all") next.delete("program");
    else next.set("program", key);
    setSearchParams(next, { replace: true });
  };

  async function remove(m: MaterialRow) {
    if (!confirm(`حذف "${m.title}"؟`)) return;
    // Delete the stored object too, otherwise the private bucket accumulates orphans.
    if (m.file_path) {
      await supabase.storage.from("program-materials").remove([m.file_path]);
    }
    const { error } = await (supabase as any).from("program_materials").delete().eq("id", m.id);
    if (error) return toast.error(error.message);
    toast.success("تم الحذف");
    load();
  }

  async function move(m: MaterialRow, delta: number) {
    const { error } = await (supabase as any)
      .from("program_materials")
      .update({ order_index: (m.order_index ?? 0) + delta })
      .eq("id", m.id);
    if (error) return toast.error(error.message);
    load();
  }

  const filtered = materials.filter((m) => {
    const audience = materialAudience(m.audience);
    if (typeFilter !== "all" && m.material_type !== typeFilter) return false;
    if (programFilter !== "all" && (m.program_key || "") !== programFilter) return false;
    if (audienceFilter !== "all" && audience !== audienceFilter) return false;
    // Staff who cannot manage only see published materials, and never teacher-hidden ones.
    if (!canManage && m.active === false) return false;
    return true;
  });

  const filteredTotals = totalStats(
    Object.fromEntries(filtered.map((m) => [m.id, stats[m.id] || emptyStats()])),
  );



  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Library className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">مواد البرامج الإثرائية</h1>
            <p className="text-sm text-muted-foreground">كتب ومقاطع يوتيوب ومواد صوتية لكل برنامج</p>
          </div>
        </div>
        {canManage && (
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="w-4 h-4 ml-1" />مادة جديدة
          </Button>
        )}
      </div>

      {/* Usage summary — management only */}
      {canManage && (
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="pt-4 flex items-center gap-3">
              <Eye className="w-5 h-5 text-primary" />
              <div>
                <p className="text-xl font-bold">{filteredTotals.views}</p>
                <p className="text-xs text-muted-foreground">إجمالي المشاهدات</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 flex items-center gap-3">
              <Play className="w-5 h-5 text-emerald-500" />
              <div>
                <p className="text-xl font-bold">{filteredTotals.plays}</p>
                <p className="text-xs text-muted-foreground">تشغيل صوت/فيديو</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 flex items-center gap-3">
              <Users className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-xl font-bold">{filteredTotals.downloads}</p>
                <p className="text-xs text-muted-foreground">عمليات التحميل</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 flex items-center gap-3">
              <Clock className="w-5 h-5 text-amber-500" />
              <div>
                <p className="text-xl font-bold">{filteredTotals.totalMinutes}</p>
                <p className="text-xs text-muted-foreground">دقائق الاستماع</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}



      {/* Programme filter */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={programFilter === "all" ? "default" : "outline"} onClick={() => setProgramFilter("all")}>
          كل البرامج
        </Button>
        {PROGRAMS.map((p) => (
          <Button key={p.key} size="sm" variant={programFilter === p.key ? "default" : "outline"} onClick={() => setProgramFilter(p.key)}>
            {p.label}
          </Button>
        ))}
      </div>

      {/* Type filter */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={typeFilter === "all" ? "secondary" : "ghost"} onClick={() => setTypeFilter("all")}>الكل</Button>
        {MATERIAL_TYPES.map((t) => (
          <Button key={t} size="sm" variant={typeFilter === t ? "secondary" : "ghost"} onClick={() => setTypeFilter(t)}>
            {MATERIAL_LABELS[t]}
          </Button>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((m) => {
          const type = (m.material_type as MaterialType) in TYPE_ICON ? (m.material_type as MaterialType) : "link";
          const Icon = TYPE_ICON[type];
          return (
            <Card key={m.id} className={m.active === false ? "opacity-60" : undefined}>
              <CardContent className="pt-4 space-y-3">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <Icon className={`w-5 h-5 mt-1 shrink-0 ${TYPE_COLOR[type]}`} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold">{m.title}</p>
                      {m.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{m.description}</p>
                      )}
                      <div className="flex flex-wrap gap-1 mt-2">
                        <Badge variant="outline">{MATERIAL_LABELS[type]}</Badge>
                        <Badge variant="secondary" className="text-[10px]">{programLabel(m.program_key)}</Badge>
                        {m.active === false && (
                          <Badge variant="destructive" className="text-[10px]">
                            <EyeOff className="w-3 h-3 ml-1" />مخفية
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  {canManage && (
                    <div className="flex flex-col gap-1 shrink-0">
                      <Button aria-label="تعديل" variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(m); setDialogOpen(true); }}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button aria-label="حذف" variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove(m)}>
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </div>
                  )}
                </div>

                {(m.segment_order || m.suggested_minutes) && (
                  <div className="flex flex-wrap gap-1">
                    {m.segment_order && (
                      <Badge variant="outline" className="text-[10px]">
                        <ListOrdered className="w-3 h-3 ml-1" />{m.segment_order}
                      </Badge>
                    )}
                    {m.suggested_minutes ? (
                      <Badge variant="outline" className="text-[10px]">
                        <Clock className="w-3 h-3 ml-1" />{m.suggested_minutes} دقيقة مقترحة
                      </Badge>
                    ) : null}
                  </div>
                )}

                {m.usage_notes && (
                  <div className="rounded-md bg-muted/50 p-2 text-[11px] leading-relaxed">
                    <span className="flex items-center gap-1 font-semibold mb-1">
                      <Info className="w-3 h-3" />إرشادات الاستخدام
                    </span>
                    <p className="whitespace-pre-wrap text-muted-foreground">{m.usage_notes}</p>
                  </div>
                )}

                <MaterialPlayer materialId={m.id} materialType={type} url={m.url} filePath={m.file_path} title={m.title} />


                {canManage && (
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground pt-1">
                    <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{(stats[m.id]?.views ?? 0)} مشاهدة</span>
                    <span className="flex items-center gap-1"><Play className="w-3 h-3" />{(stats[m.id]?.plays ?? 0)} تشغيل</span>
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" />{(stats[m.id]?.uniqueStudents ?? 0)} طالب</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{(stats[m.id]?.totalMinutes ?? 0)} د</span>
                  </div>
                )}



                {canManage && (
                  <div className="flex items-center gap-1 pt-1 border-t">
                    <span className="text-[10px] text-muted-foreground">الترتيب {m.order_index ?? 0}</span>
                    <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => move(m, -1)}>▲</Button>
                    <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => move(m, 1)}>▼</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        {!filtered.length && (
          <p className="text-muted-foreground col-span-full text-center py-8">لا توجد مواد في هذا التصنيف.</p>
        )}
      </div>

      <MaterialFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        material={editing}
        defaultProgramKey={programFilter === "all" ? undefined : programFilter}
        onSaved={load}
      />
    </div>
  );
}
