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
    '''export type AppRole =
  | "super_admin"
  | "operations_admin"
  | "finance_admin"
  | "marketing_admin"
  | "supervisor"
  | "caretaker"
  | "site_rep";''',
    '''export type AppRole =
  | "super_admin"
  | "operations_admin"
  | "finance_admin"
  | "marketing_admin"
  | "finance_staff"
  | "marketing_staff"
  | "supervisor"
  | "caretaker"
  | "site_rep";''',
    "useAuth.ts AppRole type additions",
)

patch(
    "src/hooks/useAuth.ts",
    '''export function hasNoSingleProperty(role: AppRole | null | undefined): boolean {
  return role === "finance_admin" || role === "marketing_admin";
}''',
    '''export function hasNoSingleProperty(role: AppRole | null | undefined): boolean {
  return role === "finance_admin" || role === "marketing_admin" || role === "finance_staff" || role === "marketing_staff";
}''',
    "useAuth.ts hasNoSingleProperty extension",
)

patch(
    "src/hooks/useAuth.ts",
    '''export function assignableRoles(actingRole: AppRole | null | undefined): AppRole[] {
  const all: AppRole[] = ["super_admin", "operations_admin", "finance_admin", "marketing_admin", "supervisor", "caretaker", "site_rep"];
  return actingRole === "super_admin" ? all : all.filter((r) => r !== "super_admin");
}''',
    '''export function assignableRoles(actingRole: AppRole | null | undefined): AppRole[] {
  const all: AppRole[] = ["super_admin", "operations_admin", "finance_admin", "marketing_admin", "finance_staff", "marketing_staff", "supervisor", "caretaker", "site_rep"];
  if (actingRole === "super_admin") return all;
  if (actingRole === "finance_admin") return ["finance_admin", "finance_staff"];
  if (actingRole === "marketing_admin") return ["marketing_admin", "marketing_staff"];
  // operations_admin keeps its existing, unrestricted-except-super_admin behavior — unchanged.
  return all.filter((r) => r !== "super_admin");
}''',
    "useAuth.ts assignableRoles — only finance/marketing get department isolation, operations_admin untouched",
)

# ================= auth.tsx: department selector on sign-up =================
patch(
    "src/routes/auth.tsx",
    '''  const [fullName, setFullName] = useState("");''',
    '''  const [fullName, setFullName] = useState("");
  const [department, setDepartment] = useState("operations");''',
    "auth.tsx department state",
)

patch(
    "src/routes/auth.tsx",
    '''        data: { full_name: fullName },''',
    '''        data: { full_name: fullName, department },''',
    "auth.tsx include department in signup payload",
)

patch(
    "src/routes/auth.tsx",
    '''                  <div>
                    <Label htmlFor="su-password">Password</Label>
                    <Input id="su-password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>Create account</Button>''',
    '''                  <div>
                    <Label htmlFor="su-password">Password</Label>
                    <Input id="su-password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="su-department">Department</Label>
                    <Select value={department} onValueChange={setDepartment}>
                      <SelectTrigger id="su-department"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="operations">Operations</SelectItem>
                        <SelectItem value="finance">Finance</SelectItem>
                        <SelectItem value="marketing">Marketing</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>Create account</Button>''',
    "auth.tsx department selector field",
)

patch(
    "src/routes/auth.tsx",
    '''import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";''',
    '''import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";''',
    "auth.tsx Select import",
)

# ================= app.index.tsx: todoOnly extends to finance_staff / marketing_staff =================
patch(
    "src/routes/app.index.tsx",
    '''  const todoOnly = profile?.role === "finance_admin" || profile?.role === "marketing_admin";''',
    '''  const todoOnly = ["finance_admin", "marketing_admin", "finance_staff", "marketing_staff"].includes(profile?.role ?? "");''',
    "app.index.tsx todoOnly covers department staff too",
)

# ================= app.admin.index.tsx: Pending tab role dropdown becomes department-aware for the ACTING admin =================
patch(
    "src/routes/app.admin.index.tsx",
    '''import { toast } from "sonner";''',
    '''import { toast } from "sonner";
import { useProfile, assignableRoles, hasNoSingleProperty } from "@/hooks/useAuth";''',
    "app.admin.index.tsx imports",
)

patch(
    "src/routes/app.admin.index.tsx",
    '''        <PendingRow key={u.id} user={u} properties={properties ?? []} onSaved={() => qc.invalidateQueries({ queryKey: ["pending-users"] })} />''',
    '''        <PendingRow key={u.id} user={u} properties={properties ?? []} actingRole={currentProfile?.role} onSaved={() => qc.invalidateQueries({ queryKey: ["pending-users"] })} />''',
    "app.admin.index.tsx pass actingRole to PendingRow",
)

patch(
    "src/routes/app.admin.index.tsx",
    '''function PendingApprovals() {
  const qc = useQueryClient();''',
    '''function PendingApprovals() {
  const qc = useQueryClient();
  const { profile: currentProfile } = useProfile();''',
    "app.admin.index.tsx currentProfile in PendingApprovals",
)

patch(
    "src/routes/app.admin.index.tsx",
    '''function PendingRow({ user, properties, onSaved }: any) {
  const [role, setRole] = useState<string>(user.role ?? "");
  const [propertyId, setPropertyId] = useState<string>(user.property_id ?? "");
  const isFullAdmin = role === "super_admin" || role === "operations_admin";''',
    '''function PendingRow({ user, properties, actingRole, onSaved }: any) {
  const [role, setRole] = useState<string>(user.role ?? "");
  const [propertyId, setPropertyId] = useState<string>(user.property_id ?? "");
  const isFullAdmin = role === "super_admin" || role === "operations_admin";
  const isNoProperty = hasNoSingleProperty(role as any);
  const skipsProperty = isFullAdmin || isNoProperty;
  const roleOptions = assignableRoles(actingRole);''',
    "app.admin.index.tsx PendingRow department-aware role options",
)

patch(
    "src/routes/app.admin.index.tsx",
    '''        <Select value={propertyId} onValueChange={setPropertyId} disabled={isFullAdmin}>
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
        </Button>''',
    '''        <Select value={propertyId} onValueChange={setPropertyId} disabled={skipsProperty}>
          <SelectTrigger className="w-48"><SelectValue placeholder={isFullAdmin ? "All properties" : isNoProperty ? "No property" : "Property"} /></SelectTrigger>
          <SelectContent>
            {properties.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button
          onClick={() => save.mutate()}
          disabled={!role || (!skipsProperty && !propertyId) || save.isPending}
        >
          Assign
        </Button>''',
    "app.admin.index.tsx skipsProperty gating",
)

patch(
    "src/routes/app.admin.index.tsx",
    '''            {ROLES.map((r) => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}''',
    '''            {roleOptions.map((r) => <SelectItem key={r} value={r} className="capitalize">{r.replace("_", " ")}</SelectItem>)}''',
    "app.admin.index.tsx role dropdown uses department-aware options",
)

# ================= app.admin.users.tsx: "No property" badge covers the two new staff roles =================
patch(
    "src/routes/app.admin.users.tsx",
    '''                  ) : u.role === "finance_admin" || u.role === "marketing_admin" ? (
                    <Badge variant="secondary" className="w-44 justify-center h-8">No property</Badge>''',
    '''                  ) : u.role === "finance_admin" || u.role === "marketing_admin" || u.role === "finance_staff" || u.role === "marketing_staff" ? (
                    <Badge variant="secondary" className="w-44 justify-center h-8">No property</Badge>''',
    "users.tsx no-property badge covers finance_staff/marketing_staff",
)

print("\\nAll patches applied.")
