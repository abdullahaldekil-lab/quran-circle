import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { formatDateTimeSmart, formatDateHijriOnly } from "@/lib/hijri";
import {
  Plus, MapPin, Calendar, Clock, Users, Play, CheckCircle2,
  Bus, Flag, RotateCcw, PartyPopper, ArrowRight, Loader2,
  ClipboardList, Eye,
} from "lucide-react";

const TRIP_TYPES: Record<string, string> = {
  educational: "تعليمي",
  cultural: "ثقافي",
  recreational: "ترفيهي",
  competition: "مسابقة / فعالية",
};

const TRIP_STATUSES: Record<string, { label: string; icon: any; color: string }> = {
  not_started: { label: "لم تبدأ", icon: Clock, color: "bg-muted text-muted-foreground" },
  departed: { label: "انطلقت", icon: Bus, color: "bg-info/15 text-info" },
  arrived: { label: "وصلت", icon: MapPin, color: "bg-success/15 text-success" },
  activity_ongoing: { label: "نشاط جارٍ", icon: Play, color: "bg-warning/15 text-warning" },
  returning: { label: "في طريق العودة", icon: RotateCcw, color: "bg-info/15 text-info" },
  finished: { label: "انتهت", icon: Flag, color: "bg-muted text-muted-foreground" },
};

const STATUS_ORDER = ["not_started", "departed", "arrived", "activity_ongoing", "returning", "finished"];

const Trips = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [trips, setTrips] = useState<any[]>([]);
  const [halaqat, setHalaqat] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailTrip, setDetailTrip] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [tripStudents, setTripStudents] = useState<any[]>([]);
  const [tripAttendance, setTripAttendance] = useState<any[]>([]);
  const [statusLogs, setStatusLogs] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("upcoming");

  // Create form
  const [form, setForm] = useState({
    title: "", trip_type: "recreational", trip_date: "",
    start_time: "", end_time: "", location: "",
    description: "", capacity: "", supervising_teacher_id: "",
    estimated_return_time: "", selectedHalaqat: [] as string[],
  });

  const isManager = profile?.role === "manager" || profile?.role === "supervisor" || profile?.role === "admin_staff";

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [tripsRes, halaqatRes, teachersRes] = await Promise.all([
      supabase.from("trips").select("*, profiles!trips_supervising_teacher_id_fkey(full_name), profiles!trips_created_by_fkey(full_name)").order("trip_date", { ascending: false }),
      supabase.from("halaqat").select("*").eq("active", true),
      supabase.from("profiles").select("id, full_name, role").in("role", ["teacher", "assistant_teacher", "supervisor"]),
    ]);
    // Fetch trip_halaqat for all trips
    const tripIds = (tripsRes.data || []).map((t: any) => t.id);
    let tripHalaqatMap: Record<string, string[]> = {};
    if (tripIds.length > 0) {
      const { data: thData } = await supabase.from("trip_halaqat").select("trip_id, halaqa_id").in("trip_id", tripIds);
      (thData || []).forEach((th: any) => {
        if (!tripHalaqatMap[th.trip_id]) tripHalaqatMap[th.trip_id] = [];
        tripHalaqatMap[th.trip_id].push(th.halaqa_id);
      });
    }
    const enriched = (tripsRes.data || []).map((t: any) => ({
      ...t, halaqat_ids: tripHalaqatMap[t.id] || [],
    }));
    setTrips(enriched);
    setHalaqat(halaqatRes.data || []);
    setTeachers(teachersRes.data || []);
    setLoading(false);
  };

  const createTrip = async () => {
    if (!form.title || !form.trip_date) {
      toast({ title: "خطأ", description: "يرجى إدخال العنوان والتاريخ", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { data: session } = await supabase.auth.getSession();
    const { data: trip, error } = await supabase.from("trips").insert({
      title: form.title,
      trip_type: form.trip_type,
      trip_date: form.trip_date,
      start_time: form.start_time || null,
      end_time: form.end_time || null,
      location: form.location || null,
      description: form.description || null,
      capacity: form.capacity ? parseInt(form.capacity) : null,
      supervising_teacher_id: form.supervising_teacher_id || null,
      estimated_return_time: form.estimated_return_time || null,
      created_by: session?.session?.user?.id,
      // halaqa_id kept for backward compat
      halaqa_id: form.selectedHalaqat[0] || null,
    } as any).select().single();

    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
      setSaving(false);
      return;
    }

    // Insert trip_halaqat
    if (form.selectedHalaqat.length > 0 && trip) {
      await supabase.from("trip_halaqat").insert(
        form.selectedHalaqat.map((hid) => ({ trip_id: trip.id, halaqa_id: hid }))
      );
    }

    toast({ title: "تم إنشاء النشاط بنجاح" });
    setCreateOpen(false);
    setForm({ title: "", trip_type: "recreational", trip_date: "", start_time: "", end_time: "", location: "", description: "", capacity: "", supervising_teacher_id: "", estimated_return_time: "", selectedHalaqat: [] });
    setSaving(false);
    fetchData();
  };

  const updateTripStatus = async (tripId: string, currentStatus: string, newStatus: string) => {
    setSaving(true);
    const { data: session } = await supabase.auth.getSession();
    const userId = session?.session?.user?.id;

    await supabase.from("trips").update({ status: newStatus } as any).eq("id", tripId);
    await supabase.from("trip_status_log").insert({
      trip_id: tripId, old_status: currentStatus, new_status: newStatus, changed_by: userId,
    });

    toast({ title: "تم تحديث الحالة" });
    setSaving(false);
    fetchData();
    if (detailTrip?.id === tripId) {
      setDetailTrip({ ...detailTrip, status: newStatus });
      fetchTripDetails(tripId);
    }
  };

  const fetchTripDetails = async (tripId: string) => {
    const trip = trips.find((t) => t.id === tripId);
    if (!trip) return;
    setDetailTrip(trip);
    setDetailOpen(true);

    // Get students from participating halaqat
    const halaqaIds = trip.halaqat_ids.length > 0 ? trip.halaqat_ids : (trip.halaqa_id ? [trip.halaqa_id] : []);
    let students: any[] = [];
    if (halaqaIds.length > 0) {
      const { data } = await supabase.from("students").select("id, full_name, halaqa_id").in("halaqa_id", halaqaIds).eq("status", "active");
      students = data || [];
    }
    setTripStudents(students);

    const [attRes, logsRes] = await Promise.all([
      supabase.from("trip_attendance").select("*").eq("trip_id", tripId),
      supabase.from("trip_status_log").select("*, profiles(full_name)").eq("trip_id", tripId).order("changed_at", { ascending: true }),
    ]);
    setTripAttendance(attRes.data || []);
    setStatusLogs(logsRes.data || []);
  };

  const toggleAttendance = async (tripId: string, studentId: string) => {
    const existing = tripAttendance.find((a) => a.student_id === studentId);
    if (existing) {
      const newStatus = existing.status === "present" ? "absent" : "present";
      await supabase.from("trip_attendance").update({ status: newStatus }).eq("id", existing.id);
    } else {
      await supabase.from("trip_attendance").insert({ trip_id: tripId, student_id: studentId, status: "present" });
    }
    const { data } = await supabase.from("trip_attendance").select("*").eq("trip_id", tripId);
    setTripAttendance(data || []);
  };

  const today = new Date().toISOString().split("T")[0];
  const upcoming = trips.filter((t) => t.trip_date >= today || (t.status !== "finished" && t.status !== "not_started"));
  const past = trips.filter((t) => t.trip_date < today && (t.status === "finished" || t.status === "not_started"));

  const getNextStatus = (current: string) => {
    const idx = STATUS_ORDER.indexOf(current);
    return idx < STATUS_ORDER.length - 1 ? STATUS_ORDER[idx + 1] : null;
  };

  const halaqaName = (id: string) => halaqat.find((h) => h.id === id)?.name || "";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">الرحلات والأنشطة</h1>
          <p className="text-sm text-muted-foreground">إدارة الرحلات والأنشطة ومتابعة حالتها</p>
        </div>
        {isManager && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 ml-2" />نشاط جديد</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>إنشاء نشاط / رحلة</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>العنوان *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>النوع</Label>
                    <Select value={form.trip_type} onValueChange={(v) => setForm({ ...form, trip_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(TRIP_TYPES).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>التاريخ *</Label><Input type="date" value={form.trip_date} onChange={(e) => setForm({ ...form, trip_date: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>وقت البدء</Label><Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} /></div>
                  <div><Label>وقت الانتهاء</Label><Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>الموقع</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
                  <div><Label>السعة (اختياري)</Label><Input type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} /></div>
                </div>
                <div><Label>وقت العودة المتوقع</Label><Input type="time" value={form.estimated_return_time} onChange={(e) => setForm({ ...form, estimated_return_time: e.target.value })} /></div>
                <div>
                  <Label>المشرف</Label>
                  <Select value={form.supervising_teacher_id} onValueChange={(v) => setForm({ ...form, supervising_teacher_id: v })}>
                    <SelectTrigger><SelectValue placeholder="اختر المشرف" /></SelectTrigger>
                    <SelectContent>
                      {teachers.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>الحلقات المشاركة</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {halaqat.map((h) => (
                      <div key={h.id} className="flex items-center gap-2">
                        <Checkbox
                          checked={form.selectedHalaqat.includes(h.id)}
                          onCheckedChange={(checked) => {
                            setForm({
                              ...form,
                              selectedHalaqat: checked
                                ? [...form.selectedHalaqat, h.id]
                                : form.selectedHalaqat.filter((id) => id !== h.id),
                            });
                          }}
                        />
                        <span className="text-sm">{h.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div><Label>ملاحظات</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                <Button onClick={createTrip} disabled={saving} className="w-full">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <Plus className="w-4 h-4 ml-2" />}
                  إنشاء
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="upcoming">القادمة والجارية ({upcoming.length})</TabsTrigger>
          <TabsTrigger value="past">السابقة ({past.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="space-y-3 mt-4">
          {upcoming.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">لا توجد أنشطة قادمة</CardContent></Card>
          ) : upcoming.map((trip) => (
            <TripCard key={trip.id} trip={trip} halaqaName={halaqaName} onStatusUpdate={updateTripStatus}
              onViewDetails={() => fetchTripDetails(trip.id)} getNextStatus={getNextStatus}
              isManager={isManager} isSupervisingTeacher={trip.supervising_teacher_id === profile?.id || trip.created_by === profile?.id}
              saving={saving} />
          ))}
        </TabsContent>

        <TabsContent value="past" className="space-y-3 mt-4">
          {past.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">لا توجد أنشطة سابقة</CardContent></Card>
          ) : past.map((trip) => (
            <TripCard key={trip.id} trip={trip} halaqaName={halaqaName} onStatusUpdate={updateTripStatus}
              onViewDetails={() => fetchTripDetails(trip.id)} getNextStatus={getNextStatus}
              isManager={isManager} isSupervisingTeacher={false} saving={saving} />
          ))}
        </TabsContent>
      </Tabs>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {detailTrip && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-primary" />
                  {detailTrip.title}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{TRIP_TYPES[detailTrip.trip_type] || detailTrip.trip_type}</Badge>
                  <StatusBadge status={detailTrip.status} />
                  <Badge variant="outline" className="gap-1"><Calendar className="w-3 h-3" />{formatDateHijriOnly(detailTrip.trip_date)}</Badge>
                  {detailTrip.location && <Badge variant="outline" className="gap-1"><MapPin className="w-3 h-3" />{detailTrip.location}</Badge>}
                </div>
                {detailTrip.description && <p className="text-sm text-muted-foreground">{detailTrip.description}</p>}
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {detailTrip.start_time && <div><span className="text-muted-foreground">البدء:</span> {detailTrip.start_time}</div>}
                  {detailTrip.end_time && <div><span className="text-muted-foreground">الانتهاء:</span> {detailTrip.end_time}</div>}
                  {detailTrip.estimated_return_time && <div><span className="text-muted-foreground">العودة المتوقعة:</span> {detailTrip.estimated_return_time}</div>}
                  {detailTrip.capacity && <div><span className="text-muted-foreground">السعة:</span> {detailTrip.capacity}</div>}
                </div>

                {/* Participating Halaqat */}
                {detailTrip.halaqat_ids?.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-1">الحلقات المشاركة</h4>
                    <div className="flex flex-wrap gap-1">
                      {detailTrip.halaqat_ids.map((hid: string) => (
                        <Badge key={hid} variant="outline" className="text-xs">{halaqaName(hid)}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Attendance */}
                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                    <Users className="w-4 h-4" /> حضور الطلاب ({tripStudents.length})
                  </h4>
                  {tripStudents.length === 0 ? (
                    <p className="text-xs text-muted-foreground">لا توجد حلقات مرتبطة</p>
                  ) : (
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {tripStudents.map((s) => {
                        const att = tripAttendance.find((a) => a.student_id === s.id);
                        const isPresent = att?.status === "present";
                        return (
                          <div key={s.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50">
                            <span className="text-sm">{s.full_name}</span>
                            <Button variant={isPresent ? "default" : "outline"} size="sm" className="h-7 text-xs"
                              onClick={() => toggleAttendance(detailTrip.id, s.id)}>
                              {isPresent ? <><CheckCircle2 className="w-3 h-3 ml-1" />حاضر</> : "تسجيل حضور"}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Status Log */}
                {statusLogs.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                      <ClipboardList className="w-4 h-4" /> سجل الحالات
                    </h4>
                    <div className="space-y-2">
                      {statusLogs.map((log) => (
                        <div key={log.id} className="flex items-center gap-2 text-xs">
                          <ArrowRight className="w-3 h-3 text-muted-foreground" />
                          <StatusBadge status={log.new_status} small />
                          <span className="text-muted-foreground">
                            {formatDateTimeSmart(log.changed_at)}
                          </span>
                          {log.profiles?.full_name && (
                            <span className="text-muted-foreground">— {log.profiles.full_name}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const StatusBadge = ({ status, small }: { status: string; small?: boolean }) => {
  const s = TRIP_STATUSES[status] || TRIP_STATUSES.not_started;
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium ${s.color} ${small ? "text-[10px]" : "text-xs"}`}>
      <Icon className={small ? "w-2.5 h-2.5" : "w-3 h-3"} />
      {s.label}
    </span>
  );
};

const TripCard = ({ trip, halaqaName, onStatusUpdate, onViewDetails, getNextStatus, isManager, isSupervisingTeacher, saving }: any) => {
  const next = getNextStatus(trip.status);
  const canUpdate = isManager || isSupervisingTeacher;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold">{trip.title}</h3>
              <Badge variant="secondary" className="text-xs">{TRIP_TYPES[trip.trip_type] || trip.trip_type}</Badge>
              <StatusBadge status={trip.status} />
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDateHijriOnly(trip.trip_date)}</span>
              {trip.start_time && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{trip.start_time}</span>}
              {trip.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{trip.location}</span>}
            </div>
            {trip.halaqat_ids?.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {trip.halaqat_ids.map((hid: string) => (
                  <Badge key={hid} variant="outline" className="text-[10px]">{halaqaName(hid)}</Badge>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={onViewDetails}>
              <Eye className="w-3.5 h-3.5 ml-1" />تفاصيل
            </Button>
            {canUpdate && next && (
              <Button size="sm" className="h-8 text-xs" disabled={saving}
                onClick={() => onStatusUpdate(trip.id, trip.status, next)}>
                {TRIP_STATUSES[next]?.label || next}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default Trips;
