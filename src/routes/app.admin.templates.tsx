import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/app/admin/templates")({
  component: TemplatesPage,
});

const ROLES = ["admin", "supervisor", "caretaker", "site_rep"] as const;
const CADENCES = ["daily", "weekly", "monthly"] as const;
const FORMATS = ["status_comment", "day_grid", "fault_log"] as const;

function TemplatesPage() {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", property_id: "", cadence: "daily", format: "status_comment", role_required: "caretaker" });

  const { data: properties } = useQuery({
    queryKey: ["properties-all"],
    queryFn: async () => (await supabase.from("properties").select("*").order("name")).data ?? [],
  });
  const { data: templates } = useQuery({
    queryKey: ["all-templates"],
    queryFn: async () => (await supabase.from("checklist_templates").select("*, properties(name)").order("created_at", { ascending: false })).data ?? [],
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("checklist_templates").insert(form as any);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Template created"); setForm({ ...form, name: "" }); qc.invalidateQueries({ queryKey: ["all-templates"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("checklist_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["all-templates"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">New template</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-5 gap-3">
          <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div>
            <Label>Property</Label>
            <Select value={form.property_id} onValueChange={(v) => setForm({ ...form, property_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{properties?.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Cadence</Label>
            <Select value={form.cadence} onValueChange={(v) => setForm({ ...form, cadence: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CADENCES.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Format</Label>
            <Select value={form.format} onValueChange={(v) => setForm({ ...form, format: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{FORMATS.map((f) => <SelectItem key={f} value={f}>{f.replace("_", " ")}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Role</Label>
            <Select value={form.role_required} onValueChange={(v) => setForm({ ...form, role_required: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="md:col-span-5">
            <Button onClick={() => create.mutate()} disabled={!form.name || !form.property_id || create.isPending}>Create template</Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {templates?.map((t: any) => (
          <Card key={t.id}>
            <CardContent className="py-4">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex-1">
                  <div className="font-medium">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.properties?.name} · <span className="capitalize">{t.cadence}</span> · {t.format.replace("_", " ")} · <span className="capitalize">{t.role_required}</span></div>
                </div>
                <Button size="sm" variant="outline" onClick={() => setExpanded(expanded === t.id ? null : t.id)}>
                  {expanded === t.id ? "Hide" : "Edit items"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => del.mutate(t.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
              {expanded === t.id && <TemplateEditor templateId={t.id} />}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function TemplateEditor({ templateId }: { templateId: string }) {
  const qc = useQueryClient();
  const [newCat, setNewCat] = useState("");
  const [newItem, setNewItem] = useState<Record<string, string>>({});

  const { data: categories } = useQuery({
    queryKey: ["cats", templateId],
    queryFn: async () => (await supabase.from("checklist_categories").select("*, checklist_items(*)").eq("template_id", templateId).order("sort_order")).data ?? [],
  });

  const addCat = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("checklist_categories").insert({ template_id: templateId, name: newCat, sort_order: (categories?.length ?? 0) });
      if (error) throw error;
    },
    onSuccess: () => { setNewCat(""); qc.invalidateQueries({ queryKey: ["cats", templateId] }); },
  });
  const addItem = useMutation({
    mutationFn: async ({ categoryId, label }: { categoryId: string; label: string }) => {
      const { error } = await supabase.from("checklist_items").insert({ category_id: categoryId, label, sort_order: 0 });
      if (error) throw error;
    },
    onSuccess: (_d, v) => { setNewItem({ ...newItem, [v.categoryId]: "" }); qc.invalidateQueries({ queryKey: ["cats", templateId] }); },
  });

  return (
    <div className="mt-4 border-t pt-4 space-y-4">
      {categories?.map((c: any) => (
        <div key={c.id} className="border rounded p-3">
          <div className="font-medium">{c.name}</div>
          <ul className="mt-2 space-y-1 text-sm">
            {c.checklist_items?.filter((i: any) => !i.parent_item_id).map((i: any) => (
              <li key={i.id} className="flex items-center gap-2"><Badge variant="outline" className="text-xs">item</Badge>{i.label}</li>
            ))}
          </ul>
          <div className="flex gap-2 mt-3">
            <Input placeholder="New item label" value={newItem[c.id] ?? ""} onChange={(e) => setNewItem({ ...newItem, [c.id]: e.target.value })} />
            <Button size="sm" onClick={() => addItem.mutate({ categoryId: c.id, label: newItem[c.id] ?? "" })} disabled={!newItem[c.id]}><Plus className="h-4 w-4" /></Button>
          </div>
        </div>
      ))}
      <div className="flex gap-2">
        <Input placeholder="New category" value={newCat} onChange={(e) => setNewCat(e.target.value)} />
        <Button onClick={() => addCat.mutate()} disabled={!newCat}><Plus className="h-4 w-4 mr-1" />Category</Button>
      </div>
    </div>
  );
}
