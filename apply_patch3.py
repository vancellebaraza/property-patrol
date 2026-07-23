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

# ---------- app.admin.index.tsx (Pending tab): fix stale role checks ----------
patch(
    "src/routes/app.admin.index.tsx",
    'const ROLES = ["admin", "supervisor", "caretaker", "site_rep"] as const;',
    'const ROLES = ["super_admin", "operations_admin", "finance_admin", "marketing_admin", "supervisor", "caretaker", "site_rep"] as const;',
    "app.admin.index.tsx ROLES const",
)

patch(
    "src/routes/app.admin.index.tsx",
    '.or("role.is.null,and(property_id.is.null,role.neq.admin)")',
    '.or("role.is.null,and(property_id.is.null,role.not.in.(super_admin,operations_admin))")',
    "app.admin.index.tsx pending query filter",
)

patch(
    "src/routes/app.admin.index.tsx",
    '''function PendingRow({ user, properties, onSaved }: any) {
  const [role, setRole] = useState<string>(user.role ?? "");
  const [propertyId, setPropertyId] = useState<string>(user.property_id ?? "");''',
    '''function PendingRow({ user, properties, onSaved }: any) {
  const [role, setRole] = useState<string>(user.role ?? "");
  const [propertyId, setPropertyId] = useState<string>(user.property_id ?? "");
  const isFullAdmin = role === "super_admin" || role === "operations_admin";''',
    "app.admin.index.tsx isFullAdmin flag",
)

patch(
    "src/routes/app.admin.index.tsx",
    '''        <Select value={propertyId} onValueChange={setPropertyId}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Property" /></SelectTrigger>
          <SelectContent>
            {properties.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={() => save.mutate()} disabled={!role || (role !== "admin" && !propertyId) || save.isPending}>Assign</Button>''',
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
    "app.admin.index.tsx disable property select + fix Assign gating",
)

# ---------- app.admin.users.tsx: disable/hide Property select for full-admin rows ----------
patch(
    "src/routes/app.admin.users.tsx",
    '''                  <Select value={u.property_id ?? ""} onValueChange={(v) => update.mutate({ id: u.id, patch: { property_id: v } })}>
                    <SelectTrigger className="w-44 h-8"><SelectValue placeholder="Property" /></SelectTrigger>
                    <SelectContent>
                      {properties?.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>''',
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
    "app.admin.users.tsx disable property select for full admins",
)

print("\\nAll patches applied.")
