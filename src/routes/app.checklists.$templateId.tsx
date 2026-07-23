import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Check, X, Minus, Loader2, ChevronDown, ChevronRight, ArrowLeft, Plus, Wrench } from "lucide-react";

type EntryStatus = "done" | "not_done";

export const Route = createFileRoute("/app/checklists/$templateId")({
  component: FillChecklist,
});

function periodForCadence(cadence: string): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now); const end = new Date(now);
  if (cadence === "weekly") {
    const day = start.getDay();
    const mondayOffset = (day + 6) % 7;
    start.setDate(start.getDate() - mondayOffset);
    end.setDate(start.getDate() + 6);
  } else if (cadence === "monthly") {
    start.setDate(1);
    end.setMonth(start.getMonth() + 1);
    end.setDate(0);
  }
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { start: fmt(start), end: fmt(end) };
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
// day_of_week: 1..6 = Mon..Sat
function todayDow(): number {
  const js = new Date().getDay(); // 0 Sun..6 Sat
  return js === 0 ? 0 : js; // Sun=0 (not in Mon-Sat); Mon=1..Sat=6
}

function FillChecklist() {
  const { templateId } = Route.useParams();
  const { profile, user } = useProfile();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: template } = useQuery({
    queryKey: ["template", templateId],
    queryFn: async () => {
      const { data, error } = await supabase.from("checklist_templates").select("*").eq("id", templateId).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: categories } = useQuery({
    queryKey: ["categories", templateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_categories")
        .select("*, checklist_items(*)")
        .eq("template_id", templateId)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const period = template ? periodForCadence(template.cadence) : null;

  const { data: submission } = useQuery({
    queryKey: ["submission", templateId, period?.start, user?.id],
    enabled: !!template && !!profile && !!period && !!user,
    queryFn: async () => {
      if (!period || !user || !profile) return null;
      const existing = await supabase
        .from("checklist_submissions")
        .select("*")
        .eq("template_id", templateId)
        .eq("user_id", user.id)
        .eq("period_start", period.start)
        .maybeSingle();
      if (existing.error) throw existing.error;
      if (existing.data) return existing.data;
      const ins = await supabase
        .from("checklist_submissions")
        .insert({
          template_id: templateId,
          user_id: user.id,
          property_id: profile.property_id!,
          period_start: period.start,
          period_end: period.end,
        })
        .select()
        .single();
      if (ins.error) throw ins.error;
      return ins.data;
    },
  });

  const { data: entries } = useQuery({
    queryKey: ["entries", submission?.id],
    enabled: !!submission,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_entries")
        .select("*")
        .eq("submission_id", submission!.id)
        .order("filled_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const submitAll = useMutation({
    mutationFn: async () => {
      if (!submission) return;
      const { error } = await supabase
        .from("checklist_submissions")
        .update({ status: "submitted", submitted_at: new Date().toISOString() })
        .eq("id", submission.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Checklist submitted for the day");
      qc.invalidateQueries({ queryKey: ["submission", templateId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!template) return <div className="grid place-items-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  const isSubmitted = submission?.status === "submitted";
  const isFaultLog = template.format === "fault_log";

  return (
    <div>
      <button onClick={() => navigate({ to: "/app" })} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground -ml-1 mb-2">
        <ArrowLeft className="h-4 w-4" />Back
      </button>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold">{template.name}</h1>
          <div className="flex gap-1.5 mt-2 flex-wrap">
            <Badge variant="secondary" className="capitalize">{template.cadence}</Badge>
            <Badge variant="outline">{template.format.replace("_", " ")}</Badge>
            {period && <Badge variant="outline" className="font-mono text-[10px]">{period.start}{period.start !== period.end ? ` → ${period.end}` : ""}</Badge>}
            {isSubmitted && <Badge className="bg-success text-success-foreground">Submitted</Badge>}
          </div>
        </div>
        {!isSubmitted && submission && !isFaultLog && (
          <Button size="lg" onClick={() => submitAll.mutate()} disabled={submitAll.isPending} className="w-full sm:w-auto">
            {submitAll.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Submit for the day
          </Button>
        )}
      </div>

      {isSubmitted && (
        <Card className="mb-4 border-warning bg-warning/5">
          <CardContent className="py-3 text-sm">
            Locked — this period has been submitted. Historical entries can't be edited.
          </CardContent>
        </Card>
      )}

      {isFaultLog ? (
        <FaultLogFormat submissionId={submission?.id} propertyId={profile?.property_id ?? null} userId={user?.id ?? null} disabled={isSubmitted} />
      ) : (
        <div className="space-y-4">
          {categories?.map((cat: any) => (
            <CategoryCard
              key={cat.id}
              category={cat}
              format={template.format}
              submissionId={submission?.id}
              entries={entries ?? []}
              disabled={isSubmitted || !submission}
            />
          ))}
          {categories && categories.length === 0 && (
            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No items in this template yet.</CardContent></Card>
          )}
        </div>
      )}
    </div>
  );
}

function CategoryCard({ category, format, submissionId, entries, disabled }: any) {
  const [open, setOpen] = useState(true);
  const items = (category.checklist_items ?? [])
    .filter((i: any) => !i.parent_item_id)
    .sort((a: any, b: any) => a.sort_order - b.sort_order);

  return (
    <Card>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-6 py-4 text-left">
        <CardTitle className="text-base sm:text-lg">{category.name}</CardTitle>
        {open ? <ChevronDown className="h-5 w-5 text-muted-foreground" /> : <ChevronRight className="h-5 w-5 text-muted-foreground" />}
      </button>
      {open && (
        <CardContent className="pt-0 space-y-2">
          {items.map((item: any) => (
            format === "day_grid" ? (
              <DayGridRow key={item.id} item={item}
                subItems={category.checklist_items.filter((s: any) => s.parent_item_id === item.id)}
                submissionId={submissionId} entries={entries} disabled={disabled} />
            ) : (
              <StatusCommentRow key={item.id} item={item}
                subItems={category.checklist_items.filter((s: any) => s.parent_item_id === item.id)}
                submissionId={submissionId} entries={entries} disabled={disabled} />
            )
          ))}
        </CardContent>
      )}
    </Card>
  );
}

/* ---------------- Autosave hook + flash ---------------- */
function useAutosave(submissionId: string | undefined) {
  const qc = useQueryClient();
  const [flashKey, setFlashKey] = useState<string | null>(null);
  const timer = useRef<any>(null);

  const save = useMutation({
    mutationFn: async (payload: {
      itemId: string;
      status: EntryStatus;
      comment?: string | null;
      dayOfWeek?: number | null;
      flashId: string;
    }) => {
      if (!submissionId) throw new Error("No submission");
      const { error } = await supabase.from("checklist_entries").insert({
        submission_id: submissionId,
        item_id: payload.itemId,
        status: payload.status,
        comment: payload.comment ?? null,
        day_of_week: payload.dayOfWeek ?? null,
        filled_by: "00000000-0000-0000-0000-000000000000", // overwritten by trigger
      });
      if (error) throw error;
      return payload.flashId;
    },
    onSuccess: (flashId) => {
      qc.invalidateQueries({ queryKey: ["entries", submissionId] });
      setFlashKey(flashId);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setFlashKey(null), 1200);
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to save"),
  });

  return { save, flashKey };
}

function SavedFlash({ show }: { show: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium text-success transition-opacity duration-200 ${show ? "opacity-100" : "opacity-0"}`}
      aria-hidden={!show}
    >
      <Check className="h-3.5 w-3.5" /> Saved
    </span>
  );
}

/* ---------------- Status + comment layout ---------------- */
function StatusCommentRow({ item, subItems, submissionId, entries, disabled }: any) {
  const itemEntries = entries.filter((e: any) => e.item_id === item.id);
  const latest = itemEntries[0];
  const [comment, setComment] = useState<string>(latest?.comment ?? "");
  const commentDebounce = useRef<any>(null);
  const { save, flashKey } = useAutosave(submissionId);
  const flashId = `${item.id}`;

  useEffect(() => {
    // sync when latest changes (e.g. after another user updates)
    if (latest?.comment != null && !document.activeElement?.contains(document.getElementById(`c-${item.id}`))) {
      setComment(latest.comment);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latest?.id]);

  function setStatus(s: EntryStatus) {
    if (disabled) return;
    save.mutate({ itemId: item.id, status: s, comment: comment || null, flashId });
  }

  function onCommentChange(v: string) {
    setComment(v);
    if (disabled || !latest) return; // only autosave comment updates once a status exists
    if (commentDebounce.current) clearTimeout(commentDebounce.current);
    commentDebounce.current = setTimeout(() => {
      save.mutate({ itemId: item.id, status: latest.status, comment: v || null, flashId });
    }, 900);
  }

  const status: EntryStatus | null = latest?.status ?? null;

  return (
    <div className="rounded-lg border bg-card p-3 sm:p-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-start">
        <div className="min-w-0">
          <div className="font-medium text-sm sm:text-base">{item.label}</div>
          {latest && (
            <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-2">
              <span>Updated {new Date(latest.filled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              <SavedFlash show={flashKey === flashId} />
            </div>
          )}
        </div>
        <div className="flex gap-1.5 shrink-0">
          <BigStatusBtn active={status === "done"} onClick={() => setStatus("done")} disabled={disabled} tone="success" label="Done"><Check className="h-5 w-5" /></BigStatusBtn>
          <BigStatusBtn active={status === "not_done"} onClick={() => setStatus("not_done")} disabled={disabled} tone="destructive" label="Not done"><X className="h-5 w-5" /></BigStatusBtn>
          <BigStatusBtn active={status === "na"} onClick={() => setStatus("na")} disabled={disabled} tone="muted" label="N/A"><Minus className="h-5 w-5" /></BigStatusBtn>
        </div>
      </div>
      <Textarea
        id={`c-${item.id}`}
        className="mt-2 text-sm min-h-10 h-10 py-2 resize-none"
        placeholder="Add a note (optional)…"
        value={comment}
        onChange={(e) => onCommentChange(e.target.value)}
        disabled={disabled}
      />
      {subItems?.length > 0 && (
        <div className="ml-3 sm:ml-6 mt-3 space-y-2 border-l-2 border-primary/30 pl-3 sm:pl-4">
          {subItems.map((sub: any) => (
            <StatusCommentRow key={sub.id} item={sub} subItems={[]} submissionId={submissionId} entries={entries} disabled={disabled} />
          ))}
        </div>
      )}
    </div>
  );
}

function BigStatusBtn({ active, onClick, disabled, tone, label, children }: any) {
  const bg = active
    ? tone === "success" ? "bg-success text-success-foreground border-success"
    : tone === "destructive" ? "bg-destructive text-destructive-foreground border-destructive"
    : "bg-muted-foreground/20 text-foreground border-muted-foreground/30"
    : "bg-background hover:bg-muted";
  return (
    <button
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`h-11 w-11 sm:h-10 sm:w-10 rounded-md border-2 grid place-items-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 ${bg}`}
    >
      {children}
    </button>
  );
}

/* ---------------- Day grid layout ---------------- */
function DayGridRow({ item, subItems, submissionId, entries, disabled }: any) {
  const hasSubs = subItems?.length > 0;
  return (
    <div className="rounded-lg border bg-card p-3 sm:p-4">
      <div className="font-medium text-sm sm:text-base mb-2">{item.label}</div>
      {!hasSubs && (
        <DayGridCells itemId={item.id} submissionId={submissionId} entries={entries} disabled={disabled} />
      )}
      {hasSubs && (
        <div className="space-y-2">
          {subItems.map((sub: any) => (
            <div key={sub.id} className="pl-3 border-l-2 border-primary/30">
              <div className="text-sm mb-1.5">{sub.label}</div>
              <DayGridCells itemId={sub.id} submissionId={submissionId} entries={entries} disabled={disabled} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DayGridCells({ itemId, submissionId, entries, disabled }: any) {
  const { save, flashKey } = useAutosave(submissionId);
  const today = todayDow();

  // build latest status per day
  const latestByDay = new Map<number, EntryStatus>();
  const itemEntries = entries.filter((e: any) => e.item_id === itemId && e.day_of_week != null);
  // entries are ordered by filled_at desc, so first hit wins
  for (const e of itemEntries) {
    if (!latestByDay.has(e.day_of_week)) latestByDay.set(e.day_of_week, e.status);
  }

  function cycle(dow: number) {
    if (disabled) return;
    const cur = latestByDay.get(dow) ?? null;
    const next: EntryStatus = cur === "done" ? "not_done" : "done";
    save.mutate({ itemId, status: next, dayOfWeek: dow, flashId: `${itemId}-${dow}` });
  }

  return (
    <div className="grid grid-cols-6 gap-1">
      {DAY_LABELS.map((label, idx) => {
        const dow = idx + 1;
        const status = latestByDay.get(dow) ?? null;
        const isToday = dow === today;
        const flashing = flashKey === `${itemId}-${dow}`;
        const bg =
          status === "done" ? "bg-success text-success-foreground border-success" :
          status === "not_done" ? "bg-destructive text-destructive-foreground border-destructive" :
          "bg-background border-border hover:bg-muted";
        return (
          <button
            key={dow}
            onClick={() => cycle(dow)}
            disabled={disabled}
            className={`relative h-14 rounded-md border-2 flex flex-col items-center justify-center text-[11px] font-semibold transition-all active:scale-95 disabled:opacity-40 ${bg} ${isToday ? "ring-2 ring-primary ring-offset-1" : ""}`}
          >
            <div className="uppercase opacity-80">{label}</div>
            <div className="text-[10px] mt-0.5">
              {status === "done" ? "✓" : status === "not_done" ? "✗" : ""}
            </div>
            {flashing && (
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-success grid place-items-center animate-in fade-in zoom-in">
                <Check className="h-2.5 w-2.5 text-success-foreground" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------- Fault log layout ---------------- */
function FaultLogFormat({ submissionId, propertyId, userId, disabled }: any) {
  const qc = useQueryClient();
  const [equipment, setEquipment] = useState("");
  const [desc, setDesc] = useState("");

  const { data: faults } = useQuery({
    queryKey: ["faults-for-submission", submissionId, propertyId],
    enabled: !!propertyId,
    queryFn: async () => {
      const q = supabase.from("fault_log_entries").select("*").eq("property_id", propertyId).order("reported_at", { ascending: false });
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!userId || !propertyId) return;
      const { error } = await supabase.from("fault_log_entries").insert({
        property_id: propertyId,
        submission_id: submissionId ?? null,
        equipment_type: equipment,
        fault_description: desc,
        reported_by: userId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fault added");
      setEquipment(""); setDesc("");
      qc.invalidateQueries({ queryKey: ["faults-for-submission"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "reported" | "broken" | "repaired" }) => {
      const { error } = await supabase
        .from("fault_log_entries")
        .update({ status, resolved_at: status === "repaired" ? new Date().toISOString() : null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["faults-for-submission"] }),
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      {!disabled && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Wrench className="h-4 w-4" />Log a new fault</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="Equipment (e.g. Pool pump)" value={equipment} onChange={(e) => setEquipment(e.target.value)} className="h-11" />
            <Textarea placeholder="What is wrong?" value={desc} onChange={(e) => setDesc(e.target.value)} />
            <Button className="w-full h-11" disabled={!equipment || !desc || create.isPending} onClick={() => create.mutate()}>
              <Plus className="h-4 w-4 mr-1" />Add fault
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {(faults ?? []).length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No faults logged for this property.</p>}
        {faults?.map((f: any) => (
          <Card key={f.id}>
            <CardContent className="py-3">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-start">
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">{f.equipment_type}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{f.fault_description}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    {new Date(f.reported_at).toLocaleString()}
                    {f.resolved_at && <> · Resolved {new Date(f.resolved_at).toLocaleDateString()}</>}
                  </div>
                </div>
                <Select value={f.status} onValueChange={(v) => updateStatus.mutate({ id: f.id, status: v as any })} disabled={disabled}>
                  <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="reported">Reported</SelectItem>
                    <SelectItem value="broken">Broken</SelectItem>
                    <SelectItem value="repaired">Repaired</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
