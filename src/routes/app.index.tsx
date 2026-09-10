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
import { Switch } from "@/components/ui/switch";
import { ClipboardList, CalendarDays, Wrench, ChevronRight, Pencil } from "lucide-react";
import { toast } from "sonner";

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
  // RLS already scopes this to every property the user can act on (one for caretaker/site_rep,
  // possibly several for a supervisor) — no manual property_id filter needed here.
  const { data: myProperties } = useQuery({
    queryKey: ["my-properties", profile?.id],
    enabled: !!profile?.id && !isAdminRole(profile?.role),
    queryFn: async () => {
      const { data, error } = await supabase.from("properties").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });
  const property = myProperties?.[0];
  const propertyName = (id: string) => myProperties?.find((p: any) => p.id === id)?.name ?? "";
  const todoOnly = [
    "finance_admin",
    "marketing_admin",
    "finance_staff",
    "marketing_staff",
  ].includes(profile?.role ?? "");

  const { data: templates, isLoading } = useQuery({
    queryKey: ["templates", profile?.id, profile?.role],
    enabled: !!profile?.id && !!profile?.role && !isAdminRole(profile.role),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_templates")
        .select("*")
        .eq("role_required", profile!.role! as "supervisor" | "caretaker" | "site_rep")
        .order("cadence")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  const todayISO = new Date().toISOString().slice(0, 10);

  function nextWorkdayISO(from) {
    const d = new Date(from);
    d.setDate(d.getDate() + 1);
    while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }
  const nextWorkISO = nextWorkdayISO(new Date());
  const nextWorkLabel = new Date(nextWorkISO + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  const qc = useQueryClient();
  const [achievementText, setAchievementText] = useState("");
  const [editingAchievement, setEditingAchievement] = useState(false);
  const [nextPlanText, setNextPlanText] = useState("");
  const [editingNextPlan, setEditingNextPlan] = useState(false);

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

  const saveAchievement = useMutation({
    mutationFn: async () => {
      if (!profile) throw new Error("Profile not loaded");
      const { error } = await supabase.from("daily_plans").upsert(
        {
          user_id: profile.id,
          property_id: profile.property_id ?? myProperties?.[0]?.id ?? null,
          plan_date: todayISO,
          plan_text: todayPlan?.plan_text ?? "",
          achievement_text: achievementText,
          status: todayPlan?.status ?? "planned",
        },
        { onConflict: "user_id,plan_date" }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["daily-plan", profile?.id, todayISO] });
      setEditingAchievement(false);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Could not save your update.");
    },
  });

  const toggleDone = useMutation({
    mutationFn: async () => {
      if (!profile) throw new Error("Profile not loaded");
      const nextStatus = todayPlan && todayPlan.status === "done" ? "planned" : "done";
      const { error } = await supabase.from("daily_plans").upsert(
        {
          user_id: profile.id,
          property_id: profile.property_id ?? myProperties?.[0]?.id ?? null,
          plan_date: todayISO,
          plan_text: todayPlan ? todayPlan.plan_text : "",
          achievement_text: todayPlan ? todayPlan.achievement_text : null,
          status: nextStatus,
        },
        { onConflict: "user_id,plan_date" }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["daily-plan", profile?.id, todayISO] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Could not update status.");
    },
  });

  const { data: nextPlan, isLoading: nextPlanLoading } = useQuery({
    queryKey: ["daily-plan", profile?.id, nextWorkISO],
    enabled: !!profile?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_plans")
        .select("*")
        .eq("user_id", profile.id)
        .eq("plan_date", nextWorkISO)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const saveNextPlan = useMutation({
    mutationFn: async () => {
      if (!profile) throw new Error("Profile not loaded");
      const { error } = await supabase.from("daily_plans").upsert(
        {
          user_id: profile.id,
          property_id: profile.property_id ?? myProperties?.[0]?.id ?? null,
          plan_date: nextWorkISO,
          plan_text: nextPlanText,
          achievement_text: nextPlan?.achievement_text ?? null,
          status: nextPlan?.status ?? "planned",
        },
        { onConflict: "user_id,plan_date" }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["daily-plan", profile?.id, nextWorkISO] });
      setEditingNextPlan(false);
      setNextPlanText("");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Could not save your plan.");
    },
  });

  return (
    <div>
      <div className="mb-5 sm:mb-8">
        <div className="text-xs text-muted-foreground">{today}</div>
        <h1 className="text-2xl sm:text-3xl font-bold mt-0.5">
          {todoOnly ? "Your daily to-do" : "Today's checklists"}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {todoOnly ? (
            <>Write your plan for the day below.</>
          ) : myProperties && myProperties.length > 0 ? (
            myProperties.length === 1 ? (
              <>
                Assigned to your <span className="capitalize">{profile?.role}</span> role at{" "}
                <span className="font-medium text-foreground">{myProperties[0].name}</span>.
              </>
            ) : (
              <>
                Assigned to your <span className="capitalize">{profile?.role}</span> role across{" "}
                <span className="font-medium text-foreground">
                  {myProperties.length} properties
                </span>
                .
              </>
            )
          ) : (
            "Loading…"
          )}
        </p>
      </div>

      {isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}

      <Card>
        <CardContent className="space-y-4">
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider">
              Today's Achievement
            </div>
            <h2 className="text-lg font-semibold">What did you get done today?</h2>
          </div>

          <div className="flex items-center gap-3">
            <Switch
              checked={!!todayPlan && todayPlan.status === "done"}
              onCheckedChange={() => toggleDone.mutate()}
              disabled={toggleDone.isPending}
            />
            <span className="text-sm font-medium">
              {todayPlan && todayPlan.status === "done" ? "Done" : "Not done"}
            </span>
          </div>
          {todayPlanLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : editingAchievement ? (
            <div className="space-y-3">
              <Textarea
                value={achievementText}
                onChange={(event) => setAchievementText(event.target.value)}
                placeholder="What did you achieve today…"
                rows={4}
              />
              <div className="flex gap-2">
                <Button
                  onClick={() => saveAchievement.mutate()}
                  disabled={!achievementText.trim() || saveAchievement.isPending}
                >
                  Save
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditingAchievement(false);
                    setAchievementText("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : todayPlan && todayPlan.achievement_text ? (
            <div className="space-y-3">
              <div className="rounded-md border border-input bg-background p-4 text-sm whitespace-pre-wrap">
                {todayPlan.achievement_text}
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setAchievementText(todayPlan.achievement_text || "");
                  setEditingAchievement(true);
                }}
              >
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setAchievementText("");
                setEditingAchievement(true);
              }}
            >
              Add today's achievement
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4">
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider">
              Plan Ahead
            </div>
            <h2 className="text-lg font-semibold">Plan for {nextWorkLabel}</h2>
          </div>

          {nextPlanLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : nextPlan ? (
            editingNextPlan ? (
              <div className="space-y-3">
                <Textarea
                  value={nextPlanText}
                  onChange={(event) => setNextPlanText(event.target.value)}
                  rows={5}
                />
                <div className="flex gap-2">
                  <Button
                    onClick={() => saveNextPlan.mutate()}
                    disabled={!nextPlanText.trim() || saveNextPlan.isPending}
                  >
                    Save changes
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditingNextPlan(false);
                      setNextPlanText("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-md border border-input bg-background p-4 text-sm whitespace-pre-wrap">
                  {nextPlan.plan_text}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setNextPlanText(nextPlan.plan_text);
                    setEditingNextPlan(true);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                  Edit plan
                </Button>
              </div>
            )
          ) : (
            <div className="space-y-3">
              <Textarea
                value={nextPlanText}
                onChange={(event) => setNextPlanText(event.target.value)}
                placeholder={"Write your plan for " + nextWorkLabel + "…"}
                rows={5}
              />
              <Button
                onClick={() => saveNextPlan.mutate()}
                disabled={!nextPlanText.trim() || saveNextPlan.isPending}
              >
                Save plan
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {!todoOnly && templates && templates.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            No checklists are assigned to your role yet. Your admin needs to create templates for
            you.
          </CardContent>
        </Card>
      )}

      <div className="grid sm:grid-cols-2 gap-3 sm:gap-4">
        {!todoOnly &&
          templates?.map((t) => {
            const Icon =
              t.format === "day_grid"
                ? CalendarDays
                : t.format === "fault_log"
                  ? Wrench
                  : ClipboardList;
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
                        {myProperties && myProperties.length > 1 && (
                          <Badge className="text-[10px]">{propertyName(t.property_id)}</Badge>
                        )}
                        <Badge variant="secondary" className="capitalize text-[10px]">
                          {t.cadence}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          {t.format.replace("_", " ")}
                        </Badge>
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
