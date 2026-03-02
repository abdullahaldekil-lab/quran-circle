import { useState, useEffect, useMemo } from "react";
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
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, DollarSign, TrendingUp, TrendingDown, Wallet,
  Calendar, FileText, CheckCircle2, Clock, XCircle,
  Loader2, Settings, ArrowUpRight, ArrowDownRight, Search,
  Download,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const INCOME_CATEGORIES: Record<string, string> = {
  student_fees: "رسوم الطلاب",
  donations: "تبرعات",
  sponsorships: "رعايات",
  activity_contributions: "مساهمات أنشطة",
  other_income: "إيرادات أخرى",
};

const EXPENSE_CATEGORIES: Record<string, string> = {
  teacher_salaries: "رواتب المعلمين",
  assistant_salaries: "رواتب المساعدين",
  rewards_incentives: "مكافآت وحوافز",
  trips_transportation: "رحلات ونقل",
  educational_supplies: "مستلزمات تعليمية",
  administrative: "مصاريف إدارية",
  other_expense: "مصاريف أخرى",
};

const Finance = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [account, setAccount] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [accountSettingsOpen, setAccountSettingsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterMonth, setFilterMonth] = useState<string>("");

  const isManager = profile?.role === "manager";
  const isFinanceStaff = profile?.role === "manager" || profile?.role === "admin_staff";

  const [form, setForm] = useState({
    transaction_type: "income" as "income" | "expense",
    category: "",
    amount: "",
    transaction_date: new Date().toISOString().split("T")[0],
    description: "",
    reference_number: "",
  });

  const [accountForm, setAccountForm] = useState({ bank_name: "", iban: "" });

  useEffect(() => {
    if (isFinanceStaff) fetchData();
    else setLoading(false);
  }, [isFinanceStaff]);

  const fetchData = async () => {
    let accRes = await supabase.from("financial_accounts").select("*").eq("status", "active").limit(1).maybeSingle();
    
    // Auto-create default account if none exists and user is manager
    if (!accRes.data && isManager) {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;
      const { data: newAcc } = await supabase.from("financial_accounts").insert({
        account_name: "الحساب الرسمي",
        created_by: userId,
      }).select("*").single();
      if (newAcc) {
        accRes = { data: newAcc, error: null, count: null, status: 200, statusText: "OK" } as any;
      }
    }

    const txRes = await supabase.from("financial_transactions").select("*, profiles!financial_transactions_created_by_fkey(full_name), profiles!financial_transactions_approved_by_fkey(full_name)").order("transaction_date", { ascending: false });
    
    setAccount(accRes.data);
    if (accRes.data) {
      setAccountForm({ bank_name: accRes.data.bank_name || "", iban: accRes.data.iban || "" });
    }
    setTransactions(txRes.data || []);
    setLoading(false);
  };

  const createTransaction = async () => {
    if (!form.category || !form.amount || !form.transaction_date) {
      toast({ title: "خطأ", description: "يرجى ملء الحقول المطلوبة", variant: "destructive" });
      return;
    }
    if (!account) return;
    setSaving(true);
    const { data: session } = await supabase.auth.getSession();
    const userId = session?.session?.user?.id;

    const { error } = await supabase.from("financial_transactions").insert({
      account_id: account.id,
      transaction_type: form.transaction_type,
      category: form.category,
      amount: parseFloat(form.amount),
      transaction_date: form.transaction_date,
      description: form.description || null,
      reference_number: form.reference_number || null,
      created_by: userId,
      status: isManager ? "approved" : "pending",
      approved_by: isManager ? userId : null,
      approved_at: isManager ? new Date().toISOString() : null,
    } as any);

    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    } else {
      // Log audit
      await supabase.from("financial_audit_log").insert({
        action: "create_transaction",
        details: `${form.transaction_type === "income" ? "إيراد" : "مصروف"}: ${form.amount} ر.س - ${INCOME_CATEGORIES[form.category] || EXPENSE_CATEGORIES[form.category] || form.category}`,
        performed_by: userId,
      } as any);
      toast({ title: "تم إضافة المعاملة بنجاح" });
      setCreateOpen(false);
      setForm({ transaction_type: "income", category: "", amount: "", transaction_date: new Date().toISOString().split("T")[0], description: "", reference_number: "" });
      fetchData();
    }
    setSaving(false);
  };

  const approveTransaction = async (txId: string) => {
    const { data: session } = await supabase.auth.getSession();
    const userId = session?.session?.user?.id;
    await supabase.from("financial_transactions").update({
      status: "approved", approved_by: userId, approved_at: new Date().toISOString(),
    } as any).eq("id", txId);
    await supabase.from("financial_audit_log").insert({
      transaction_id: txId, action: "approve", details: "تمت الموافقة على المعاملة", performed_by: userId,
    } as any);
    toast({ title: "تمت الموافقة" });
    fetchData();
  };

  const rejectTransaction = async (txId: string) => {
    const { data: session } = await supabase.auth.getSession();
    const userId = session?.session?.user?.id;
    await supabase.from("financial_transactions").update({ status: "rejected" } as any).eq("id", txId);
    await supabase.from("financial_audit_log").insert({
      transaction_id: txId, action: "reject", details: "تم رفض المعاملة", performed_by: userId,
    } as any);
    toast({ title: "تم الرفض" });
    fetchData();
  };

  const deleteTransaction = async (txId: string) => {
    const { data: session } = await supabase.auth.getSession();
    await supabase.from("financial_transactions").delete().eq("id", txId);
    await supabase.from("financial_audit_log").insert({
      transaction_id: txId, action: "delete", details: "تم حذف المعاملة", performed_by: session?.session?.user?.id,
    } as any);
    toast({ title: "تم الحذف" });
    fetchData();
  };

  const updateAccount = async () => {
    if (!account) return;
    setSaving(true);
    await supabase.from("financial_accounts").update({
      bank_name: accountForm.bank_name || null,
      iban: accountForm.iban || null,
    } as any).eq("id", account.id);
    toast({ title: "تم تحديث بيانات الحساب" });
    setAccountSettingsOpen(false);
    setSaving(false);
    fetchData();
  };

  // Calculations
  const approvedTx = transactions.filter((t) => t.status === "approved");
  const totalIncome = approvedTx.filter((t) => t.transaction_type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const totalExpense = approvedTx.filter((t) => t.transaction_type === "expense").reduce((s, t) => s + Number(t.amount), 0);
  const balance = totalIncome - totalExpense;
  const pendingCount = transactions.filter((t) => t.status === "pending").length;

  // Filtered transactions
  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (filterType !== "all" && t.transaction_type !== filterType) return false;
      if (filterMonth && !t.transaction_date.startsWith(filterMonth)) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const catLabel = INCOME_CATEGORIES[t.category] || EXPENSE_CATEGORIES[t.category] || t.category;
        return catLabel.includes(q) || (t.description || "").includes(q) || (t.reference_number || "").includes(q);
      }
      return true;
    });
  }, [transactions, filterType, filterMonth, searchQuery]);

  // Monthly report
  const monthlyReport = useMemo(() => {
    const months: Record<string, { income: number; expense: number }> = {};
    approvedTx.forEach((t) => {
      const month = t.transaction_date.substring(0, 7);
      if (!months[month]) months[month] = { income: 0, expense: 0 };
      if (t.transaction_type === "income") months[month].income += Number(t.amount);
      else months[month].expense += Number(t.amount);
    });
    return Object.entries(months).sort(([a], [b]) => b.localeCompare(a)).slice(0, 12);
  }, [approvedTx]);

  // Category report
  const categoryReport = useMemo(() => {
    const cats: Record<string, number> = {};
    approvedTx.filter((t) => t.transaction_type === "expense").forEach((t) => {
      const label = EXPENSE_CATEGORIES[t.category] || t.category;
      cats[label] = (cats[label] || 0) + Number(t.amount);
    });
    return Object.entries(cats).sort(([, a], [, b]) => b - a);
  }, [approvedTx]);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (!isFinanceStaff) {
    return (
      <div className="flex items-center justify-center py-20">
        <Card><CardContent className="p-8 text-center"><p className="text-muted-foreground">ليس لديك صلاحية الوصول للنظام المالي</p></CardContent></Card>
      </div>
    );
  }

  const categories = form.transaction_type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">الحسابات المالية</h1>
          <p className="text-sm text-muted-foreground">{account?.account_name || "الحساب الرسمي"}</p>
        </div>
        <div className="flex gap-2">
          {isManager && (
            <Dialog open={accountSettingsOpen} onOpenChange={setAccountSettingsOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm"><Settings className="w-4 h-4 ml-1" />إعدادات الحساب</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>إعدادات الحساب البنكي</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div><Label>اسم البنك</Label><Input value={accountForm.bank_name} onChange={(e) => setAccountForm({ ...accountForm, bank_name: e.target.value })} /></div>
                  <div><Label>رقم الآيبان (IBAN)</Label><Input value={accountForm.iban} onChange={(e) => setAccountForm({ ...accountForm, iban: e.target.value })} dir="ltr" /></div>
                  <Button onClick={updateAccount} disabled={saving} className="w-full">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "حفظ"}</Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 ml-1" />معاملة جديدة</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>إضافة معاملة مالية</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>النوع</Label>
                  <Select value={form.transaction_type} onValueChange={(v: "income" | "expense") => setForm({ ...form, transaction_type: v, category: "" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="income">إيراد</SelectItem>
                      <SelectItem value="expense">مصروف</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>التصنيف *</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger><SelectValue placeholder="اختر التصنيف" /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(categories).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>المبلغ (ر.س) *</Label><Input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} dir="ltr" /></div>
                  <div><Label>التاريخ *</Label><Input type="date" value={form.transaction_date} onChange={(e) => setForm({ ...form, transaction_date: e.target.value })} /></div>
                </div>
                <div><Label>رقم المرجع</Label><Input value={form.reference_number} onChange={(e) => setForm({ ...form, reference_number: e.target.value })} /></div>
                <div><Label>الوصف</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                <Button onClick={createTransaction} disabled={saving} className="w-full">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <Plus className="w-4 h-4 ml-1" />}
                  إضافة
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">الرصيد الحالي</span>
            </div>
            <p className={`text-xl font-bold ${balance >= 0 ? "text-success" : "text-destructive"}`}>
              {balance.toLocaleString("ar-SA")} <span className="text-xs">ر.س</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-success" />
              <span className="text-xs text-muted-foreground">إجمالي الإيرادات</span>
            </div>
            <p className="text-xl font-bold text-success">{totalIncome.toLocaleString("ar-SA")} <span className="text-xs">ر.س</span></p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="w-4 h-4 text-destructive" />
              <span className="text-xs text-muted-foreground">إجمالي المصروفات</span>
            </div>
            <p className="text-xl font-bold text-destructive">{totalExpense.toLocaleString("ar-SA")} <span className="text-xs">ر.س</span></p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-warning" />
              <span className="text-xs text-muted-foreground">بانتظار الموافقة</span>
            </div>
            <p className="text-xl font-bold text-warning">{pendingCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="transactions">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="transactions">المعاملات</TabsTrigger>
          <TabsTrigger value="monthly">التقرير الشهري</TabsTrigger>
          <TabsTrigger value="categories">حسب التصنيف</TabsTrigger>
        </TabsList>

        {/* Export PDF button */}
        <div className="flex justify-end mt-2">
          <Button variant="outline" size="sm" onClick={() => {
            const doc = new jsPDF({ putOnlyUsedFonts: true });
            doc.setFont("helvetica");
            doc.text("Financial Report", 14, 15);
            
            // Monthly report table
            const monthRows = monthlyReport.map(([m, d]) => [m, d.income.toLocaleString(), d.expense.toLocaleString(), (d.income - d.expense).toLocaleString()]);
            autoTable(doc, {
              startY: 25,
              head: [["Month", "Income", "Expense", "Net"]],
              body: monthRows,
            });

            // Category report table
            const catRows = categoryReport.map(([cat, amt]) => [cat, (amt as number).toLocaleString()]);
            autoTable(doc, {
              startY: (doc as any).lastAutoTable?.finalY + 10 || 80,
              head: [["Category", "Amount"]],
              body: catRows,
            });

            doc.save("financial-report.pdf");
            toast({ title: "تم تصدير التقرير" });
          }}>
            <Download className="w-4 h-4 ml-1" />تصدير PDF
          </Button>
        </div>

        {/* Transactions Tab */}
        <TabsContent value="transactions" className="space-y-3 mt-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="بحث..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pr-9" />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل</SelectItem>
                <SelectItem value="income">إيراد</SelectItem>
                <SelectItem value="expense">مصروف</SelectItem>
              </SelectContent>
            </Select>
            <Input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="w-40" />
          </div>

          {filtered.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">لا توجد معاملات</CardContent></Card>
          ) : (
            <div className="space-y-2">
              {filtered.map((tx) => (
                <TransactionCard key={tx.id} tx={tx} isManager={isManager}
                  onApprove={() => approveTransaction(tx.id)}
                  onReject={() => rejectTransaction(tx.id)}
                  onDelete={() => deleteTransaction(tx.id)} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Monthly Report Tab */}
        <TabsContent value="monthly" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">التقرير الشهري</CardTitle></CardHeader>
            <CardContent>
              {monthlyReport.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">لا توجد بيانات</p>
              ) : (
                <div className="space-y-3">
                  {monthlyReport.map(([month, data]) => {
                    const net = data.income - data.expense;
                    return (
                      <div key={month} className="p-3 rounded-lg border">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-sm">{month}</span>
                          <span className={`text-sm font-bold ${net >= 0 ? "text-success" : "text-destructive"}`}>
                            {net >= 0 ? "+" : ""}{net.toLocaleString("ar-SA")} ر.س
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="flex items-center gap-1 text-success">
                            <ArrowUpRight className="w-3 h-3" />
                            إيرادات: {data.income.toLocaleString("ar-SA")} ر.س
                          </div>
                          <div className="flex items-center gap-1 text-destructive">
                            <ArrowDownRight className="w-3 h-3" />
                            مصروفات: {data.expense.toLocaleString("ar-SA")} ر.س
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Category Report Tab */}
        <TabsContent value="categories" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">توزيع المصروفات حسب التصنيف</CardTitle></CardHeader>
            <CardContent>
              {categoryReport.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">لا توجد مصروفات</p>
              ) : (
                <div className="space-y-3">
                  {categoryReport.map(([cat, amount]) => {
                    const pct = totalExpense > 0 ? Math.round((amount / totalExpense) * 100) : 0;
                    return (
                      <div key={cat}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span>{cat}</span>
                          <span className="text-muted-foreground">{amount.toLocaleString("ar-SA")} ر.س ({pct}%)</span>
                        </div>
                        <Progress value={pct} className="h-2" />
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

const TransactionCard = ({ tx, isManager, onApprove, onReject, onDelete }: any) => {
  const isIncome = tx.transaction_type === "income";
  const catLabel = INCOME_CATEGORIES[tx.category] || EXPENSE_CATEGORIES[tx.category] || tx.category;

  const statusBadge = () => {
    switch (tx.status) {
      case "approved": return <Badge variant="secondary" className="text-[10px] bg-success/15 text-success gap-1"><CheckCircle2 className="w-2.5 h-2.5" />معتمد</Badge>;
      case "pending": return <Badge variant="secondary" className="text-[10px] bg-warning/15 text-warning gap-1"><Clock className="w-2.5 h-2.5" />بانتظار الموافقة</Badge>;
      case "rejected": return <Badge variant="secondary" className="text-[10px] bg-destructive/15 text-destructive gap-1"><XCircle className="w-2.5 h-2.5" />مرفوض</Badge>;
      default: return null;
    }
  };

  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isIncome ? "bg-success/15" : "bg-destructive/15"}`}>
              {isIncome ? <ArrowUpRight className="w-4 h-4 text-success" /> : <ArrowDownRight className="w-4 h-4 text-destructive" />}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium">{catLabel}</span>
                {statusBadge()}
              </div>
              {tx.description && <p className="text-xs text-muted-foreground mt-0.5">{tx.description}</p>}
              <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-0.5"><Calendar className="w-2.5 h-2.5" />{tx.transaction_date}</span>
                {tx.reference_number && <span className="flex items-center gap-0.5"><FileText className="w-2.5 h-2.5" />{tx.reference_number}</span>}
              </div>
            </div>
          </div>
          <div className="text-left shrink-0">
            <p className={`text-sm font-bold ${isIncome ? "text-success" : "text-destructive"}`}>
              {isIncome ? "+" : "-"}{Number(tx.amount).toLocaleString("ar-SA")} <span className="text-[10px]">ر.س</span>
            </p>
            {isManager && tx.status === "pending" && (
              <div className="flex gap-1 mt-1">
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-success" onClick={onApprove}><CheckCircle2 className="w-3.5 h-3.5" /></Button>
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive" onClick={onReject}><XCircle className="w-3.5 h-3.5" /></Button>
              </div>
            )}
            {isManager && tx.status !== "approved" && (
              <Button size="sm" variant="ghost" className="h-6 text-[10px] text-destructive mt-1" onClick={onDelete}>حذف</Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default Finance;
