import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, isAdminRole } from "@/hooks/useAuth";
import { useProperty } from "@/hooks/useProperty";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ClipboardList, CalendarDays, Wrench, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/app/")({
  component: ChecklistsHome,
});

function ChecklistsHome() {
  const { profile } = useProfile();
  const navigate = useNavigate();
  useEffect(() => {
    if (isAdminRole(profile?.role)) {
      navigate({ to: "/app/admin", replace: true });
    }
  }, [profile?.role, navigate]);
  const { data: property } = useProperty(profile?.property_id);

  const { data: templates, isLoading } = useQuery({
    queryKey: ["templates", profile?.property_id, profile?.role],
    enabled: !!profile?.property_id && !!profile?.role && !isAdminRole(profile.role),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_templates")
        .select("*")
        .eq("property_id", profile!.property_id!)
        .eq("role_required", profile!.role! as "supervisor" | "caretaker" | "site_rep")
        .order("cadence")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const today = new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  const todayISO = new Date().toISOString().slice(0, 10);
  const qc = useQueryClient();
  const [planText, setPlanText] = useState("");

  const { data: todayPlan, isLoading: todayPlanLoading } = useQuery({
    queryKey: ["daily-plan", profile?.id, todayISO],
    enabled: !!profile?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_plans")
        .select("*")
        .eq("user_id", profile!.id)
        .eq("plan_date", todayISO)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const savePlan = useMutation({
    mutationFn: async () => {
      if (!profile) throw new Error("Profile not loaded");
      if (!profile.property_id) throw new Error("Property not assigned");
      const { error } = await supabase.from("daily_plans").insert({
        user_id: profile.id,
        property_id: profile.property_id,
        plan_date: todayISO,
        plan_text: planText,
        status: "planned",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["daily-plan", profile?.id, todayISO] });
      setPlanText("");
    },
  });

  const markDone = useMutation({
    mutationFn: async () => {
      if (!todayPlan) throw new Error("No plan available");
      const { error } = await supabase
        .from("daily_plans")
        .update({ status: "done" })
        .eq("id", todayPlan.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["daily-plan", profile?.id, todayISO] }),
  });

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

      <Card>
        <CardContent className="space-y-4">
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Today's Plan</div>
            <h2 className="text-lg font-semibold">Plan for today</h2>
          </div>

          {todayPlanLoading ? (
            <p className="text-sm text-muted-foreground">Loading plan…</p>
          ) : todayPlan ? (
            <div className="space-y-3">
              <div className="rounded-md border border-input bg-background p-4 text-sm whitespace-pre-wrap">{todayPlan.plan_text}</div>
              {todayPlan.status === "planned" ? (
                <Button type="button" onClick={() => markDone.mutate()} disabled={markDone.isPending}>
                  Mark as done
                </Button>
              ) : (
                <Badge className="bg-success text-success-foreground">Done</Badge>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <Textarea
                value={planText}
                onChange={(event) => setPlanText(event.target.value)}
                placeholder="Write your plan for today…"
                rows={5}
              />
              <Button onClick={() => savePlan.mutate()} disabled={!planText.trim() || savePlan.isPending}>
                Save plan
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

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
