import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export type AppRole =
  | "super_admin"
  | "operations_admin"
  | "finance_admin"
  | "marketing_admin"
  | "finance_staff"
  | "marketing_staff"
  | "supervisor"
  | "caretaker"
  | "site_rep";

// Roles that can reach the /app/admin dashboard at all.
// Super Admin and Operations Admin get every tab; Finance/Marketing Admin get a
// department-scoped subset (Pending, To-Do, Users) — see the tabs list in app.admin.tsx.
const ADMIN_ROLES: AppRole[] = ["super_admin", "operations_admin", "finance_admin", "marketing_admin"];

// Only these two see every property and get the full 7-tab dashboard.
export function isFullPropertyAdmin(role: AppRole | null | undefined): boolean {
  return role === "super_admin" || role === "operations_admin";
}

export function isAdminRole(role: AppRole | null | undefined): boolean {
  return !!role && ADMIN_ROLES.includes(role);
}

export function isSuperAdminRole(role: AppRole | null | undefined): boolean {
  return role === "super_admin";
}

// finance_admin and marketing_admin are never tied to a single property either —
// they just aren't full admins with dashboard access like super_admin/operations_admin.
export function hasNoSingleProperty(role: AppRole | null | undefined): boolean {
  return role === "finance_admin" || role === "marketing_admin" || role === "finance_staff" || role === "marketing_staff";
}

// Which department a role belongs to. super_admin sits above all departments (null).
export function roleDepartment(role: AppRole | null | undefined): "operations" | "finance" | "marketing" | null {
  if (role === "operations_admin" || role === "supervisor" || role === "caretaker" || role === "site_rep") return "operations";
  if (role === "finance_admin" || role === "finance_staff") return "finance";
  if (role === "marketing_admin" || role === "marketing_staff") return "marketing";
  return null;
}

// super_admin and operations_admin can open the role editor at all — mirrors the DB trigger, UI-side.
export function canManageRoles(role: AppRole | null | undefined): boolean {
  return role === "super_admin" || role === "operations_admin";
}

// Whether `actingRole` may change THIS SPECIFIC row's role, given the row's current role.
// super_admin: unrestricted. operations_admin: everyone except existing super_admin rows.
export function canEditThisRole(actingRole: AppRole | null | undefined, targetCurrentRole: AppRole | null | undefined): boolean {
  if (actingRole === "super_admin") return true;
  if (actingRole === "operations_admin") return targetCurrentRole !== "super_admin";
  return false;
}

// Roles selectable in the dropdown for a given actor — operations_admin can never promote to super_admin.
export function assignableRoles(actingRole: AppRole | null | undefined): AppRole[] {
  const all: AppRole[] = ["super_admin", "operations_admin", "finance_admin", "marketing_admin", "finance_staff", "marketing_staff", "supervisor", "caretaker", "site_rep"];
  if (actingRole === "super_admin") return all;
  if (actingRole === "finance_admin") return ["finance_admin", "finance_staff"];
  if (actingRole === "marketing_admin") return ["marketing_admin", "marketing_staff"];
  // operations_admin keeps its existing, unrestricted-except-super_admin behavior — unchanged.
  return all.filter((r) => r !== "super_admin");
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
