import { useEffect, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PageDateHeader from "@/components/PageDateHeader";
import StaffTasks from "@/pages/StaffTasks";
import InternalRequests from "@/pages/InternalRequests";
import StaffTasksAnalytics from "@/pages/StaffTasksAnalytics";
import { WORK_TABS, WORK_TAB_LABELS, resolveInitialTab, type WorkTab } from "@/lib/workHub";

/**
 * المهام والطلبات الداخلية in one frame.
 *
 * Only the frame is shared: each module keeps its own tables, its own status/priority
 * vocabulary and its own screen. Merging the data models would mean altering Postgres
 * enums whose values are Arabic labels, which is a large, irreversible change for a
 * purely presentational benefit.
 *
 * Each tab mounts only while selected, so the two realtime subscriptions never run at
 * the same time.
 */
const WorkHub = () => {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<WorkTab>(() =>
    resolveInitialTab(searchParams, location.state as { tab?: unknown } | null),
  );

  // Keep the tab in the URL so a deep link (and the browser's back button) works.
  useEffect(() => {
    const current = searchParams.get("tab");
    if (current !== tab) {
      const next = new URLSearchParams(searchParams);
      next.set("tab", tab);
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  return (
    <div className="space-y-4 animate-fade-in" dir="rtl">
      <PageDateHeader />
      <div>
        <h1 className="text-2xl font-bold">المهام والطلبات</h1>
        <p className="text-sm text-muted-foreground">
          متابعة المهام المُسنَدة والطلبات الداخلية وتحليلاتها في مكان واحد
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as WorkTab)}>
        <TabsList>
          {WORK_TABS.map((t) => (
            <TabsTrigger key={t} value={t}>{WORK_TAB_LABELS[t]}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="tasks" className="mt-4">
          {tab === "tasks" && <StaffTasks embedded />}
        </TabsContent>
        <TabsContent value="requests" className="mt-4">
          {tab === "requests" && <InternalRequests embedded />}
        </TabsContent>
        <TabsContent value="analytics" className="mt-4">
          {tab === "analytics" && <StaffTasksAnalytics embedded />}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default WorkHub;
