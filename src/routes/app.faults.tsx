import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Wrench, Plus } from "lucide-react";

export const Route = createFileRoute("/app/faults")({
  component: FaultsPage,
});

function FaultsPage() {
  const { profile, user } = useProfile();
  const qc = useQueryClient();
  const [equipment, setEquipment] = useState("");
  const [desc, setDesc] = useState("");
  const [filter, setFilter] = useState<"all" | "reported" | "broken" | "repaired">("all");

  const { data: faults } = useQuery({
    queryKey: ["faults", profile?.property_id],
    enabled: !!profile,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fault_log_entries")
        .select("*")
        .eq("property_id", profile!.property_id!)
        .order("reported_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!user || !profile?.property_id) return;
      const { error } = await supabase.from("fault_log_entries").insert({
        property_id: profile.property_id,
        equipment_type: equipment,
        fault_description: desc,
        reported_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fault reported");
      setEquipment(""); setDesc("");
      qc.invalidateQueries({ queryKey: ["faults"] });
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["faults"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = (faults ?? []).filter((f: any) => filter === "all" || f.status === filter);

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1 order-2 lg:order-1">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Wrench className="h-4 w-4" />Report a fault</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input value={equipment} onChange={(e) => setEquipment(e.target.value)} placeholder="Equipment (e.g. Pool pump)" className="h-11" />
            <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What is wrong?" />
            <Button className="w-full h-11" disabled={!equipment || !desc || create.isPending} onClick={() => create.mutate()}>
              <Plus className="h-4 w-4 mr-1" />Report fault
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-2 order-1 lg:order-2 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h1 className="font-bold text-xl">Fault log</h1>
          <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
            <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="reported">Reported</SelectItem>
              <SelectItem value="broken">Broken</SelectItem>
              <SelectItem value="repaired">Repaired</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {filtered.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">No faults.</p>}
        {filtered.map((f: any) => (
          <Card key={f.id}>
            <CardContent className="py-3">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-start">
                <div className="min-w-0">
                  <div className="font-medium">{f.equipment_type}</div>
                  <div className="text-sm text-muted-foreground mt-0.5">{f.fault_description}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    Reported {new Date(f.reported_at).toLocaleString()}
                    {f.resolved_at && <> · Resolved {new Date(f.resolved_at).toLocaleString()}</>}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <FaultBadge status={f.status} />
                  <Select value={f.status} onValueChange={(v) => updateStatus.mutate({ id: f.id, status: v as any })}>
                    <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="reported">Reported</SelectItem>
                      <SelectItem value="broken">Broken</SelectItem>
                      <SelectItem value="repaired">Repaired</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function FaultBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    reported: "bg-warning text-warning-foreground",
    broken: "bg-destructive text-destructive-foreground",
    repaired: "bg-success text-success-foreground",
  };
  return <Badge className={map[status]}>{status}</Badge>;
}
