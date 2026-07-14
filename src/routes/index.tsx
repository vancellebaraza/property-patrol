import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ClipboardCheck, ShieldCheck, ClipboardList, Wrench } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-primary">
            <ClipboardCheck className="h-6 w-6" />
            <span className="text-xl font-bold">OpsCheck</span>
          </div>
          <Link to="/auth"><Button>Sign in</Button></Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6">
        <section className="py-20 text-center">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground max-w-3xl mx-auto">
            Property operations, checklisted.
          </h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Daily, weekly, and monthly checklists with immutable audit logs, fault reporting,
            and role-based access for every property in your portfolio.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link to="/auth"><Button size="lg">Get started</Button></Link>
          </div>
        </section>

        <section className="grid md:grid-cols-3 gap-6 pb-20">
          <Feature icon={<ClipboardList className="h-5 w-5" />} title="Structured checklists" desc="Templates per property with categories, sub-items, and multiple cadences." />
          <Feature icon={<Wrench className="h-5 w-5" />} title="Fault logs" desc="Log broken equipment inline and track it from reported to repaired." />
          <Feature icon={<ShieldCheck className="h-5 w-5" />} title="Audit-safe" desc="Entries are insert-only and stamped server-side. No backdating." />
        </section>
      </main>
    </div>
  );
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="h-9 w-9 rounded-md bg-primary/10 text-primary flex items-center justify-center">{icon}</div>
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}
