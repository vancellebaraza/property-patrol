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

# ================= styles.css: more vivid green/red =================
patch(
    "src/styles.css",
    "  --destructive: oklch(0.60 0.22 27);",
    "  --destructive: oklch(0.55 0.26 27);",
    "styles.css light destructive",
)
patch(
    "src/styles.css",
    "  --success: oklch(0.68 0.16 150);",
    "  --success: oklch(0.60 0.21 150);",
    "styles.css success",
)
patch(
    "src/styles.css",
    "  --destructive: oklch(0.72 0.17 24);",
    "  --destructive: oklch(0.68 0.23 24);",
    "styles.css dark destructive",
)

# ================= app.admin.board.tsx =================

patch(
    "src/routes/app.admin.board.tsx",
    '''  function cellStatus(propertyId: string, userId: string, date: string): CellStatus {
    const dayMap = submissionsByPropertyUserDay.get(propertyId)?.get(userId);
    const subs = dayMap?.get(date);
    if (!subs || subs.length === 0) return "none";
    if (subs.some((s: any) => s.status === "submitted")) return "submitted";
    return "in_progress";
  }''',
    '''  function cellStatus(propertyId: string, userId: string, date: string): CellStatus {
    const dayMap = submissionsByPropertyUserDay.get(propertyId)?.get(userId);
    const subs = dayMap?.get(date);
    if (subs && subs.some((s: any) => s.status === "submitted")) return "submitted";
    return "none";
  }''',
    "board.tsx cellStatus 2-state",
)

patch(
    "src/routes/app.admin.board.tsx",
    '''    let submitted = 0;
    let inProgress = 0;
    let none = 0;

    for (const user of staff) {
      const status = cellStatus(propertyId, user.id, date);
      if (status === "submitted") submitted++;
      else if (status === "in_progress") inProgress++;
      else none++;
    }

    const state = submitted === staff.length ? "green" : submitted > 0 || inProgress > 0 ? "amber" : "red";
    return { total: staff.length, submitted, in_progress: inProgress, none, state };''',
    '''    let submitted = 0;
    let none = 0;

    for (const user of staff) {
      const status = cellStatus(propertyId, user.id, date);
      if (status === "submitted") submitted++;
      else none++;
    }

    const state = submitted === staff.length ? "green" : "red";
    return { total: staff.length, submitted, in_progress: 0, none, state };''',
    "board.tsx getPropertyDayMetrics 2-state",
)

patch(
    "src/routes/app.admin.board.tsx",
    '''  const summary = useMemo(() => {
    let submitted = 0;
    let inProg = 0;
    let none = 0;

    for (const property of properties ?? []) {
      for (const date of dayKeys) {
        const metrics = getPropertyDayMetrics(property.id, date);
        submitted += metrics.submitted;
        inProg += metrics.in_progress;
        none += metrics.none;
      }
    }

    return { submitted, inProg, none };
  }, [properties, staffByProperty, submissionsByPropertyUserDay, dayKeys]);''',
    '''  const summary = useMemo(() => {
    let submitted = 0;
    let none = 0;

    for (const property of properties ?? []) {
      for (const date of dayKeys) {
        const metrics = getPropertyDayMetrics(property.id, date);
        submitted += metrics.submitted;
        none += metrics.none;
      }
    }

    return { submitted, none };
  }, [properties, staffByProperty, submissionsByPropertyUserDay, dayKeys]);''',
    "board.tsx summary 2-state",
)

patch(
    "src/routes/app.admin.board.tsx",
    '''        <StatCard label="Submitted" value={summary.submitted} tone="success" icon={<CheckCircle2 className="h-4 w-4" />} />
        <StatCard label="In progress" value={summary.inProg} tone="warning" icon={<Circle className="h-4 w-4" />} />
        <StatCard label="No entry" value={summary.none} tone="destructive" icon={<XCircle className="h-4 w-4" />} />''',
    '''        <StatCard label="Done" value={summary.submitted} tone="success" icon={<CheckCircle2 className="h-4 w-4" />} />
        <StatCard label="Not done" value={summary.none} tone="destructive" icon={<XCircle className="h-4 w-4" />} />''',
    "board.tsx summary cards 2-state",
)

patch(
    "src/routes/app.admin.board.tsx",
    '''                      const pillClass =
                        metrics.state === "green" ? "bg-success/15 text-success border border-success/30 hover:bg-success/20" :
                        metrics.state === "amber" ? "bg-warning/20 text-warning-foreground border border-warning/30 hover:bg-warning/30" :
                        metrics.state === "red" ? "bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20" :
                        "bg-muted text-muted-foreground border border-transparent hover:bg-muted/80";''',
    '''                      const pillClass =
                        metrics.state === "green" ? "bg-success/15 text-success border border-success/30 hover:bg-success/20" :
                        metrics.state === "red" ? "bg-destructive/15 text-destructive border border-destructive/30 hover:bg-destructive/20" :
                        "bg-muted text-muted-foreground border border-transparent hover:bg-muted/80";''',
    "board.tsx grid pill 2-state",
)

patch(
    "src/routes/app.admin.board.tsx",
    '''              const userStatus = statusByUser?.[user.id] ?? "none";
              const label = userStatus === "submitted" ? "Submitted" : userStatus === "in_progress" ? "In progress" : "No entry";
              const badgeClass =
                userStatus === "submitted" ? "bg-success text-success-foreground" :
                userStatus === "in_progress" ? "bg-warning text-warning-foreground" :
                "bg-muted text-muted-foreground";''',
    '''              const userStatus = statusByUser?.[user.id] ?? "none";
              const label = userStatus === "submitted" ? "Done" : "Not done";
              const badgeClass =
                userStatus === "submitted" ? "bg-success text-success-foreground" :
                "bg-destructive text-destructive-foreground";''',
    "board.tsx PropertyDayDrawer badge 2-state",
)

patch(
    "src/routes/app.admin.board.tsx",
    '''                  {s.status === "submitted" ? (
                    <Badge className="bg-success text-success-foreground">Submitted {s.submitted_at && new Date(s.submitted_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Badge>
                  ) : (
                    <Badge className="bg-warning text-warning-foreground">In progress</Badge>
                  )}''',
    '''                  {s.status === "submitted" ? (
                    <Badge className="bg-success text-success-foreground">Done {s.submitted_at && new Date(s.submitted_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Badge>
                  ) : (
                    <Badge className="bg-destructive text-destructive-foreground">Not done</Badge>
                  )}''',
    "board.tsx DayDetailDrawer submission badge 2-state",
)

patch(
    "src/routes/app.admin.board.tsx",
    '''function StatusDot({ status }: { status: string }) {
  const cls =
    status === "done" || status === "submitted" ? "bg-success" :
    status === "not_done" || status === "in_progress" ? "bg-warning" :
    "bg-muted-foreground";
  return <div className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${cls}`} />;
}''',
    '''function StatusDot({ status }: { status: string }) {
  const cls = status === "done" || status === "submitted" ? "bg-success" : "bg-destructive";
  return <div className={`h-2.5 w-2.5 rounded-full mt-1 shrink-0 ${cls}`} />;
}''',
    "board.tsx StatusDot fixed + 2-state + bigger/more visible",
)

# ================= app.checklists.$templateId.tsx =================

patch(
    "src/routes/app.checklists.$templateId.tsx",
    'type EntryStatus = "done" | "not_done" | "na";',
    'type EntryStatus = "done" | "not_done";',
    "checklists type EntryStatus 2-state",
)

patch(
    "src/routes/app.checklists.$templateId.tsx",
    '''          <BigStatusBtn active={status === "done"} onClick={() => setStatus("done")} disabled={disabled} tone="success" label="Done"><Check className="h-5 w-5" /></BigStatusBtn>
          <BigStatusBtn active={status === "not_done"} onClick={() => setStatus("not_done")} disabled={disabled} tone="destructive" label="Not done"><X className="h-5 w-5" /></BigStatusBtn>
          <BigStatusBtn active={status === "na"} onClick={() => setStatus("na")} disabled={disabled} tone="muted" label="N/A"><Minus className="h-5 w-5" /></BigStatusBtn>''',
    '''          <BigStatusBtn active={status === "done"} onClick={() => setStatus("done")} disabled={disabled} tone="success" label="Done"><Check className="h-5 w-5" /></BigStatusBtn>
          <BigStatusBtn active={status === "not_done"} onClick={() => setStatus("not_done")} disabled={disabled} tone="destructive" label="Not done"><X className="h-5 w-5" /></BigStatusBtn>''',
    "checklists remove N/A big button",
)

patch(
    "src/routes/app.checklists.$templateId.tsx",
    '''    const next: EntryStatus = cur === null ? "done" : cur === "done" ? "not_done" : cur === "not_done" ? "na" : "done";''',
    '''    const next: EntryStatus = cur === "done" ? "not_done" : "done";''',
    "checklists cycle 2-state",
)

patch(
    "src/routes/app.checklists.$templateId.tsx",
    '''        const bg =
          status === "done" ? "bg-success text-success-foreground border-success" :
          status === "not_done" ? "bg-destructive text-destructive-foreground border-destructive" :
          status === "na" ? "bg-muted-foreground/20 border-muted-foreground/30" :
          "bg-background border-border hover:bg-muted";''',
    '''        const bg =
          status === "done" ? "bg-success text-success-foreground border-success" :
          status === "not_done" ? "bg-destructive text-destructive-foreground border-destructive" :
          "bg-background border-border hover:bg-muted";''',
    "checklists compact grid bg 2-state",
)

patch(
    "src/routes/app.checklists.$templateId.tsx",
    '''              {status === "done" ? "✓" : status === "not_done" ? "✗" : status === "na" ? "—" : ""}''',
    '''              {status === "done" ? "\u2713" : status === "not_done" ? "\u2717" : ""}''',
    "checklists compact grid symbol 2-state",
)

print("\\nAll patches applied.")
