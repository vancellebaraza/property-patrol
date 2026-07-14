import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAllProperties, themeStyle } from "@/hooks/useProperty";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/app/admin/faults")({
  component: AdminFaults,
});

function AdminFaults() {
  const qc = useQueryClient();
  const { data: properties } = useAllProperties();
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "reported" | "broken" | "repaired">("all");

  const active = properties?.find((p) => p.id === propertyId) ?? properties?.[0];
  const activeId = active?.id ?? null;

  const { data: faults } = useQuery({
    queryKey: ["admin-faults", activeId],
    enabled: !!activeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fault_log_entries")
        .select("*, user_profiles!fault_log_entries_reported_by_fkey(full_name, email)")
        .eq("property_id", activeId!)
        .order("reported_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "reported" | "broken" | "repaired" }) => {
      const { error } = await supabase
        .from("fault_log_entries")
        .update({ status, resolved_at: status === "repaired" ? new Date().toISOString() : null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-faults"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = useMemo(
    () => (faults ?? []).filter((f: any) => filter === "all" || f.status === filter),
    [faults, filter]
  );

  return (
    <div style={themeStyle(active?.theme_color)}>
      <div className="flex gap-2 mb-5 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        {properties?.map((p) => {
          const isActive = (activeId ?? properties[0]?.id) === p.id;
          return (
            <button
              key={p.id}
              onClick={() => setPropertyId(p.id)}
              className="px-4 py-2 rounded-md text-sm font-medium border-2 whitespace-nowrap flex items-center gap-2"
              style={{
                borderColor: isActive ? (p.theme_color ?? "var(--primary)") : "transparent",
                backgroundColor: isActive ? `${p.theme_color ?? "var(--primary)"}15` : "transparent",
                color: isActive ? (p.theme_color ?? "var(--primary)") : undefined,
              }}
            >
              {p.logo_url && <img src={p.logo_url} className="h-4 w-4 rounded object-cover" alt="" />}
              {p.name}
            </button>
          );
        })}
      </div>

      <div className="flex justify-between items-center mb-3">
        <h2 className="font-bold text-lg">Fault log</h2>
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

      <div className="space-y-2">
        {filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No faults.</p>}
        {filtered.map((f: any) => (
          <Card key={f.id}>
            <CardContent className="py-3 grid grid-cols-[minmax(0,1fr)_auto] gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="font-semibold text-sm">{f.equipment_type}</div>
                  <FaultBadge status={f.status} />
                </div>
                <div className="text-sm text-muted-foreground mt-0.5">{f.fault_description}</div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  Reported by {f.user_profiles?.full_name || f.user_profiles?.email || "unknown"} · {new Date(f.reported_at).toLocaleString()}
                  {f.resolved_at && <> · Resolved {new Date(f.resolved_at).toLocaleString()}</>}
                </div>
              </div>
              <Select value={f.status} onValueChange={(v) => updateStatus.mutate({ id: f.id, status: v as any })}>
                <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="reported">Reported</SelectItem>
                  <SelectItem value="broken">Broken</SelectItem>
                  <SelectItem value="repaired">Repaired</SelectItem>
                </SelectContent>
              </Select>
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
