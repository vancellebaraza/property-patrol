import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAllProperties } from "@/hooks/useProperty";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Loader2, ChevronLeft, ChevronRight, CheckCircle2, XCircle, Circle } from "lucide-react";

export const Route = createFileRoute("/app/admin/board")({
  component: BoardPage,
});

function startOfWeek(d: Date) {
  const nd = new Date(d);
  const day = nd.getDay();
  const offset = (day + 6) % 7; // Mon start
  nd.setDate(nd.getDate() - offset);
  nd.setHours(0, 0, 0, 0);
  return nd;
}
function fmtISO(d: Date) { return d.toISOString().slice(0, 10); }
function addDays(d: Date, n: number) { const nd = new Date(d); nd.setDate(nd.getDate() + n); return nd; }
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type CellStatus = "submitted" | "in_progress" | "none";
type PropertyCellState = "green" | "amber" | "red" | "gray";

type PropertyDayMetrics = {
  total: number;
  submitted: number;
  in_progress: number;
  none: number;
  state: PropertyCellState;
};

function BoardPage() {
  const { data: properties } = useAllProperties();
  const [weekStart, setWeekStart] = useState<Date>(startOfWeek(new Date()));
  const [propertyDayDrawer, setPropertyDayDrawer] = useState<{ propertyId: string; propertyName: string; date: string } | null>(null);
  const [detailDrawer, setDetailDrawer] = useState<{ userId: string; userName: string; date: string } | null>(null);

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const dayKeys = useMemo(() => days.map((d) => fmtISO(d)), [weekStart]);
  const weekEnd = addDays(weekStart, 6);

  const { data: staffData, isLoading: staffLoading } = useQuery({
    queryKey: ["staff-all-properties"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("id, full_name, email, role, property_id")
        .eq("active", true)
        .not("role", "is", null)
        .neq("role", "super_admin")
        .order("full_name");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const { data: submissions, isLoading: submissionsLoading } = useQuery({
    queryKey: ["submissions-week-all-properties", fmtISO(weekStart)],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_submissions")
        .select("id, user_id, property_id, status, submitted_at, period_start, period_end, template_id")
        .gte("period_start", fmtISO(weekStart))
        .lte("period_start", fmtISO(weekEnd));
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const staffByProperty = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const member of staffData ?? []) {
      if (!member.property_id) continue;
      const list = map.get(member.property_id) ?? [];
      list.push(member);
      map.set(member.property_id, list);
    }
    return map;
  }, [staffData]);

  const submissionsByPropertyUserDay = useMemo(() => {
    const map = new Map<string, Map<string, Map<string, any[]>>>();
    for (const submission of submissions ?? []) {
      const propertyId = submission.property_id;
      if (!propertyId) continue;
      const propertyMap = map.get(propertyId) ?? new Map<string, Map<string, any[]>>();
      const userMap = propertyMap.get(submission.user_id) ?? new Map<string, any[]>();
      const dayList = userMap.get(submission.period_start) ?? [];
      dayList.push(submission);
      userMap.set(submission.period_start, dayList);
      propertyMap.set(submission.user_id, userMap);
      map.set(propertyId, propertyMap);
    }
    return map;
  }, [submissions]);

  function cellStatus(propertyId: string, userId: string, date: string): CellStatus {
    const dayMap = submissionsByPropertyUserDay.get(propertyId)?.get(userId);
    const subs = dayMap?.get(date);
    if (subs && subs.some((s: any) => s.status === "submitted")) return "submitted";
    return "none";
  }

  function getPropertyDayMetrics(propertyId: string, date: string): PropertyDayMetrics {
    const staff = staffByProperty.get(propertyId) ?? [];
    if (staff.length === 0) return { total: 0, submitted: 0, in_progress: 0, none: 0, state: "gray" };

    let submitted = 0;
    let none = 0;

    for (const user of staff) {
      const status = cellStatus(propertyId, user.id, date);
      if (status === "submitted") submitted++;
      else none++;
    }

    const state = submitted === staff.length ? "green" : "red";
    return { total: staff.length, submitted, in_progress: 0, none, state };
  }

  const summary = useMemo(() => {
    let submitted = 0;
    let none = 0;

    for (const property of properties ?? []) {
      for (const date of dayKeys) {
        const metrics = getPropertyDayMetrics(property.id, date);
        submitted += metrics.submitted;
        none += metrics.none;
      }
    }

    return { submitted, none };
  }, [properties, staffByProperty, submissionsByPropertyUserDay, dayKeys]);

  const isLoading = !properties || staffLoading || submissionsLoading;

  return (
    <div>
      {/* Week controls + stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
        <Card className="md:col-span-1">
          <CardContent className="py-3 flex items-center justify-between">
            <button onClick={() => setWeekStart(addDays(weekStart, -7))} className="p-2 rounded hover:bg-muted" aria-label="Previous week">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="text-center">
              <div className="text-[10px] uppercase text-muted-foreground tracking-wider">Week of</div>
              <div className="font-semibold text-sm">
                {weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – {weekEnd.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </div>
            </div>
            <button onClick={() => setWeekStart(addDays(weekStart, 7))} className="p-2 rounded hover:bg-muted" aria-label="Next week">
              <ChevronRight className="h-4 w-4" />
            </button>
          </CardContent>
        </Card>
        <StatCard label="Done" value={summary.submitted} tone="success" icon={<CheckCircle2 className="h-4 w-4" />} />
        <StatCard label="Not done" value={summary.none} tone="destructive" icon={<XCircle className="h-4 w-4" />} />
      </div>

      {/* Grid */}
      {isLoading && (
        <div className="grid place-items-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
      {!isLoading && properties && properties.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No properties available.</p>}
      {!isLoading && properties && properties.length > 0 && (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-3 py-2 font-semibold sticky left-0 bg-muted/40 z-10 min-w-48">Property</th>
                  {days.map((d, i) => {
                    const isToday = fmtISO(d) === fmtISO(new Date());
                    return (
                      <th key={i} className={`px-2 py-2 font-medium text-center min-w-20 ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                        <div className="text-[10px] uppercase">{DAY_LABELS[i]}</div>
                        <div className="text-xs">{d.getDate()}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {properties.map((property) => (
                  <tr key={property.id} className="border-b hover:bg-muted/30">
                    <td className="px-3 py-2 sticky left-0 bg-card z-10">
                      <div className="font-medium text-sm truncate max-w-48">{property.name}</div>
                    </td>
                    {dayKeys.map((dayKey) => {
                      const metrics = getPropertyDayMetrics(property.id, dayKey);
                      const pillClass =
                        metrics.state === "green" ? "bg-success/15 text-success border border-success/30 hover:bg-success/20" :
                        metrics.state === "red" ? "bg-destructive/15 text-destructive border border-destructive/30 hover:bg-destructive/20" :
                        "bg-muted text-muted-foreground border border-transparent hover:bg-muted/80";
                      const label = metrics.total === 0 ? "—" : `${metrics.submitted}/${metrics.total}`;
                      return (
                        <td key={dayKey} className="px-2 py-2 text-center">
                          <button
                            onClick={() => setPropertyDayDrawer({ propertyId: property.id, propertyName: property.name, date: dayKey })}
                            className={`min-w-12 h-8 rounded-md px-2 py-1 text-xs font-semibold ${pillClass} active:scale-95 transition`}
                            aria-label={`${property.name} ${dayKey}`}
                          >
                            {label}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <PropertyDayDrawer
        open={!!propertyDayDrawer}
        onClose={() => setPropertyDayDrawer(null)}
        propertyId={propertyDayDrawer?.propertyId ?? null}
        propertyName={propertyDayDrawer?.propertyName ?? ""}
        date={propertyDayDrawer?.date ?? null}
        staff={propertyDayDrawer ? (staffByProperty.get(propertyDayDrawer.propertyId) ?? []) : []}
        statusByUser={propertyDayDrawer ? Object.fromEntries(
          (staffByProperty.get(propertyDayDrawer.propertyId) ?? []).map((user: any) => [user.id, cellStatus(propertyDayDrawer.propertyId, user.id, propertyDayDrawer.date)])
        ) : {}}
        onSelectStaff={(user: any) => {
          setPropertyDayDrawer(null);
          setDetailDrawer({ userId: user.id, userName: user.full_name || user.email, date: propertyDayDrawer?.date ?? "" });
        }}
      />

      <DayDetailDrawer
        open={!!detailDrawer}
        onClose={() => setDetailDrawer(null)}
        userId={detailDrawer?.userId ?? null}
        userName={detailDrawer?.userName ?? ""}
        date={detailDrawer?.date ?? null}
      />
    </div>
  );
}

function StatCard({ label, value, tone, icon }: any) {
  const bg =
    tone === "success" ? "bg-success/10 text-success" :
    tone === "warning" ? "bg-warning/20 text-warning-foreground" :
    tone === "destructive" ? "bg-destructive/10 text-destructive" :
    "bg-muted text-muted-foreground";
  return (
    <Card>
      <CardContent className="py-3 flex items-center gap-3">
        <div className={`h-9 w-9 rounded-md grid place-items-center ${bg}`}>{icon}</div>
        <div>
          <div className="text-[10px] uppercase text-muted-foreground tracking-wider">{label}</div>
          <div className="text-xl font-bold leading-tight">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function PropertyDayDrawer({ open, onClose, propertyId, propertyName, date, staff, statusByUser, onSelectStaff }: any) {
  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{propertyName}</SheetTitle>
          <SheetDescription>{date && new Date(date).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-2">
          {staff && staff.length > 0 ? (
            staff.map((user: any) => {
              const userStatus = statusByUser?.[user.id] ?? "none";
              const label = userStatus === "submitted" ? "Done" : "Not done";
              const badgeClass =
                userStatus === "submitted" ? "bg-success text-success-foreground" :
                "bg-destructive text-destructive-foreground";

              return (
                <button
                  key={user.id}
                  onClick={() => onSelectStaff(user)}
                  className="w-full rounded-lg border p-3 text-left transition hover:bg-muted/40"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{user.full_name || user.email}</div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{user.role}</div>
                    </div>
                    <Badge className={badgeClass}>{label}</Badge>
                  </div>
                </button>
              );
            })
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">No staff assigned to this property.</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DayDetailDrawer({ open, onClose, userId, userName, date }: any) {
  const { data, isLoading } = useQuery({
    queryKey: ["day-detail", userId, date],
    enabled: !!userId && !!date && open,
    queryFn: async () => {
      const subs = await supabase
        .from("checklist_submissions")
        .select("id, status, submitted_at, template_id, checklist_templates(name, format, cadence)")
        .eq("user_id", userId)
        .eq("period_start", date);
      if (subs.error) throw subs.error;
      const submissionIds = (subs.data ?? []).map((s: any) => s.id);
      if (submissionIds.length === 0) return { subs: [], entriesBySub: {}, itemsById: {}, catsById: {}, filledByUsers: {} };

      const entries = await supabase
        .from("checklist_entries")
        .select("*")
        .in("submission_id", submissionIds)
        .order("filled_at", { ascending: true });
      if (entries.error) throw entries.error;

      const itemIds = Array.from(new Set((entries.data ?? []).map((e: any) => e.item_id)));
      const items = itemIds.length
        ? await supabase.from("checklist_items").select("id, label, category_id, parent_item_id").in("id", itemIds)
        : { data: [] as any[], error: null };
      if (items.error) throw items.error;
      const catIds = Array.from(new Set((items.data ?? []).map((i: any) => i.category_id)));
      const cats = catIds.length
        ? await supabase.from("checklist_categories").select("id, name").in("id", catIds)
        : { data: [] as any[], error: null };
      if (cats.error) throw cats.error;

      const filledByIds = Array.from(new Set((entries.data ?? []).map((e: any) => e.filled_by).filter(Boolean)));
      const users = filledByIds.length
        ? await supabase.from("user_profiles").select("id, full_name, email").in("id", filledByIds)
        : { data: [] as any[], error: null };
      if (users.error) throw users.error;

      const entriesBySub: Record<string, any[]> = {};
      for (const e of entries.data ?? []) {
        (entriesBySub[e.submission_id] ??= []).push(e);
      }
      const itemsById: Record<string, any> = {};
      for (const i of items.data ?? []) itemsById[i.id] = i;
      const catsById: Record<string, any> = {};
      for (const c of cats.data ?? []) catsById[c.id] = c;
      const filledByUsers: Record<string, any> = {};
      for (const u of users.data ?? []) filledByUsers[u.id] = u;

      return { subs: subs.data ?? [], entriesBySub, itemsById, catsById, filledByUsers };
    },
  });

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{userName}</SheetTitle>
          <SheetDescription>{date && new Date(date).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</SheetDescription>
        </SheetHeader>

        {isLoading && <div className="py-12 grid place-items-center"><Loader2 className="h-5 w-5 animate-spin" /></div>}
        {data && data.subs.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No entries for this day.</p>}

        <div className="mt-4 space-y-6">
          {data?.subs.map((s: any) => {
            const entries = data.entriesBySub[s.id] ?? [];
            const latestByItem = new Map<string, any>();
            for (const e of entries) latestByItem.set(e.item_id, e);
            const entriesGrouped: Record<string, any[]> = {};
            for (const [itemId, e] of latestByItem) {
              const item = data.itemsById[itemId];
              const catId = item?.category_id ?? "unknown";
              (entriesGrouped[catId] ??= []).push({ ...e, item });
            }
            return (
              <div key={s.id} className="border rounded-lg p-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div>
                    <div className="font-semibold text-sm">{s.checklist_templates?.name}</div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.checklist_templates?.cadence} · {s.checklist_templates?.format?.replace("_", " ")}</div>
                  </div>
                  {s.status === "submitted" ? (
                    <Badge className="bg-success text-success-foreground">Done {s.submitted_at && new Date(s.submitted_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Badge>
                  ) : (
                    <Badge className="bg-destructive text-destructive-foreground">Not done</Badge>
                  )}
                </div>
                {Object.entries(entriesGrouped).map(([catId, list]) => (
                  <div key={catId} className="mt-3">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                      {data.catsById[catId]?.name ?? "Uncategorized"}
                    </div>
                    <div className="space-y-1.5">
                      {list.map((e: any) => {
                        const filler = data.filledByUsers[e.filled_by];
                        return (
                          <div key={e.id} className="flex items-start gap-2 text-sm border-b pb-1.5 last:border-0">
                            <StatusDot status={e.status} />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium">{e.item?.label ?? "(deleted item)"}</div>
                              {e.comment && <div className="text-xs text-muted-foreground italic">"{e.comment}"</div>}
                              {e.photo_url && <img src={e.photo_url} alt="" className="mt-1 rounded max-h-24" />}
                              <div className="text-[10px] text-muted-foreground mt-0.5">
                                by {filler?.full_name || filler?.email || "unknown"} · {new Date(e.filled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {Object.keys(entriesGrouped).length === 0 && (
                  <div className="text-xs text-muted-foreground py-2">No item entries recorded.</div>
                )}
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function StatusDot({ status }: { status: string }) {
  const cls = status === "done" || status === "submitted" ? "bg-success" : "bg-destructive";
  return <div className={`h-2.5 w-2.5 rounded-full mt-1 shrink-0 ${cls}`} />;
}
