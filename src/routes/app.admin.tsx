import { createFileRoute, Outlet, Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useProfile } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/app/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const { profile, loading } = useProfile();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && profile?.role !== "admin") navigate({ to: "/app" });
  }, [loading, profile, navigate]);

  if (loading || profile?.role !== "admin") {
    return <Loader2 className="animate-spin" />;
  }

  const tabs = [
    { to: "/app/admin", label: "Pending", exact: true },
    { to: "/app/admin/board", label: "Board" },
    { to: "/app/admin/faults", label: "Faults" },
    { to: "/app/admin/users", label: "Users" },
    { to: "/app/admin/properties", label: "Properties" },
    { to: "/app/admin/templates", label: "Templates" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Admin</h1>
      <div className="border-b mb-6 flex gap-1 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        {tabs.map((t) => {
          const active = t.exact ? pathname === t.to : pathname.startsWith(t.to);
          return (
            <Link
              key={t.to}
              to={t.to}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
      <Outlet />
    </div>
  );
}
