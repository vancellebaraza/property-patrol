import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useProfile, canChangeRoles } from "@/hooks/useAuth";

export const Route = createFileRoute("/app/admin/users")({
  component: UsersPage,
});

const ROLES = ["super_admin", "operations_admin", "finance_admin", "marketing_admin", "supervisor", "caretaker", "site_rep"] as const;

function UsersPage() {
  const qc = useQueryClient();
  const { profile: currentProfile } = useProfile();
  const allowRoleEdit = canChangeRoles(currentProfile?.role);
  const { data: users } = useQuery({
    queryKey: ["all-users"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_profiles").select("*").order("created_at");
      if (error) throw error;
      return data;
    },
  });
  const { data: properties } = useQuery({
    queryKey: ["properties-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("properties").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: any }) => {
      const { error } = await supabase.from("user_profiles").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["all-users"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const grouped = new Map<string, any[]>();
  for (const u of users ?? []) {
    const key = u.property_id ?? "unassigned";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(u);
  }

  const propName = (id: string) => id === "unassigned" ? "Unassigned" : properties?.find((p: any) => p.id === id)?.name ?? "Unknown";

  return (
    <div className="space-y-6">
      {Array.from(grouped.entries()).map(([propId, list]) => (
        <div key={propId}>
          <h2 className="font-semibold mb-2">{propName(propId)}</h2>
          <div className="space-y-2">
            {list.map((u: any) => (
              <Card key={u.id}>
                <CardContent className="py-3 flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-40">
                    <div className="font-medium text-sm">{u.full_name || "(no name)"}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </div>
                  {allowRoleEdit ? (
                    <Select value={u.role ?? ""} onValueChange={(v) => update.mutate({ id: u.id, patch: { role: v } })}>
                      <SelectTrigger className="w-40 h-8"><SelectValue placeholder="Role" /></SelectTrigger>
                      <SelectContent>
                        {ROLES.map((r) => <SelectItem key={r} value={r} className="capitalize">{r.replace("_", " ")}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="outline" className="capitalize">{(u.role ?? "—").replace("_", " ")}</Badge>
                  )}
                  <Select value={u.property_id ?? ""} onValueChange={(v) => update.mutate({ id: u.id, patch: { property_id: v } })}>
                    <SelectTrigger className="w-44 h-8"><SelectValue placeholder="Property" /></SelectTrigger>
                    <SelectContent>
                      {properties?.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-2 text-xs">
                    Active
                    <Switch checked={u.active} onCheckedChange={(v) => update.mutate({ id: u.id, patch: { active: v } })} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
