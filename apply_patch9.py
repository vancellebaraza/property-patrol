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

# ================= app.index.tsx: strip down to to-do-only for finance_admin / marketing_admin =================
patch(
    "src/routes/app.index.tsx",
    '''  const property = myProperties?.[0];
  const propertyName = (id: string) => myProperties?.find((p: any) => p.id === id)?.name ?? "";''',
    '''  const property = myProperties?.[0];
  const propertyName = (id: string) => myProperties?.find((p: any) => p.id === id)?.name ?? "";
  const todoOnly = profile?.role === "finance_admin" || profile?.role === "marketing_admin";''',
    "app.index.tsx todoOnly flag",
)

patch(
    "src/routes/app.index.tsx",
    '''        <h1 className="text-2xl sm:text-3xl font-bold mt-0.5">Today's checklists</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {myProperties && myProperties.length > 0 ? (
            myProperties.length === 1 ? (
              <>Assigned to your <span className="capitalize">{profile?.role}</span> role at <span className="font-medium text-foreground">{myProperties[0].name}</span>.</>
            ) : (
              <>Assigned to your <span className="capitalize">{profile?.role}</span> role across <span className="font-medium text-foreground">{myProperties.length} properties</span>.</>
            )
          ) : "Loading…"}
        </p>''',
    '''        <h1 className="text-2xl sm:text-3xl font-bold mt-0.5">{todoOnly ? "Your daily to-do" : "Today's checklists"}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {todoOnly ? (
            <>Write your plan for the day below.</>
          ) : myProperties && myProperties.length > 0 ? (
            myProperties.length === 1 ? (
              <>Assigned to your <span className="capitalize">{profile?.role}</span> role at <span className="font-medium text-foreground">{myProperties[0].name}</span>.</>
            ) : (
              <>Assigned to your <span className="capitalize">{profile?.role}</span> role across <span className="font-medium text-foreground">{myProperties.length} properties</span>.</>
            )
          ) : "Loading…"}
        </p>''',
    "app.index.tsx header swap",
)

patch(
    "src/routes/app.index.tsx",
    '''      {templates && templates.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            No checklists are assigned to your role yet. Your admin needs to create templates for you.
          </CardContent>
        </Card>
      )}

      <div className="grid sm:grid-cols-2 gap-3 sm:gap-4">
        {templates?.map((t) => {''',
    '''      {!todoOnly && templates && templates.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            No checklists are assigned to your role yet. Your admin needs to create templates for you.
          </CardContent>
        </Card>
      )}

      <div className="grid sm:grid-cols-2 gap-3 sm:gap-4">
        {!todoOnly && templates?.map((t) => {''',
    "app.index.tsx hide templates section for todoOnly",
)

# ================= app.admin.users.tsx: clean "No property" state for finance_admin / marketing_admin =================
patch(
    "src/routes/app.admin.users.tsx",
    '''                  {u.role === "super_admin" || u.role === "operations_admin" ? (
                    <Badge variant="secondary" className="w-44 justify-center h-8">All properties</Badge>
                  ) : u.role === "supervisor" ? (''',
    '''                  {u.role === "super_admin" || u.role === "operations_admin" ? (
                    <Badge variant="secondary" className="w-44 justify-center h-8">All properties</Badge>
                  ) : u.role === "finance_admin" || u.role === "marketing_admin" ? (
                    <Badge variant="secondary" className="w-44 justify-center h-8">No property</Badge>
                  ) : u.role === "supervisor" ? (''',
    "users.tsx finance/marketing no-property badge",
)

print("\\nAll patches applied.")
