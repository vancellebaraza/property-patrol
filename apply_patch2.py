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

# ---------- app.tsx: header shows "All Properties" for full-admins with no property ----------
patch(
    "src/routes/app.tsx",
    '''import { useProfile, isAdminRole } from "@/hooks/useAuth";''',
    '''import { useProfile, isAdminRole, isSuperAdminRole } from "@/hooks/useAuth";''',
    "app.tsx isSuperAdminRole import",
)

patch(
    "src/routes/app.tsx",
    '''            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground leading-none">Property</div>
              <div className="truncate font-bold text-sm sm:text-base leading-tight">
                {property?.name ?? "OpsCheck"}
              </div>
            </div>''',
    '''            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground leading-none">
                {isAdminRole(profile.role) && !profile.property_id ? "Access" : "Property"}
              </div>
              <div className="truncate font-bold text-sm sm:text-base leading-tight">
                {property?.name ?? (isAdminRole(profile.role) ? "All Properties" : "OpsCheck")}
              </div>
            </div>''',
    "app.tsx header label",
)

# ---------- useDailyPlan.ts: property_id becomes optional ----------
patch(
    "src/hooks/useDailyPlan.ts",
    '''  const savePlan = useMutation({
    mutationFn: async () => {
      if (!profile) throw new Error("Profile not loaded");
      if (!profile.property_id) throw new Error("No property assigned to this account");
      const { error } = await supabase.from("daily_plans").insert({
        user_id: profile.id,
        property_id: profile.property_id,
        plan_date: dateKey,
        plan_text: planText,
        status: "planned",
      });
      if (error) throw error;
    },''',
    '''  const savePlan = useMutation({
    mutationFn: async () => {
      if (!profile) throw new Error("Profile not loaded");
      const { error } = await supabase.from("daily_plans").insert({
        user_id: profile.id,
        property_id: profile.property_id ?? null,
        plan_date: dateKey,
        plan_text: planText,
        status: "planned",
      });
      if (error) throw error;
    },''',
    "useDailyPlan.ts optional property_id",
)

# ---------- app.admin.users.tsx: clearer label for null-property rows ----------
patch(
    "src/routes/app.admin.users.tsx",
    '''  const propName = (id: string) => id === "unassigned" ? "Unassigned" : properties?.find((p: any) => p.id === id)?.name ?? "Unknown";''',
    '''  const propName = (id: string) => id === "unassigned" ? "Full Admins (all properties)" : properties?.find((p: any) => p.id === id)?.name ?? "Unknown";''',
    "app.admin.users.tsx group label",
)

# ---------- app.admin.board.tsx: same dead-role-filter bug we already fixed in todos.tsx ----------
patch(
    "src/routes/app.admin.board.tsx",
    '.neq("role", "admin")',
    '.neq("role", "super_admin")',
    "app.admin.board.tsx staff filter",
)

print("\\nAll patches applied.")
