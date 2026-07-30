import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { useProfile, canManageRoles, canEditThisRole, assignableRoles } from "@/hooks/useAuth";

export const Route = createFileRoute("/app/admin/users")({
  component: UsersPage,
});

const ROLES = ["super_admin", "operations_admin", "finance_admin", "marketing_admin", "supervisor", "caretaker", "site_rep"] as const;

function UsersPage() {
  const qc = useQueryClient();
  const { profile: currentProfile } = useProfile();
  const allowRoleEdit = canManageRoles(currentProfile?.role);
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
  const { data: supervisorExtra } = useQuery({
    queryKey: ["supervisor-properties-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("supervisor_properties").select("*");
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

  const toggleSupervisorProperty = useMutation({
    mutationFn: async ({ user, propertyId, checked }: { user: any; propertyId: string; checked: boolean }) => {
      const extras = (supervisorExtra ?? []).filter((r: any) => r.user_id === user.id).map((r: any) => r.property_id);
      const allSelected = [...(user.property_id ? [user.property_id] : []), ...extras];
      if (checked) {
        if (!user.property_id) {
          const { error } = await supabase.from("user_profiles").update({ property_id: propertyId }).eq("id", user.id);
          if (error) throw error;
        } else if (!allSelected.includes(propertyId)) {
          const { error } = await supabase.from("supervisor_properties").insert({ user_id: user.id, property_id: propertyId });
          if (error) throw error;
        }
      } else if (propertyId === user.property_id) {
        const remaining = extras.filter((id: string) => id !== propertyId);
        if (remaining.length > 0) {
          const promote = remaining[0];
          const { error: e1 } = await supabase.from("user_profiles").update({ property_id: promote }).eq("id", user.id);
          if (e1) throw e1;
          const { error: e2 } = await supabase.from("supervisor_properties").delete().eq("user_id", user.id).eq("property_id", promote);
          if (e2) throw e2;
        } else {
          const { error } = await supabase.from("user_profiles").update({ property_id: null }).eq("id", user.id);
          if (error) throw error;
        }
      } else {
        const { error } = await supabase.from("supervisor_properties").delete().eq("user_id", user.id).eq("property_id", propertyId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["all-users"] });
      qc.invalidateQueries({ queryKey: ["supervisor-properties-all"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const grouped = new Map<string, any[]>();
  for (const u of users ?? []) {
    const key = u.property_id ?? "unassigned";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(u);
  }

  const propName = (id: string) => id === "unassigned" ? "Full Admins (all properties)" : properties?.find((p: any) => p.id === id)?.name ?? "Unknown";

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
                  {allowRoleEdit && canEditThisRole(currentProfile?.role, u.role) ? (
                    <Select value={u.role ?? ""} onValueChange={(v) => update.mutate({ id: u.id, patch: { role: v } })}>
                      <SelectTrigger className="w-40 h-8"><SelectValue placeholder="Role" /></SelectTrigger>
                      <SelectContent>
                        {assignableRoles(currentProfile?.role).map((r) => <SelectItem key={r} value={r} className="capitalize">{r.replace("_", " ")}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="outline" className="capitalize">{(u.role ?? "—").replace("_", " ")}</Badge>
                  )}
                  {u.role === "super_admin" || u.role === "operations_admin" ? (
                    <Badge variant="secondary" className="w-44 justify-center h-8">All properties</Badge>
                  ) : u.role === "finance_admin" || u.role === "marketing_admin" ? (
                    <Badge variant="secondary" className="w-44 justify-center h-8">No property</Badge>
                  ) : u.role === "supervisor" ? (
                    (() => {
                      const extras = (supervisorExtra ?? []).filter((r: any) => r.user_id === u.id).map((r: any) => r.property_id);
                      const selected = new Set([...(u.property_id ? [u.property_id] : []), ...extras]);
                      return (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="w-44 h-8 justify-start font-normal">
                              {selected.size === 0 ? "No properties" : selected.size === 1 ? properties?.find((p: any) => p.id === [...selected][0])?.name : `${selected.size} properties`}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-56 p-2">
                            <div className="space-y-1">
                              {properties?.map((p: any) => (
                                <label key={p.id} className="flex items-center gap-2 text-sm px-2 py-1.5 rounded hover:bg-muted cursor-pointer">
                                  <Checkbox
                                    checked={selected.has(p.id)}
                                    onCheckedChange={(v) => toggleSupervisorProperty.mutate({ user: u, propertyId: p.id, checked: !!v })}
                                  />
                                  {p.name}
                                </label>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                      );
                    })()
                  ) : (
                    <Select value={u.property_id ?? ""} onValueChange={(v) => update.mutate({ id: u.id, patch: { property_id: v } })}>
                      <SelectTrigger className="w-44 h-8"><SelectValue placeholder="Property" /></SelectTrigger>
                      <SelectContent>
                        {properties?.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
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
