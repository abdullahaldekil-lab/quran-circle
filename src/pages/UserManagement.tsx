import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { formatDateSmart, formatDateTimeSmart } from "@/lib/hijri";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  Users,
  UserPlus,
  Shield,
  ClipboardList,
  Search,
  CheckCircle,
  XCircle,
  Link2,
  KeyRound,
  Ban,
  UserCheck,
  Pencil,
  Trash2,
} from "lucide-react";

const roleLabels: Record<string, string> = {
  manager: "مدير المجمع",
  supervisor: "مشرف تعليمي",
  assistant_supervisor: "مساعد مشرف",
  secretary: "سكرتير",
  admin_staff: "موظف إداري",
  teacher: "معلم",
  assistant_teacher: "معلم مساعد",
};

const approvalLabels: Record<string, string> = {
  pending: "بانتظار الموافقة",
  approved: "مُعتمد",
  rejected: "مرفوض",
};

const callEdgeFunction = async (action: string, payload: any) => {
  const res = await supabase.functions.invoke("manage-users", {
    body: { action, ...payload },
  });
  if (res.error) throw new Error(res.error.message);
  if (res.data?.error) throw new Error(res.data.error);
  return res.data;
};

const UserManagement = () => {
  const { user } = useAuth();
  const { isManager } = useRole();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [createStaffOpen, setCreateStaffOpen] = useState(false);
  const [createGuardianOpen, setCreateGuardianOpen] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [selectedGuardian, setSelectedGuardian] = useState<string | null>(null);

  // Password dialog state
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordTarget, setPasswordTarget] = useState<any>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Edit user dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<any>(null);
  const [editForm, setEditForm] = useState({ full_name: "", phone: "", position_title: "", role: "", email: "" });

  // Delete confirmation state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  // Staff list
  const { data: staffList = [], isLoading: staffLoading } = useQuery({
    queryKey: ["staff-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Guardian list
  const { data: guardianList = [], isLoading: guardianLoading } = useQuery({
    queryKey: ["guardian-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guardian_profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Students for linking
  const { data: students = [] } = useQuery({
    queryKey: ["students-for-linking"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id, full_name, halaqa_id")
        .eq("status", "active")
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  // Guardian-student links
  const { data: guardianLinks = [] } = useQuery({
    queryKey: ["guardian-links", selectedGuardian],
    queryFn: async () => {
      if (!selectedGuardian) return [];
      const { data, error } = await supabase
        .from("guardian_students")
        .select("*, students(full_name)")
        .eq("guardian_id", selectedGuardian)
        .eq("active", true);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedGuardian,
  });

  // Audit log
  const { data: auditLog = [] } = useQuery({
    queryKey: ["audit-log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
    enabled: isManager,
  });

  const pendingGuardians = guardianList.filter((g: any) => g.approval_status === "pending");

  const filteredStaff = staffList.filter((s: any) => {
    const matchSearch =
      !search ||
      s.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      s.phone?.includes(search);
    const matchRole = roleFilter === "all" || s.role === roleFilter;
    const matchStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && s.active) ||
      (statusFilter === "inactive" && !s.active);
    return matchSearch && matchRole && matchStatus;
  });

  // --- Mutations ---
  const createStaffMutation = useMutation({
    mutationFn: (data: any) => callEdgeFunction("create_staff", data),
    onSuccess: (data) => {
      toast.success("تم إنشاء الحساب بنجاح");
      if (data.temp_password) {
        toast.info(`كلمة المرور المؤقتة: ${data.temp_password}`, { duration: 15000 });
      }
      queryClient.invalidateQueries({ queryKey: ["staff-users"] });
      setCreateStaffOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const createGuardianMutation = useMutation({
    mutationFn: (data: any) => callEdgeFunction("create_guardian", data),
    onSuccess: (data) => {
      toast.success("تم إنشاء حساب ولي الأمر بنجاح");
      if (data.temp_password) {
        toast.info(`كلمة المرور المؤقتة: ${data.temp_password}`, { duration: 15000 });
      }
      queryClient.invalidateQueries({ queryKey: ["guardian-users"] });
      setCreateGuardianOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const approveGuardianMutation = useMutation({
    mutationFn: (data: { guardian_id: string; approved: boolean }) =>
      callEdgeFunction("approve_guardian", data),
    onSuccess: () => {
      toast.success("تم تحديث حالة ولي الأمر");
      queryClient.invalidateQueries({ queryKey: ["guardian-users"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateStatusMutation = useMutation({
    mutationFn: (data: any) => callEdgeFunction("update_status", data),
    onSuccess: () => {
      toast.success("تم تحديث الحالة");
      queryClient.invalidateQueries({ queryKey: ["staff-users"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateRoleMutation = useMutation({
    mutationFn: (data: any) => callEdgeFunction("update_role", data),
    onSuccess: () => {
      toast.success("تم تحديث الدور");
      queryClient.invalidateQueries({ queryKey: ["staff-users"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const adminSetPasswordMutation = useMutation({
    mutationFn: (data: any) => callEdgeFunction("admin_set_password", data),
    onSuccess: () => {
      toast.success("تم تعيين كلمة المرور الجديدة بنجاح");
      setPasswordDialogOpen(false);
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const adminEditUserMutation = useMutation({
    mutationFn: (data: any) => callEdgeFunction("admin_edit_user", data),
    onSuccess: () => {
      toast.success("تم تحديث بيانات المستخدم");
      queryClient.invalidateQueries({ queryKey: ["staff-users"] });
      setEditDialogOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const adminDeleteUserMutation = useMutation({
    mutationFn: (data: any) => callEdgeFunction("admin_delete_user", data),
    onSuccess: () => {
      toast.success("تم تعطيل المستخدم بنجاح");
      queryClient.invalidateQueries({ queryKey: ["staff-users"] });
      setDeleteDialogOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const linkGuardianMutation = useMutation({
    mutationFn: (data: any) => callEdgeFunction("link_guardian_student", data),
    onSuccess: () => {
      toast.success("تم ربط ولي الأمر بالطالب");
      queryClient.invalidateQueries({ queryKey: ["guardian-links"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const unlinkMutation = useMutation({
    mutationFn: (data: any) => callEdgeFunction("unlink_guardian_student", data),
    onSuccess: () => {
      toast.success("تم إلغاء الربط");
      queryClient.invalidateQueries({ queryKey: ["guardian-links"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openPasswordDialog = (staff: any) => {
    setPasswordTarget(staff);
    setNewPassword("");
    setConfirmPassword("");
    setPasswordDialogOpen(true);
  };

  const adminUpdateEmailMutation = useMutation({
    mutationFn: (data: any) => callEdgeFunction("admin_update_email", data),
    onSuccess: () => {
      toast.success("تم تحديث البريد الإلكتروني بنجاح");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openEditDialog = (staff: any) => {
    setEditTarget(staff);
    setEditForm({
      full_name: staff.full_name || "",
      phone: staff.phone || "",
      position_title: staff.position_title || "",
      role: staff.role || "teacher",
      email: "",
    });
    setEditDialogOpen(true);
  };

  const openDeleteDialog = (staff: any) => {
    setDeleteTarget(staff);
    setDeleteDialogOpen(true);
  };

  const handleSetPassword = () => {
    if (!newPassword || newPassword.length < 8) {
      toast.error("كلمة المرور يجب أن تكون 8 أحرف على الأقل");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("كلمة المرور غير متطابقة");
      return;
    }
    adminSetPasswordMutation.mutate({ user_id: passwordTarget.id, new_password: newPassword });
  };

  const handleEditUser = async () => {
    const { email, ...profileData } = editForm;
    adminEditUserMutation.mutate({ user_id: editTarget.id, ...profileData });
    if (email && email.trim()) {
      adminUpdateEmailMutation.mutate({ user_id: editTarget.id, new_email: email.trim() });
    }
  };

  const actionLabels: Record<string, string> = {
    user_created: "إنشاء حساب",
    guardian_invited: "دعوة ولي أمر",
    guardian_approved: "اعتماد ولي أمر",
    guardian_rejected: "رفض ولي أمر",
    status_changed: "تغيير الحالة",
    role_changed: "تغيير الدور",
    password_reset: "إعادة تعيين كلمة المرور",
    password_set_by_admin: "تعيين كلمة مرور من المدير",
    password_changed_self: "تغيير كلمة المرور الذاتي",
    user_edited: "تعديل بيانات مستخدم",
    email_updated: "تحديث البريد الإلكتروني",
    user_deleted: "حذف مستخدم",
    guardian_linked: "ربط ولي أمر بطالب",
    guardian_unlinked: "إلغاء ربط ولي أمر",
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">إدارة المستخدمين</h1>
          <p className="text-muted-foreground">إدارة حسابات الموظفين وأولياء الأمور</p>
        </div>
        {isManager && (
          <div className="flex gap-2">
            <Dialog open={createStaffOpen} onOpenChange={setCreateStaffOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="w-4 h-4 ml-2" />
                  إضافة موظف
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>إنشاء حساب موظف</DialogTitle>
                </DialogHeader>
                <CreateStaffForm
                  onSubmit={(data) => createStaffMutation.mutate(data)}
                  loading={createStaffMutation.isPending}
                />
              </DialogContent>
            </Dialog>

            <Dialog open={createGuardianOpen} onOpenChange={setCreateGuardianOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <UserPlus className="w-4 h-4 ml-2" />
                  دعوة ولي أمر
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>دعوة ولي أمر</DialogTitle>
                </DialogHeader>
                <CreateGuardianForm
                  onSubmit={(data) => createGuardianMutation.mutate(data)}
                  loading={createGuardianMutation.isPending}
                />
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      <Tabs defaultValue="staff" className="space-y-4">
        <TabsList>
          <TabsTrigger value="staff">
            <Users className="w-4 h-4 ml-1" />
            الموظفون ({staffList.length})
          </TabsTrigger>
          <TabsTrigger value="guardians">
            <Shield className="w-4 h-4 ml-1" />
            أولياء الأمور ({guardianList.length})
          </TabsTrigger>
          {pendingGuardians.length > 0 && (
            <TabsTrigger value="approvals">
              <UserCheck className="w-4 h-4 ml-1" />
              الموافقات ({pendingGuardians.length})
            </TabsTrigger>
          )}
          {isManager && (
            <TabsTrigger value="audit">
              <ClipboardList className="w-4 h-4 ml-1" />
              سجل التدقيق
            </TabsTrigger>
          )}
        </TabsList>

        {/* Staff Tab */}
        <TabsContent value="staff" className="space-y-4">
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="بحث بالاسم أو الهاتف..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pr-10"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="الدور" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الأدوار</SelectItem>
                {Object.entries(roleLabels).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="الحالة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل</SelectItem>
                <SelectItem value="active">نشط</SelectItem>
                <SelectItem value="inactive">غير نشط</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الاسم</TableHead>
                    <TableHead>الهاتف</TableHead>
                    <TableHead>الدور</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>تاريخ الإنشاء</TableHead>
                    {isManager && <TableHead>إجراءات</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staffLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">جارٍ التحميل...</TableCell>
                    </TableRow>
                  ) : filteredStaff.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">لا توجد نتائج</TableCell>
                    </TableRow>
                  ) : (
                    filteredStaff.map((s: any) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.full_name}</TableCell>
                        <TableCell dir="ltr">{s.phone || "-"}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{roleLabels[s.role] || s.role}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={s.active ? "default" : "destructive"}>
                            {s.active ? "نشط" : "غير نشط"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {formatDateSmart(s.created_at)}
                        </TableCell>
                        {isManager && (
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                title="تعديل البيانات"
                                onClick={() => openEditDialog(s)}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="تعيين كلمة مرور"
                                onClick={() => openPasswordDialog(s)}
                              >
                                <KeyRound className="w-4 h-4" />
                              </Button>
                              {s.active ? (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="تعطيل"
                                  onClick={() =>
                                    updateStatusMutation.mutate({
                                      user_id: s.id,
                                      status: "suspended",
                                      user_type: "staff",
                                    })
                                  }
                                >
                                  <Ban className="w-4 h-4 text-destructive" />
                                </Button>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="تفعيل"
                                  onClick={() =>
                                    updateStatusMutation.mutate({
                                      user_id: s.id,
                                      status: "active",
                                      user_type: "staff",
                                    })
                                  }
                                >
                                  <CheckCircle className="w-4 h-4 text-primary" />
                                </Button>
                              )}
                              {s.id !== user?.id && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="حذف المستخدم"
                                  onClick={() => openDeleteDialog(s)}
                                >
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Reserve Teachers Section */}
          {(() => {
            const reserveTeachers = staffList.filter((s: any) => s.is_reserve && s.active && (s.role === "teacher" || s.role === "assistant_teacher"));
            if (reserveTeachers.length === 0) return null;
            return (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    المعلمون الاحتياطيون ({reserveTeachers.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>الاسم</TableHead>
                        <TableHead>الهاتف</TableHead>
                        <TableHead>الدور</TableHead>
                        <TableHead>تاريخ الإضافة</TableHead>
                        <TableHead>الحالة</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reserveTeachers.map((s: any) => (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium">{s.full_name}</TableCell>
                          <TableCell dir="ltr">{s.phone || "-"}</TableCell>
                          <TableCell><Badge variant="secondary">{roleLabels[s.role] || s.role}</Badge></TableCell>
                          <TableCell className="text-muted-foreground text-sm">{formatDateSmart(s.created_at)}</TableCell>
                          <TableCell><Badge variant="outline" className="bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">احتياطي</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            );
          })()}
        </TabsContent>

        {/* Guardians Tab */}
        <TabsContent value="guardians" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الاسم</TableHead>
                    <TableHead>الهاتف</TableHead>
                    <TableHead>حالة الاعتماد</TableHead>
                    <TableHead>تاريخ الإنشاء</TableHead>
                    {isManager && <TableHead>إجراءات</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {guardianLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">جارٍ التحميل...</TableCell>
                    </TableRow>
                  ) : guardianList.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">لا يوجد أولياء أمور</TableCell>
                    </TableRow>
                  ) : (
                    guardianList.map((g: any) => (
                      <TableRow key={g.id}>
                        <TableCell className="font-medium">{g.full_name}</TableCell>
                        <TableCell dir="ltr">{g.phone || "-"}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              g.approval_status === "approved"
                                ? "default"
                                : g.approval_status === "rejected"
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {approvalLabels[g.approval_status] || g.approval_status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {formatDateSmart(g.created_at)}
                        </TableCell>
                        {isManager && (
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                title="ربط بطالب"
                                onClick={() => {
                                  setSelectedGuardian(g.id);
                                  setLinkDialogOpen(true);
                                }}
                              >
                                <Link2 className="w-4 h-4" />
                              </Button>
                              {g.approval_status === "pending" && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    title="اعتماد"
                                    onClick={() =>
                                      approveGuardianMutation.mutate({ guardian_id: g.id, approved: true })
                                    }
                                  >
                                    <CheckCircle className="w-4 h-4 text-primary" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    title="رفض"
                                    onClick={() =>
                                      approveGuardianMutation.mutate({ guardian_id: g.id, approved: false })
                                    }
                                  >
                                    <XCircle className="w-4 h-4 text-destructive" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Approvals Tab */}
        <TabsContent value="approvals" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>طلبات اعتماد أولياء الأمور</CardTitle>
            </CardHeader>
            <CardContent>
              {pendingGuardians.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">لا توجد طلبات معلقة</p>
              ) : (
                <div className="space-y-3">
                  {pendingGuardians.map((g: any) => (
                    <div key={g.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">{g.full_name}</p>
                        <p className="text-sm text-muted-foreground" dir="ltr">{g.phone}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => approveGuardianMutation.mutate({ guardian_id: g.id, approved: true })}
                          disabled={approveGuardianMutation.isPending}
                        >
                          <CheckCircle className="w-4 h-4 ml-1" />
                          اعتماد
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => approveGuardianMutation.mutate({ guardian_id: g.id, approved: false })}
                          disabled={approveGuardianMutation.isPending}
                        >
                          <XCircle className="w-4 h-4 ml-1" />
                          رفض
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audit Log Tab */}
        {isManager && (
          <TabsContent value="audit" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>سجل التدقيق</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الإجراء</TableHead>
                      <TableHead>التفاصيل</TableHead>
                      <TableHead>التاريخ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLog.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">لا توجد سجلات</TableCell>
                      </TableRow>
                    ) : (
                      auditLog.map((log: any) => (
                        <TableRow key={log.id}>
                          <TableCell>
                            <Badge variant="outline">
                              {actionLabels[log.action_type] || log.action_type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{log.details}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {formatDateTimeSmart(log.created_at)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Link Guardian Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ربط ولي الأمر بطالب</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {guardianLinks.length > 0 && (
              <div className="space-y-2">
                <Label>الطلاب المرتبطون حالياً:</Label>
                {guardianLinks.map((link: any) => (
                  <div key={link.id} className="flex items-center justify-between p-2 bg-muted rounded">
                    <span className="text-sm">{link.students?.full_name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() =>
                        unlinkMutation.mutate({ guardian_id: selectedGuardian, student_id: link.student_id })
                      }
                    >
                      إلغاء الربط
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <LinkStudentForm
              students={students}
              linkedIds={guardianLinks.map((l: any) => l.student_id)}
              onLink={(studentId, relationship) =>
                linkGuardianMutation.mutate({ guardian_id: selectedGuardian, student_id: studentId, relationship })
              }
              loading={linkGuardianMutation.isPending}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Admin Set Password Dialog */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تعيين كلمة مرور جديدة</DialogTitle>
            <DialogDescription>
              تعيين كلمة مرور جديدة للمستخدم: {passwordTarget?.full_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>كلمة المرور الجديدة *</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                dir="ltr"
                minLength={8}
                placeholder="8 أحرف على الأقل"
              />
            </div>
            <div className="space-y-2">
              <Label>تأكيد كلمة المرور *</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                dir="ltr"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordDialogOpen(false)}>إلغاء</Button>
            <Button onClick={handleSetPassword} disabled={adminSetPasswordMutation.isPending}>
              {adminSetPasswordMutation.isPending ? "جارٍ التحديث..." : "تعيين كلمة المرور"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Admin Edit User Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تعديل بيانات المستخدم</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>الاسم الكامل *</Label>
              <Input
                value={editForm.full_name}
                onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>رقم الهاتف</Label>
              <Input
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label>المسمى الوظيفي</Label>
              <Input
                value={editForm.position_title}
                onChange={(e) => setEditForm({ ...editForm, position_title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>الدور</Label>
              <Select value={editForm.role} onValueChange={(v) => setEditForm({ ...editForm, role: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(roleLabels).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>البريد الإلكتروني الجديد</Label>
              <Input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                dir="ltr"
                placeholder="اتركه فارغاً إذا لا تريد تغييره"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>إلغاء</Button>
            <Button onClick={handleEditUser} disabled={adminEditUserMutation.isPending}>
              {adminEditUserMutation.isPending ? "جارٍ الحفظ..." : "حفظ التغييرات"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد حذف المستخدم</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف المستخدم "{deleteTarget?.full_name}"؟
              سيتم تعطيل الحساب ولن يتمكن من تسجيل الدخول.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => adminDeleteUserMutation.mutate({ user_id: deleteTarget?.id })}
            >
              {adminDeleteUserMutation.isPending ? "جارٍ الحذف..." : "حذف المستخدم"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// --- Sub-components ---

const CreateStaffForm = ({ onSubmit, loading }: { onSubmit: (data: any) => void; loading: boolean }) => {
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", role: "teacher" });
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedHalaqaId, setSelectedHalaqaId] = useState("");
  const [availableHalaqat, setAvailableHalaqat] = useState<any[]>([]);
  const [loadingHalaqat, setLoadingHalaqat] = useState(false);

  const isTeacherRole = form.role === "teacher" || form.role === "assistant_teacher";

  const fetchAvailableHalaqat = async (role: string) => {
    setLoadingHalaqat(true);
    const { data } = await supabase
      .from("halaqat")
      .select("id, name, teacher_id, assistant_teacher_id")
      .eq("active", true);
    const halaqat = data || [];
    const available = role === "teacher"
      ? halaqat.filter((h: any) => !h.teacher_id)
      : halaqat.filter((h: any) => !h.assistant_teacher_id);
    setAvailableHalaqat(available);
    setLoadingHalaqat(false);
  };

  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isTeacherRole) {
      fetchAvailableHalaqat(form.role);
      setStep(2);
    } else {
      onSubmit(form);
    }
  };

  const handleStep2Submit = () => {
    if (selectedHalaqaId) {
      onSubmit({ ...form, halaqa_id: selectedHalaqaId, is_reserve: false });
    } else {
      onSubmit({ ...form, is_reserve: true });
    }
  };

  if (step === 2 && isTeacherRole) {
    const noHalaqat = !loadingHalaqat && availableHalaqat.length === 0;
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Button variant="ghost" size="sm" onClick={() => setStep(1)}>← رجوع</Button>
          <h3 className="font-semibold">تعيين الحلقة</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          {form.role === "teacher" ? "اختر حلقة لتعيين المعلم عليها" : "اختر حلقة لتعيين المعلم المساعد عليها"}
        </p>

        {loadingHalaqat ? (
          <div className="flex justify-center py-6">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : noHalaqat ? (
          <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 space-y-2">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              ⚠️ لا توجد حلقات شاغرة حالياً
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-300">
              سيُضاف المعلم كمعلم احتياطي ويمكن تعيينه لاحقاً عند توفر حلقة شاغرة.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <Label>الحلقات المتاحة</Label>
            <Select value={selectedHalaqaId} onValueChange={setSelectedHalaqaId}>
              <SelectTrigger><SelectValue placeholder="اختر حلقة..." /></SelectTrigger>
              <SelectContent>
                {availableHalaqat.map((h: any) => (
                  <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <Button onClick={handleStep2Submit} className="w-full" disabled={loading}>
          {loading ? "جارٍ الإنشاء..." : noHalaqat ? "إضافة كمعلم احتياطي" : selectedHalaqaId ? "إنشاء وتعيين الحلقة" : "إضافة كمعلم احتياطي"}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleStep1Submit} className="space-y-4">
      <div className="space-y-2">
        <Label>الاسم الكامل *</Label>
        <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
      </div>
      <div className="space-y-2">
        <Label>البريد الإلكتروني *</Label>
        <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required dir="ltr" />
      </div>
      <div className="space-y-2">
        <Label>رقم الهاتف</Label>
        <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} dir="ltr" />
      </div>
      <div className="space-y-2">
        <Label>الدور *</Label>
        <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(roleLabels).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {isTeacherRole ? "التالي — تعيين الحلقة" : loading ? "جارٍ الإنشاء..." : "إنشاء الحساب"}
      </Button>
    </form>
  );
};

const CreateGuardianForm = ({ onSubmit, loading }: { onSubmit: (data: any) => void; loading: boolean }) => {
  const [form, setForm] = useState({ full_name: "", phone: "", email: "" });

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
      <div className="space-y-2">
        <Label>اسم ولي الأمر *</Label>
        <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
      </div>
      <div className="space-y-2">
        <Label>رقم الهاتف *</Label>
        <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required dir="ltr" />
      </div>
      <div className="space-y-2">
        <Label>البريد الإلكتروني (اختياري)</Label>
        <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} dir="ltr" />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "جارٍ الإنشاء..." : "دعوة ولي الأمر"}
      </Button>
    </form>
  );
};

const LinkStudentForm = ({
  students, linkedIds, onLink, loading,
}: {
  students: any[]; linkedIds: string[];
  onLink: (studentId: string, relationship: string) => void; loading: boolean;
}) => {
  const [studentId, setStudentId] = useState("");
  const [relationship, setRelationship] = useState("أب");
  const available = students.filter((s) => !linkedIds.includes(s.id));

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>اختر الطالب</Label>
        <Select value={studentId} onValueChange={setStudentId}>
          <SelectTrigger><SelectValue placeholder="اختر طالباً..." /></SelectTrigger>
          <SelectContent>
            {available.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>صلة القرابة</Label>
        <Select value={relationship} onValueChange={setRelationship}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="أب">أب</SelectItem>
            <SelectItem value="أم">أم</SelectItem>
            <SelectItem value="أخرى">أخرى</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button onClick={() => studentId && onLink(studentId, relationship)} disabled={!studentId || loading} className="w-full">
        {loading ? "جارٍ الربط..." : "ربط"}
      </Button>
    </div>
  );
};

export default UserManagement;
