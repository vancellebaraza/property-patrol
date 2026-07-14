import { createFileRoute, useNavigate, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useProfile } from "@/hooks/useAuth";
import { useProperty, themeStyle } from "@/hooks/useProperty";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ClipboardCheck, LogOut, Loader2, ShieldAlert, Settings, ClipboardList, Wrench, Building2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, profile, loading } = useProfile();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: property } = useProperty(profile?.property_id);

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

  if (!profile || profile.role === null || profile.property_id === null || !profile.active) {
    return <PendingApproval email={user.email ?? ""} name={profile?.full_name ?? ""} onSignOut={signOut} inactive={profile?.active === false} />;
  }

  const isAdmin = profile.role === "admin";
  const themeColor = property?.theme_color ?? null;

  const staffNav = [
    { to: "/app", label: "Checklists", icon: ClipboardList, match: (p: string) => p === "/app" || p.startsWith("/app/checklists") },
    { to: "/app/faults", label: "Faults", icon: Wrench, match: (p: string) => p.startsWith("/app/faults") },
  ];

  return (
    <div className="min-h-screen bg-muted/20 pb-20 sm:pb-0" style={themeStyle(themeColor)}>
      <header
        className="border-b bg-card sticky top-0 z-30"
        style={themeColor ? { borderTopWidth: 4, borderTopColor: themeColor, borderTopStyle: "solid" } : undefined}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <Link to="/app" className="flex min-w-0 items-center gap-3">
            {property?.logo_url ? (
              <img src={property.logo_url} alt={property.name} className="h-9 w-9 shrink-0 rounded-md object-cover border" />
            ) : (
              <div
                className="h-9 w-9 shrink-0 rounded-md grid place-items-center text-primary-foreground"
                style={{ backgroundColor: themeColor ?? "var(--primary)" }}
              >
                <ClipboardCheck className="h-5 w-5" />
              </div>
            )}
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground leading-none">Property</div>
              <div className="truncate font-bold text-sm sm:text-base leading-tight">
                {property?.name ?? "OpsCheck"}
              </div>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden sm:flex items-center gap-1">
            {staffNav.map((n) => (
              <NavLink key={n.to} to={n.to} active={n.match(pathname)}>{n.label}</NavLink>
            ))}
            {isAdmin && (
              <NavLink to="/app/admin" active={pathname.startsWith("/app/admin")}>
                <Settings className="h-4 w-4 mr-1 inline" />Admin
              </NavLink>
            )}
            <div className="ml-2 pl-2 border-l flex items-center gap-2">
              <div className="text-xs text-muted-foreground max-w-40 truncate">
                {profile.full_name || profile.email} · <span className="capitalize">{profile.role}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={signOut} aria-label="Sign out"><LogOut className="h-4 w-4" /></Button>
            </div>
          </nav>

          {/* Mobile: role chip + signout */}
          <div className="sm:hidden flex items-center gap-2">
            <span className="text-[10px] uppercase font-semibold px-2 py-1 rounded bg-muted text-muted-foreground">
              {profile.role}
            </span>
            <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out"><LogOut className="h-4 w-4" /></Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-8">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-card border-t grid grid-cols-3">
        {staffNav.map((n) => {
          const active = n.match(pathname);
          const Icon = n.icon;
          return (
            <Link
              key={n.to}
              to={n.to}
              className="py-2.5 flex flex-col items-center gap-0.5 text-[11px] font-medium"
              style={active ? { color: themeColor ?? "var(--primary)" } : { color: "hsl(0 0% 45%)" }}
            >
              <Icon className="h-5 w-5" />
              {n.label}
            </Link>
          );
        })}
        <Link
          to={isAdmin ? "/app/admin" : "/app"}
          onClick={(e) => { if (!isAdmin) e.preventDefault(); }}
          className={`py-2.5 flex flex-col items-center gap-0.5 text-[11px] font-medium ${!isAdmin ? "opacity-30 pointer-events-none" : ""}`}
          style={pathname.startsWith("/app/admin") ? { color: themeColor ?? "var(--primary)" } : { color: "hsl(0 0% 45%)" }}
        >
          {isAdmin ? <Settings className="h-5 w-5" /> : <Building2 className="h-5 w-5" />}
          {isAdmin ? "Admin" : "—"}
        </Link>
      </nav>
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
