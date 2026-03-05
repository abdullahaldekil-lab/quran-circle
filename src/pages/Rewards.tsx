import { useEffect, useState } from "react";
import StudentNameLink from "@/components/StudentNameLink";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import {
  Award, Star, Gift, Trophy, Crown, Gem, Flame, BookOpen,
  Bookmark, CalendarCheck, TrendingDown, Plus, Check, X, Medal, Trash2, Pencil
} from "lucide-react";

const iconMap: Record<string, any> = {
  star: Star, award: Award, gift: Gift, trophy: Trophy, crown: Crown,
  gem: Gem, flame: Flame, "book-open": BookOpen, bookmark: Bookmark,
  "calendar-check": CalendarCheck, "trending-down": TrendingDown, medal: Medal,
};

const Rewards = () => {
  const { profile } = useAuth();
  const [badges, setBadges] = useState<any[]>([]);
  const [studentBadges, setStudentBadges] = useState<any[]>([]);
  const [rewards, setRewards] = useState<any[]>([]);
  const [nominations, setNominations] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [topStudents, setTopStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // New reward dialog
  const [showNewReward, setShowNewReward] = useState(false);
  const [newReward, setNewReward] = useState({ name: "", description: "", reward_type: "certificate", points_required: 0 });

  // Nomination dialog
  const [showNominate, setShowNominate] = useState(false);
  const [nomination, setNomination] = useState({ student_id: "", reward_id: "", note: "" });

  // Award badge dialog
  const [showAwardBadge, setShowAwardBadge] = useState(false);
  const [badgeAward, setBadgeAward] = useState({ student_id: "", badge_id: "", note: "" });

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [badgesRes, studentBadgesRes, rewardsRes, nominationsRes, studentsRes, pointsRes] = await Promise.all([
      supabase.from("badges").select("*").order("category"),
      supabase.from("student_badges").select("*, badges(name, icon, category), students(full_name)").order("awarded_at", { ascending: false }).limit(50),
      supabase.from("rewards").select("*").eq("active", true),
      supabase.from("reward_nominations").select("*, students(full_name), rewards(name), profiles!reward_nominations_nominated_by_fkey(full_name)").order("created_at", { ascending: false }).limit(50),
      supabase.from("students").select("id, full_name, halaqa_id").eq("status", "active"),
      supabase.from("student_points").select("student_id, points"),
    ]);

    setBadges(badgesRes.data || []);
    setStudentBadges(studentBadgesRes.data || []);
    setRewards(rewardsRes.data || []);
    setNominations(nominationsRes.data || []);
    setStudents(studentsRes.data || []);

    // Aggregate points per student
    const pointsMap: Record<string, number> = {};
    (pointsRes.data || []).forEach((p: any) => {
      pointsMap[p.student_id] = (pointsMap[p.student_id] || 0) + p.points;
    });
    const ranked = (studentsRes.data || [])
      .map((s: any) => ({ ...s, total_points: pointsMap[s.id] || 0 }))
      .sort((a: any, b: any) => b.total_points - a.total_points)
      .slice(0, 10);
    setTopStudents(ranked);

    setLoading(false);
  };

  const handleCreateReward = async () => {
    if (!newReward.name) return;
    const { error } = await supabase.from("rewards").insert({
      ...newReward,
      created_by: profile?.id,
    });
    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "تم إنشاء المكافأة بنجاح" });
      setShowNewReward(false);
      setNewReward({ name: "", description: "", reward_type: "certificate", points_required: 0 });
      fetchAll();
    }
  };

  const handleNominate = async () => {
    if (!nomination.student_id || !nomination.reward_id) return;
    const { error } = await supabase.from("reward_nominations").insert({
      ...nomination,
      nominated_by: profile?.id,
    });
    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "تم ترشيح الطالب بنجاح" });
      setShowNominate(false);
      setNomination({ student_id: "", reward_id: "", note: "" });
      fetchAll();
    }
  };

  const handleApproveNomination = async (id: string, status: "approved" | "rejected") => {
    const { error } = await supabase.from("reward_nominations").update({
      status,
      approved_by: profile?.id,
      updated_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    } else {
      toast({ title: status === "approved" ? "تمت الموافقة" : "تم الرفض" });
      fetchAll();
    }
  };

  const handleAwardBadge = async () => {
    if (!badgeAward.student_id || !badgeAward.badge_id) return;
    const { error } = await supabase.from("student_badges").insert({
      ...badgeAward,
      awarded_by: profile?.id,
    });
    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "تم منح الشارة بنجاح" });
      setShowAwardBadge(false);
      setBadgeAward({ student_id: "", badge_id: "", note: "" });
      fetchAll();
    }
  };

  const rewardTypeLabels: Record<string, string> = {
    certificate: "شهادة", gift: "هدية", trip: "رحلة", recognition: "تكريم",
  };

  const statusLabels: Record<string, string> = {
    pending: "قيد الانتظار", approved: "موافق عليه", rejected: "مرفوض",
  };

  const statusVariants: Record<string, "default" | "secondary" | "destructive"> = {
    pending: "secondary", approved: "default", rejected: "destructive",
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">الحوافز والمكافآت</h1>
          <p className="text-muted-foreground">نظام التحفيز والتكريم</p>
        </div>
      </div>

      <Tabs defaultValue="points" dir="rtl">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="points">النقاط</TabsTrigger>
          <TabsTrigger value="badges">الشارات</TabsTrigger>
          <TabsTrigger value="rewards">المكافآت</TabsTrigger>
          <TabsTrigger value="nominations">الترشيحات</TabsTrigger>
        </TabsList>

        {/* Points Tab */}
        <TabsContent value="points" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Trophy className="w-5 h-5 text-primary" />
                أعلى الطلاب نقاطاً
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topStudents.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">لا توجد نقاط مسجلة بعد</p>
              ) : (
                <div className="space-y-3">
                  {topStudents.map((s, i) => (
                    <div key={s.id} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div className="flex items-center gap-3">
                        <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          i === 0 ? "bg-yellow-100 text-yellow-700" :
                          i === 1 ? "bg-gray-100 text-gray-600" :
                          i === 2 ? "bg-orange-100 text-orange-700" :
                          "bg-muted text-muted-foreground"
                        }`}>
                          {i + 1}
                        </span>
                        <span className="font-medium text-sm">{s.full_name}</span>
                      </div>
                      <span className="font-bold text-primary">{s.total_points} نقطة</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Badges Tab */}
        <TabsContent value="badges" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={showAwardBadge} onOpenChange={setShowAwardBadge}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="w-4 h-4 ml-1" />منح شارة</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>منح شارة لطالب</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <Select value={badgeAward.student_id} onValueChange={(v) => setBadgeAward({ ...badgeAward, student_id: v })}>
                    <SelectTrigger><SelectValue placeholder="اختر الطالب" /></SelectTrigger>
                    <SelectContent>{students.map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={badgeAward.badge_id} onValueChange={(v) => setBadgeAward({ ...badgeAward, badge_id: v })}>
                    <SelectTrigger><SelectValue placeholder="اختر الشارة" /></SelectTrigger>
                    <SelectContent>{badges.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <Textarea placeholder="ملاحظة (اختياري)" value={badgeAward.note} onChange={(e) => setBadgeAward({ ...badgeAward, note: e.target.value })} />
                  <Button className="w-full" onClick={handleAwardBadge}>منح الشارة</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {badges.map((b) => {
              const Icon = iconMap[b.icon] || Award;
              return (
                <Card key={b.id} className="text-center">
                  <CardContent className="pt-6 pb-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
                      <Icon className="w-6 h-6 text-primary" />
                    </div>
                    <p className="font-semibold text-sm">{b.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{b.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {studentBadges.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-lg">آخر الشارات الممنوحة</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {studentBadges.map((sb) => {
                    const Icon = iconMap[sb.badges?.icon] || Award;
                    return (
                      <div key={sb.id} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div className="flex items-center gap-3">
                          <Icon className="w-5 h-5 text-primary" />
                          <div>
                            <p className="text-sm font-medium"><StudentNameLink studentId={sb.student_id} studentName={sb.students?.full_name || "—"} /></p>
                            <p className="text-xs text-muted-foreground">{sb.badges?.name}</p>
                            {sb.note && <p className="text-xs text-muted-foreground/70">{sb.note}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{new Date(sb.awarded_at).toLocaleDateString("ar-SA")}</span>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={async () => {
                            const newNote = prompt("تعديل الملاحظة:", sb.note || "");
                            if (newNote === null) return;
                            const { error } = await supabase.from("student_badges").update({ note: newNote }).eq("id", sb.id);
                            if (error) toast({ title: "خطأ", description: error.message, variant: "destructive" });
                            else { toast({ title: "تم التعديل" }); fetchAll(); }
                          }}>
                            <Pencil className="w-3 h-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={async () => {
                            if (!confirm("هل تريد حذف هذه الشارة؟")) return;
                            const { error } = await supabase.from("student_badges").delete().eq("id", sb.id);
                            if (error) toast({ title: "خطأ", description: error.message, variant: "destructive" });
                            else { toast({ title: "تم الحذف" }); fetchAll(); }
                          }}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Rewards Tab */}
        <TabsContent value="rewards" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={showNewReward} onOpenChange={setShowNewReward}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="w-4 h-4 ml-1" />إضافة مكافأة</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>إضافة مكافأة جديدة</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <Input placeholder="اسم المكافأة" value={newReward.name} onChange={(e) => setNewReward({ ...newReward, name: e.target.value })} />
                  <Textarea placeholder="الوصف" value={newReward.description} onChange={(e) => setNewReward({ ...newReward, description: e.target.value })} />
                  <Select value={newReward.reward_type} onValueChange={(v) => setNewReward({ ...newReward, reward_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="certificate">شهادة</SelectItem>
                      <SelectItem value="gift">هدية</SelectItem>
                      <SelectItem value="trip">رحلة</SelectItem>
                      <SelectItem value="recognition">تكريم</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input type="number" placeholder="النقاط المطلوبة" value={newReward.points_required} onChange={(e) => setNewReward({ ...newReward, points_required: Number(e.target.value) })} />
                  <Button className="w-full" onClick={handleCreateReward}>إنشاء المكافأة</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rewards.map((r) => (
              <Card key={r.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold">{r.name}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{r.description}</p>
                    </div>
                    <Badge variant="secondary">{rewardTypeLabels[r.reward_type] || r.reward_type}</Badge>
                  </div>
                  {r.points_required > 0 && (
                    <p className="text-xs text-muted-foreground mt-2">يتطلب {r.points_required} نقطة</p>
                  )}
                </CardContent>
              </Card>
            ))}
            {rewards.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8 col-span-2">لا توجد مكافآت بعد</p>
            )}
          </div>
        </TabsContent>

        {/* Nominations Tab */}
        <TabsContent value="nominations" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={showNominate} onOpenChange={setShowNominate}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="w-4 h-4 ml-1" />ترشيح طالب</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>ترشيح طالب لمكافأة</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <Select value={nomination.student_id} onValueChange={(v) => setNomination({ ...nomination, student_id: v })}>
                    <SelectTrigger><SelectValue placeholder="اختر الطالب" /></SelectTrigger>
                    <SelectContent>{students.map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={nomination.reward_id} onValueChange={(v) => setNomination({ ...nomination, reward_id: v })}>
                    <SelectTrigger><SelectValue placeholder="اختر المكافأة" /></SelectTrigger>
                    <SelectContent>{rewards.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <Textarea placeholder="سبب الترشيح" value={nomination.note} onChange={(e) => setNomination({ ...nomination, note: e.target.value })} />
                  <Button className="w-full" onClick={handleNominate}>ترشيح</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="space-y-3">
            {nominations.map((n) => (
              <Card key={n.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm"><StudentNameLink studentId={n.student_id} studentName={n.students?.full_name || "—"} /></p>
                      <p className="text-xs text-muted-foreground">{n.rewards?.name} — رشحه {n.profiles?.full_name}</p>
                      {n.note && <p className="text-xs text-muted-foreground mt-1">{n.note}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={statusVariants[n.status]}>{statusLabels[n.status]}</Badge>
                      {n.status === "pending" && (
                        <>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" onClick={() => handleApproveNomination(n.id, "approved")}>
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleApproveNomination(n.id, "rejected")}>
                            <X className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {nominations.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">لا توجد ترشيحات بعد</p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Rewards;
