import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/app/admin/")({
  component: PendingApprovals,
});

const ROLES = ["super_admin", "operations_admin", "finance_admin", "marketing_admin", "supervisor", "caretaker", "site_rep"] as const;

function PendingApprovals() {
  const qc = useQueryClient();

  const { data: pending } = useQuery({
    queryKey: ["pending-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("*")
        .or("role.is.null,and(property_id.is.null,role.not.in.(super_admin,operations_admin))")
        .order("created_at", { ascending: false });
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

  return (
    <div className="space-y-4">
      {pending?.length === 0 && <p className="text-sm text-muted-foreground">No pending users.</p>}
      {pending?.map((u: any) => (
        <PendingRow key={u.id} user={u} properties={properties ?? []} onSaved={() => qc.invalidateQueries({ queryKey: ["pending-users"] })} />
      ))}
    </div>
  );
}

function PendingRow({ user, properties, onSaved }: any) {
  const [role, setRole] = useState<string>(user.role ?? "");
  const [propertyId, setPropertyId] = useState<string>(user.property_id ?? "");
  const isFullAdmin = role === "super_admin" || role === "operations_admin";

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("user_profiles")
        .update({ role: role as any, property_id: propertyId || null })
        .eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("User assigned");
      onSaved();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card>
      <CardContent className="py-4 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-52">
          <div className="font-medium">{user.full_name || "(no name)"}</div>
          <div className="text-sm text-muted-foreground">{user.email}</div>
        </div>
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Role" /></SelectTrigger>
          <SelectContent>
            {ROLES.map((r) => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={propertyId} onValueChange={setPropertyId} disabled={isFullAdmin}>
          <SelectTrigger className="w-48"><SelectValue placeholder={isFullAdmin ? "All properties" : "Property"} /></SelectTrigger>
          <SelectContent>
            {properties.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button
          onClick={() => save.mutate()}
          disabled={!role || (!isFullAdmin && !propertyId) || save.isPending}
        >
          Assign
        </Button>
      </CardContent>
    </Card>
  );
}
