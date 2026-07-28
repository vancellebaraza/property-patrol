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

# ================= useAuth.ts =================
patch(
    "src/hooks/useAuth.ts",
    '''// Only super_admin may change anyone's role — mirrors the DB trigger, UI-side.
export function canChangeRoles(role: AppRole | null | undefined): boolean {
  return role === "super_admin";
}''',
    '''// super_admin and operations_admin can open the role editor at all — mirrors the DB trigger, UI-side.
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
  const all: AppRole[] = ["super_admin", "operations_admin", "finance_admin", "marketing_admin", "supervisor", "caretaker", "site_rep"];
  return actingRole === "super_admin" ? all : all.filter((r) => r !== "super_admin");
}''',
    "useAuth.ts role-editing helpers",
)

# ================= app.admin.users.tsx =================
patch(
    "src/routes/app.admin.users.tsx",
    '''import { useProfile, canChangeRoles } from "@/hooks/useAuth";''',
    '''import { useProfile, canManageRoles, canEditThisRole, assignableRoles } from "@/hooks/useAuth";''',
    "users.tsx import swap",
)

patch(
    "src/routes/app.admin.users.tsx",
    '''  const allowRoleEdit = canChangeRoles(currentProfile?.role);''',
    '''  const allowRoleEdit = canManageRoles(currentProfile?.role);''',
    "users.tsx allowRoleEdit swap",
)

patch(
    "src/routes/app.admin.users.tsx",
    '''                  {allowRoleEdit ? (
                    <Select value={u.role ?? ""} onValueChange={(v) => update.mutate({ id: u.id, patch: { role: v } })}>
                      <SelectTrigger className="w-40 h-8"><SelectValue placeholder="Role" /></SelectTrigger>
                      <SelectContent>
                        {ROLES.map((r) => <SelectItem key={r} value={r} className="capitalize">{r.replace("_", " ")}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="outline" className="capitalize">{(u.role ?? "—").replace("_", " ")}</Badge>
                  )}''',
    '''                  {allowRoleEdit && canEditThisRole(currentProfile?.role, u.role) ? (
                    <Select value={u.role ?? ""} onValueChange={(v) => update.mutate({ id: u.id, patch: { role: v } })}>
                      <SelectTrigger className="w-40 h-8"><SelectValue placeholder="Role" /></SelectTrigger>
                      <SelectContent>
                        {assignableRoles(currentProfile?.role).map((r) => <SelectItem key={r} value={r} className="capitalize">{r.replace("_", " ")}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="outline" className="capitalize">{(u.role ?? "—").replace("_", " ")}</Badge>
                  )}''',
    "users.tsx role select per-row gating",
)

print("\\nAll patches applied.")
