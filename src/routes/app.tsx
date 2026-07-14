import { createFileRoute, useNavigate, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useProfile } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ClipboardCheck, LogOut, Loader2, ShieldAlert, Settings } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, profile, loading } = useProfile();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Pending approval: role or property not assigned
  if (!profile || profile.role === null || profile.property_id === null || !profile.active) {
    return <PendingApproval email={user.email ?? ""} name={profile?.full_name ?? ""} onSignOut={signOut} inactive={profile?.active === false} />;
  }

  const isAdmin = profile.role === "admin";

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link to="/app" className="flex items-center gap-2 text-primary">
            <ClipboardCheck className="h-5 w-5" />
            <span className="font-bold">OpsCheck</span>
          </Link>
          <nav className="flex items-center gap-1">
            <NavLink to="/app" active={pathname === "/app"}>Checklists</NavLink>
            <NavLink to="/app/faults" active={pathname.startsWith("/app/faults")}>Faults</NavLink>
            {isAdmin && (
              <NavLink to="/app/admin" active={pathname.startsWith("/app/admin")}>
                <Settings className="h-4 w-4 mr-1 inline" />Admin
              </NavLink>
            )}
            <div className="ml-3 pl-3 border-l flex items-center gap-2">
              <div className="text-sm text-muted-foreground hidden sm:block">
                {profile.full_name || profile.email} · <span className="capitalize">{profile.role}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="h-4 w-4" /></Button>
            </div>
          </nav>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}

function NavLink({ to, active, children }: { to: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className={`px-3 py-2 rounded-md text-sm font-medium ${active ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"}`}
    >
      {children}
    </Link>
  );
}

function PendingApproval({ email, name, onSignOut, inactive }: { email: string; name: string; onSignOut: () => void; inactive?: boolean }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <div className="max-w-md w-full text-center bg-card border rounded-lg p-8">
        <div className="mx-auto h-12 w-12 rounded-full bg-warning/20 text-warning-foreground flex items-center justify-center">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-xl font-semibold">
          {inactive ? "Account deactivated" : "Pending approval"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {inactive
            ? "This account has been deactivated by an administrator. Contact your admin for access."
            : "Waiting for an admin to assign your role and property. You'll get access as soon as they do."}
        </p>
        <div className="mt-6 text-sm text-muted-foreground border-t pt-4">
          Signed in as <span className="text-foreground font-medium">{name || email}</span>
        </div>
        <Button variant="outline" className="mt-4" onClick={onSignOut}>
          <LogOut className="h-4 w-4 mr-2" />Sign out
        </Button>
      </div>
    </div>
  );
}
