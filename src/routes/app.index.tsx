import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useAuth";
import { useProperty } from "@/hooks/useProperty";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, CalendarDays, Wrench, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/app/")({
  component: ChecklistsHome,
});

function ChecklistsHome() {
  const { profile } = useProfile();
  const navigate = useNavigate();
  useEffect(() => {
    if (profile?.role === "admin") {
      navigate({ to: "/app/admin", replace: true });
    }
  }, [profile?.role, navigate]);
  const { data: property } = useProperty(profile?.property_id);

  const { data: templates, isLoading } = useQuery({
    queryKey: ["templates", profile?.property_id, profile?.role],
    enabled: !!profile?.property_id && !!profile?.role,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_templates")
        .select("*")
        .eq("property_id", profile!.property_id!)
        .eq("role_required", profile!.role!)
        .order("cadence")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const today = new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });

  return (
    <div>
      <div className="mb-5 sm:mb-8">
        <div className="text-xs text-muted-foreground">{today}</div>
        <h1 className="text-2xl sm:text-3xl font-bold mt-0.5">Today's checklists</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {property ? <>Assigned to your <span className="capitalize">{profile?.role}</span> role at <span className="font-medium text-foreground">{property.name}</span>.</> : "Loading…"}
        </p>
      </div>

      {isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}
      {templates && templates.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            No checklists are assigned to your role yet. Your admin needs to create templates for you.
          </CardContent>
        </Card>
      )}

      <div className="grid sm:grid-cols-2 gap-3 sm:gap-4">
        {templates?.map((t) => {
          const Icon = t.format === "day_grid" ? CalendarDays : t.format === "fault_log" ? Wrench : ClipboardList;
          return (
            <Link key={t.id} to="/app/checklists/$templateId" params={{ templateId: t.id }}>
              <Card className="hover:border-primary active:scale-[0.99] transition-all cursor-pointer">
                <CardContent className="py-4 flex items-center gap-4">
                  <div className="h-12 w-12 shrink-0 rounded-lg bg-primary/10 text-primary grid place-items-center">
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold truncate">{t.name}</div>
                    <div className="mt-1 flex gap-1.5 flex-wrap">
                      <Badge variant="secondary" className="capitalize text-[10px]">{t.cadence}</Badge>
                      <Badge variant="outline" className="text-[10px]">{t.format.replace("_", " ")}</Badge>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
