import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Upload, Trash2, UserPlus, Users } from "lucide-react";

interface PendingStudent {
  name: string;
  halaqa_id: string;
  halaqa_name: string;
}

const BulkImport = () => {
  const [halaqat, setHalaqat] = useState<any[]>([]);
  const [namesText, setNamesText] = useState("");
  const [selectedHalaqa, setSelectedHalaqa] = useState("");
  const [pendingStudents, setPendingStudents] = useState<PendingStudent[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchHalaqat = async () => {
      const { data } = await supabase.from("halaqat").select("*").eq("active", true).order("name");
      setHalaqat(data || []);
    };
    fetchHalaqat();
  }, []);

  const handleAddNames = () => {
    if (!namesText.trim()) {
      toast.error("أدخل أسماء الطلاب أولاً");
      return;
    }
    if (!selectedHalaqa) {
      toast.error("اختر الحلقة أولاً");
      return;
    }

    const halaqaObj = halaqat.find((h) => h.id === selectedHalaqa);
    if (!halaqaObj) return;

    const names = namesText
      .split("\n")
      .map((n) => n.trim())
      .filter((n) => n.length > 0);

    if (names.length === 0) {
      toast.error("لم يتم العثور على أسماء صالحة");
      return;
    }

    const newStudents: PendingStudent[] = names.map((name) => ({
      name,
      halaqa_id: selectedHalaqa,
      halaqa_name: halaqaObj.name,
    }));

    setPendingStudents((prev) => [...prev, ...newStudents]);
    setNamesText("");
    toast.success(`تمت إضافة ${names.length} طالب إلى القائمة`);
  };

  const handleRemove = (index: number) => {
    setPendingStudents((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveAll = async () => {
    if (pendingStudents.length === 0) {
      toast.error("لا يوجد طلاب للحفظ");
      return;
    }

    setSaving(true);
    const records = pendingStudents.map((s) => ({
      full_name: s.name,
      halaqa_id: s.halaqa_id,
      status: "active" as const,
      current_level: "مبتدئ",
    }));

    const { error } = await supabase.from("students").insert(records);

    if (error) {
      toast.error("حدث خطأ أثناء الحفظ: " + error.message);
      setSaving(false);
      return;
    }

    toast.success(`تم حفظ ${pendingStudents.length} طالب بنجاح`);
    setPendingStudents([]);
    setSaving(false);
  };

  const groupedByHalaqa = pendingStudents.reduce<Record<string, PendingStudent[]>>((acc, s) => {
    if (!acc[s.halaqa_name]) acc[s.halaqa_name] = [];
    acc[s.halaqa_name].push(s);
    return acc;
  }, {});

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">إضافة طلاب جماعية</h1>
        <p className="text-muted-foreground text-sm">أضف عدة طلاب دفعة واحدة وعيّن كل مجموعة لحلقتها</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            إدخال الأسماء
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>الحلقة</Label>
            <Select value={selectedHalaqa} onValueChange={setSelectedHalaqa}>
              <SelectTrigger>
                <SelectValue placeholder="اختر الحلقة" />
              </SelectTrigger>
              <SelectContent>
                {halaqat.map((h) => (
                  <SelectItem key={h.id} value={h.id}>
                    {h.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>أسماء الطلاب (اسم واحد في كل سطر)</Label>
            <Textarea
              value={namesText}
              onChange={(e) => setNamesText(e.target.value)}
              placeholder={"محمد أحمد\nعلي سعد\nخالد عبدالله"}
              rows={8}
              className="font-medium"
            />
          </div>

          <Button onClick={handleAddNames} className="w-full">
            <Upload className="w-4 h-4 ml-2" />
            إضافة إلى القائمة
          </Button>
        </CardContent>
      </Card>

      {pendingStudents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                قائمة الطلاب ({pendingStudents.length})
              </span>
              <Button onClick={handleSaveAll} disabled={saving}>
                {saving ? "جارٍ الحفظ..." : `حفظ الكل (${pendingStudents.length})`}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(groupedByHalaqa).map(([halaqaName, students]) => (
              <div key={halaqaName} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{halaqaName}</Badge>
                  <span className="text-xs text-muted-foreground">({students.length} طالب)</span>
                </div>
                <div className="border rounded-lg divide-y">
                  {students.map((s) => {
                    const globalIndex = pendingStudents.indexOf(s);
                    return (
                      <div key={globalIndex} className="flex items-center justify-between px-3 py-2">
                        <span className="text-sm">{s.name}</span>
                        <Button variant="ghost" size="icon" onClick={() => handleRemove(globalIndex)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default BulkImport;
