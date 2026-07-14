import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAllProperties, themeStyle } from "@/hooks/useProperty";
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

type CellStatus = "submitted" | "in_progress" | "incomplete" | "none";

function BoardPage() {
  const { data: properties } = useAllProperties();
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState<Date>(startOfWeek(new Date()));
  const [drawer, setDrawer] = useState<{ userId: string; userName: string; date: string } | null>(null);

  const activeProperty = properties?.find((p) => p.id === propertyId) ?? properties?.[0];
  const activeId = activeProperty?.id ?? null;

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekEnd = addDays(weekStart, 6);

  const { data: staff } = useQuery({
    queryKey: ["staff-by-property", activeId],
    enabled: !!activeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("id, full_name, email, role")
        .eq("property_id", activeId!)
        .eq("active", true)
        .not("role", "is", null)
        .neq("role", "admin")
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: submissions } = useQuery({
    queryKey: ["submissions-week", activeId, fmtISO(weekStart)],
    enabled: !!activeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_submissions")
        .select("id, user_id, status, submitted_at, period_start, period_end, template_id")
        .eq("property_id", activeId!)
        .gte("period_start", fmtISO(weekStart))
        .lte("period_start", fmtISO(weekEnd));
      if (error) throw error;
      return data;
    },
  });

  // Map: userId -> date -> submissions[]
  const byUserDay = useMemo(() => {
    const map = new Map<string, Map<string, any[]>>();
    for (const s of submissions ?? []) {
      const inner = map.get(s.user_id) ?? new Map();
      const list = inner.get(s.period_start) ?? [];
      list.push(s);
      inner.set(s.period_start, list);
      map.set(s.user_id, inner);
    }
    return map;
  }, [submissions]);

  function cellStatus(userId: string, date: string): CellStatus {
    const dayMap = byUserDay.get(userId);
    const subs = dayMap?.get(date);
    if (!subs || subs.length === 0) return "none";
    if (subs.some((s) => s.status === "submitted")) return "submitted";
    return "in_progress";
  }

  // Summary
  const summary = useMemo(() => {
    let submitted = 0, inProg = 0, none = 0;
    for (const u of staff ?? []) {
      for (const d of days) {
        const s = cellStatus(u.id, fmtISO(d));
        if (s === "submitted") submitted++;
        else if (s === "in_progress") inProg++;
        else none++;
      }
    }
    return { submitted, inProg, none, total: (staff?.length ?? 0) * days.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staff, byUserDay, weekStart]);

  const themeColor = activeProperty?.theme_color ?? null;

  return (
    <div style={themeStyle(themeColor)}>
      {/* Property tabs */}
      <div className="flex gap-2 mb-5 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        {properties?.map((p) => {
          const active = (activeId ?? properties[0]?.id) === p.id;
          return (
            <button
              key={p.id}
              onClick={() => setPropertyId(p.id)}
              className={`px-4 py-2 rounded-md text-sm font-medium border-2 whitespace-nowrap flex items-center gap-2 transition-all`}
              style={{
                borderColor: active ? (p.theme_color ?? "var(--primary)") : "transparent",
                backgroundColor: active ? `${p.theme_color ?? "var(--primary)"}15` : "transparent",
                color: active ? (p.theme_color ?? "var(--primary)") : undefined,
              }}
            >
              {p.logo_url && <img src={p.logo_url} className="h-4 w-4 rounded object-cover" alt="" />}
              {p.name}
            </button>
          );
        })}
      </div>

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
        <StatCard label="Submitted" value={summary.submitted} tone="success" icon={<CheckCircle2 className="h-4 w-4" />} />
        <StatCard label="In progress" value={summary.inProg} tone="warning" icon={<Circle className="h-4 w-4" />} />
        <StatCard label="No entry" value={summary.none} tone="destructive" icon={<XCircle className="h-4 w-4" />} />
      </div>

      {/* Grid */}
      {!staff && <div className="grid place-items-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
      {staff && staff.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No staff assigned to this property.</p>}
      {staff && staff.length > 0 && (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-3 py-2 font-semibold sticky left-0 bg-muted/40 z-10 min-w-40">Staff</th>
                  {days.map((d, i) => {
                    const isToday = fmtISO(d) === fmtISO(new Date());
                    return (
                      <th key={i} className={`px-2 py-2 font-medium text-center min-w-16 ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                        <div className="text-[10px] uppercase">{DAY_LABELS[i]}</div>
                        <div className="text-xs">{d.getDate()}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {staff.map((u: any) => (
                  <tr key={u.id} className="border-b hover:bg-muted/30">
                    <td className="px-3 py-2 sticky left-0 bg-card z-10">
                      <div className="font-medium text-sm truncate max-w-40">{u.full_name || u.email}</div>
                      <div className="text-[10px] text-muted-foreground capitalize">{u.role}</div>
                    </td>
                    {days.map((d) => {
                      const iso = fmtISO(d);
                      const s = cellStatus(u.id, iso);
                      const pill =
                        s === "submitted" ? "bg-success text-success-foreground" :
                        s === "in_progress" ? "bg-warning text-warning-foreground" :
                        s === "incomplete" ? "bg-destructive text-destructive-foreground" :
                        "bg-muted text-muted-foreground";
                      const label = s === "submitted" ? "✓" : s === "in_progress" ? "•" : s === "incomplete" ? "✗" : "—";
                      return (
                        <td key={iso} className="px-2 py-2 text-center">
                          <button
                            onClick={() => setDrawer({ userId: u.id, userName: u.full_name || u.email, date: iso })}
                            className={`w-10 h-8 rounded-full font-bold text-xs ${pill} hover:opacity-80 active:scale-95 transition`}
                            aria-label={`${u.full_name} ${iso}`}
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

      <DayDetailDrawer
        open={!!drawer}
        onClose={() => setDrawer(null)}
        userId={drawer?.userId ?? null}
        userName={drawer?.userName ?? ""}
        date={drawer?.date ?? null}
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
            // group entries -> latest per item
            const latestByItem = new Map<string, any>();
            for (const e of entries) latestByItem.set(e.item_id, e); // ordered asc -> keep last
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
                    <Badge className="bg-success text-success-foreground">Submitted {s.submitted_at && new Date(s.submitted_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Badge>
                  ) : (
                    <Badge className="bg-warning text-warning-foreground">In progress</Badge>
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
  const cls =
    status === "done" ? "bg-success" :
    status === "not_done" ? "bg-destructive" :
    "bg-muted-foreground";
  return <div className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${cls}`} />;
}
