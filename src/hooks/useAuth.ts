import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export type AppRole =
  | "super_admin"
  | "operations_admin"
  | "finance_admin"
  | "marketing_admin"
  | "supervisor"
  | "caretaker"
  | "site_rep";

// Roles that get the full /app/admin dashboard (all tabs).
const ADMIN_ROLES: AppRole[] = ["super_admin", "operations_admin"];

export function isAdminRole(role: AppRole | null | undefined): boolean {
  return !!role && ADMIN_ROLES.includes(role);
}

export function isSuperAdminRole(role: AppRole | null | undefined): boolean {
  return role === "super_admin";
}

// Only super_admin may change anyone's role — mirrors the DB trigger, UI-side.
export function canChangeRoles(role: AppRole | null | undefined): boolean {
  return role === "super_admin";
}

// Roles that write their own daily plan and appear in the To-Do staff grid,
// but are not super_admin (super_admin only views, never writes).
export function writesOwnPlan(role: AppRole | null | undefined): boolean {
  return isAdminRole(role) && role !== "super_admin";
}

const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: "Super Admin",
  operations_admin: "Operations Admin",
  finance_admin: "Finance Admin",
  marketing_admin: "Marketing Admin",
  supervisor: "Supervisor",
  caretaker: "Caretaker",
  site_rep: "Site Rep",
};

export function formatRoleLabel(role: AppRole | null | undefined): string {
  if (!role) return "—";
  return ROLE_LABELS[role] ?? role;
}

export interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  property_id: string | null;
  role: AppRole | null;
  active: boolean;
  created_at: string;
}

export function useSession() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  return { user, loading };
}

export function useProfile() {
  const { user, loading: sessionLoading } = useSession();
  const q = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<UserProfile | null> => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data as UserProfile | null;
    },
  });
  return { user, profile: q.data ?? null, loading: sessionLoading || q.isLoading, refetch: q.refetch };
}
