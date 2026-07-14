import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Check, X, Minus, Loader2 } from "lucide-react";

export const Route = createFileRoute("/app/checklists/$templateId")({
  component: FillChecklist,
});

type EntryStatus = "done" | "not_done" | "na";

function periodForCadence(cadence: string): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);
  if (cadence === "daily") {
    // nothing
  } else if (cadence === "weekly") {
    const day = start.getDay(); // 0 Sun
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
    queryKey: ["submission", templateId, period?.start],
    enabled: !!template && !!profile && !!period,
    queryFn: async () => {
      if (!period || !user || !profile) return null;
      // find existing
      const existing = await supabase
        .from("checklist_submissions")
        .select("*")
        .eq("template_id", templateId)
        .eq("user_id", user.id)
        .eq("period_start", period.start)
        .maybeSingle();
      if (existing.error) throw existing.error;
      if (existing.data) return existing.data;
      // create
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
      toast.success("Checklist submitted");
      qc.invalidateQueries({ queryKey: ["submission", templateId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!template) return <Loader2 className="animate-spin" />;
  const isSubmitted = submission?.status === "submitted";

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <button onClick={() => navigate({ to: "/app" })} className="text-sm text-muted-foreground hover:text-foreground">← Back</button>
          <h1 className="text-2xl font-bold mt-1">{template.name}</h1>
          <div className="flex gap-2 mt-2">
            <Badge variant="secondary" className="capitalize">{template.cadence}</Badge>
            <Badge variant="outline">{template.format.replace("_", " ")}</Badge>
            {period && <Badge variant="outline">{period.start} → {period.end}</Badge>}
            {isSubmitted && <Badge className="bg-success text-success-foreground">Submitted</Badge>}
          </div>
        </div>
        {!isSubmitted && submission && (
          <Button onClick={() => submitAll.mutate()} disabled={submitAll.isPending}>
            Submit checklist
          </Button>
        )}
      </div>

      {isSubmitted && (
        <Card className="mb-4 border-warning">
          <CardContent className="py-3 text-sm">
            This period is submitted. Corrections require inserting new entries — historical values remain locked.
          </CardContent>
        </Card>
      )}

      <div className="space-y-6">
        {categories?.map((cat: any) => (
          <Card key={cat.id}>
            <CardHeader>
              <CardTitle className="text-lg">{cat.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {cat.checklist_items
                ?.filter((i: any) => !i.parent_item_id)
                .sort((a: any, b: any) => a.sort_order - b.sort_order)
                .map((item: any) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    subItems={cat.checklist_items.filter((s: any) => s.parent_item_id === item.id)}
                    submissionId={submission?.id}
                    entries={entries ?? []}
                    format={template.format}
                    disabled={isSubmitted || !submission}
                  />
                ))}
            </CardContent>
          </Card>
        ))}
        {categories && categories.length === 0 && (
          <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No items in this template yet.</CardContent></Card>
        )}
      </div>
    </div>
  );
}

function ItemRow({ item, subItems, submissionId, entries, format, disabled }: any) {
  const qc = useQueryClient();
  const [comment, setComment] = useState("");
  const itemEntries = entries.filter((e: any) => e.item_id === item.id);
  const latest = itemEntries[0];

  const save = useMutation({
    mutationFn: async (status: EntryStatus) => {
      const { error } = await supabase.from("checklist_entries").insert({
        submission_id: submissionId,
        item_id: item.id,
        status,
        comment: comment || null,
        filled_by: "00000000-0000-0000-0000-000000000000", // overwritten by trigger
      });
      if (error) throw error;
      setComment("");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["entries", submissionId] }),
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="border rounded-md p-3">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="font-medium">{item.label}</div>
          {latest && (
            <div className="text-xs text-muted-foreground mt-1">
              Latest: <StatusBadge status={latest.status} /> · {new Date(latest.filled_at).toLocaleString()}
              {latest.comment && <> · "{latest.comment}"</>}
            </div>
          )}
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" disabled={disabled || save.isPending} onClick={() => save.mutate("done")}>
            <Check className="h-4 w-4 text-success" />
          </Button>
          <Button size="sm" variant="outline" disabled={disabled || save.isPending} onClick={() => save.mutate("not_done")}>
            <X className="h-4 w-4 text-destructive" />
          </Button>
          <Button size="sm" variant="outline" disabled={disabled || save.isPending} onClick={() => save.mutate("na")}>
            <Minus className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      </div>
      {!disabled && (
        <Textarea
          className="mt-2 text-sm h-16"
          placeholder="Optional comment for next entry…"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      )}
      {subItems?.length > 0 && (
        <div className="ml-6 mt-3 space-y-2 border-l-2 pl-4">
          {subItems.map((sub: any) => (
            <ItemRow key={sub.id} item={sub} subItems={[]} submissionId={submissionId} entries={entries} format={format} disabled={disabled} />
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: EntryStatus }) {
  const map = {
    done: <span className="text-success font-medium">Done</span>,
    not_done: <span className="text-destructive font-medium">Not done</span>,
    na: <span className="text-muted-foreground font-medium">N/A</span>,
  };
  return map[status];
}
