import pathlib, sys

def patch(path, old, new, label):
    p = pathlib.Path(path)
    text = p.read_text()
    if new.strip() and new.strip() in text:
        print(f"SKIP  {label} (already applied)")
        return
    if old not in text:
        print(f"FAIL  {label} — anchor text not found in {path}. Stopping, nothing else changed.")
        sys.exit(1)
    p.write_text(text.replace(old, new, 1))
    print(f"OK    {label}")

patch(
    "src/routes/app.admin.users.tsx",
    '''import { Badge } from "@/components/ui/badge";
import { useProfile, canChangeRoles } from "@/hooks/useAuth";''',
    '''import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { useProfile, canChangeRoles } from "@/hooks/useAuth";''',
    "users.tsx new imports",
)

patch(
    "src/routes/app.admin.users.tsx",
    '''  const { data: properties } = useQuery({
    queryKey: ["properties-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("properties").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });''',
    '''  const { data: properties } = useQuery({
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
  });''',
    "users.tsx supervisorExtra query",
)

patch(
    "src/routes/app.admin.users.tsx",
    '''    onError: (e: any) => toast.error(e.message),
  });

  const grouped = new Map<string, any[]>();''',
    '''    onError: (e: any) => toast.error(e.message),
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

  const grouped = new Map<string, any[]>();''',
    "users.tsx toggleSupervisorProperty mutation",
)

patch(
    "src/routes/app.admin.users.tsx",
    '''                  {u.role === "super_admin" || u.role === "operations_admin" ? (
                    <Badge variant="secondary" className="w-44 justify-center h-8">All properties</Badge>
                  ) : (
                    <Select value={u.property_id ?? ""} onValueChange={(v) => update.mutate({ id: u.id, patch: { property_id: v } })}>
                      <SelectTrigger className="w-44 h-8"><SelectValue placeholder="Property" /></SelectTrigger>
                      <SelectContent>
                        {properties?.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}''',
    '''                  {u.role === "super_admin" || u.role === "operations_admin" ? (
                    <Badge variant="secondary" className="w-44 justify-center h-8">All properties</Badge>
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
                  )}''',
    "users.tsx supervisor multi-select popover",
)

print("\\nAll patches applied.")
