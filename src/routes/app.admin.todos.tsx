import { useProfile, writesOwnPlan } from "@/hooks/useAuth";
import { useDailyPlan } from "@/hooks/useDailyPlan";
import { Textarea } from "@/components/ui/textarea";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAllProperties } from "@/hooks/useProperty";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/app/admin/todos")({
  component: AdminTodosPage,
});

function startOfWeek(d: Date) {
  const nd = new Date(d);
  const day = nd.getDay();
  const offset = (day + 6) % 7; // Monday start
  nd.setDate(nd.getDate() - offset);
  nd.setHours(0, 0, 0, 0);
  return nd;
}

function fmtISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number) {
  const nd = new Date(d);
  nd.setDate(nd.getDate() + n);
  return nd;
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type PlanStatus = "planned" | "done";

type DailyPlanRow = {
  id: string;
  user_id: string;
  property_id: string;
  plan_date: string;
  plan_text: string;
  status: PlanStatus;
  created_at: string;
  updated_at: string;
  user_profiles?: {
    id: string;
    full_name: string;
    property_id: string | null;
  };
  properties?: {
    id: string;
    name: string;
  };
};

type StaffMember = {
  id: string;
  full_name: string;
  email: string;
  role: string | null;
  property_id: string | null;
};

export default function AdminTodosPage() {
  const { data: properties } = useAllProperties();
  const { profile } = useProfile();
  const showOwnPlan = writesOwnPlan(profile?.role);
  const { todayPlan, todayPlanLoading, planText, setPlanText, savePlan, markDone } = useDailyPlan(profile);
  const [selectedProperty, setSelectedProperty] = useState<string>("all");
  const [selectedPlan, setSelectedPlan] = useState<DailyPlanRow | null>(null);

  const weekStart = startOfWeek(new Date());
  const weekEnd = addDays(weekStart, 6);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const dayKeys = useMemo(() => days.map((d) => fmtISO(d)), [days]);

  const { data: staff, isLoading: staffLoading } = useQuery({
    queryKey: ["todo-staff"],
    queryFn: async (): Promise<StaffMember[]> => {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("id, full_name, email, role, property_id")
        .eq("active", true)
        .neq("role", "super_admin")
        .order("full_name");
      if (error) throw error;
      return (data ?? []) as StaffMember[];
    },
  });

  const { data: plans, isLoading: plansLoading } = useQuery({
    queryKey: ["daily-plans-week", fmtISO(weekStart)],
    queryFn: async (): Promise<DailyPlanRow[]> => {
      const { data, error } = await supabase
        .from("daily_plans")
        .select("*, user_profiles(id, full_name, property_id), properties(id, name)")
        .gte("plan_date", fmtISO(weekStart))
        .lte("plan_date", fmtISO(weekEnd));
      if (error) throw error;
      return (data ?? []) as DailyPlanRow[];
    },
  });

  const filteredStaff = useMemo(
    () => (staff ?? []).filter((user) => selectedProperty === "all" || user.property_id === selectedProperty),
    [staff, selectedProperty],
  );

  const planMap = useMemo(() => {
    const map = new Map<string, Map<string, DailyPlanRow>>();
    for (const plan of plans ?? []) {
      const userPlans = map.get(plan.user_id) ?? new Map<string, DailyPlanRow>();
      userPlans.set(plan.plan_date, plan);
      map.set(plan.user_id, userPlans);
    }
    return map;
  }, [plans]);

  const isLoading = staffLoading || plansLoading;

  return (
    <div>
      <div className="mb-5 sm:mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs text-muted-foreground">Week of {weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</div>
          <h1 className="text-2xl sm:text-3xl font-bold mt-0.5">Daily To-Dos</h1>
          <p className="text-muted-foreground text-sm mt-1">Review staff daily plans and status for the current week.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select value={selectedProperty} onValueChange={setSelectedProperty}>
            <SelectTrigger className="w-56 h-9"><SelectValue placeholder="All properties" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All properties</SelectItem>
              {properties?.map((property) => (
                <SelectItem key={property.id} value={property.id}>
                  {property.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="text-sm text-muted-foreground">Showing {filteredStaff.length} staff</div>
        </div>
      </div>

      {showOwnPlan && (
        <Card className="mb-5 sm:mb-8">
          <CardContent className="space-y-3 py-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Your plan for today</div>
            {todayPlanLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
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
                <Textarea value={planText} onChange={(e) => setPlanText(e.target.value)} placeholder="Write your plan for today…" rows={4} />
                <Button onClick={() => savePlan.mutate()} disabled={!planText.trim() || savePlan.isPending}>
                  Save plan
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <div className="grid place-items-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && filteredStaff.length === 0 && (
        <p className="text-sm text-muted-foreground">No staff found for this filter.</p>
      )}

      {!isLoading && filteredStaff.length > 0 && (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-3 py-2 font-semibold sticky left-0 bg-muted/40 z-10 min-w-48">Staff</th>
                  {days.map((day, index) => {
                    const isToday = fmtISO(day) === fmtISO(new Date());
                    return (
                      <th key={index} className={`px-2 py-2 font-medium text-center min-w-20 ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                        <div className="text-[10px] uppercase">{DAY_LABELS[index]}</div>
                        <div className="text-xs">{day.getDate()}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {filteredStaff.map((user) => (
                  <tr key={user.id} className="border-b hover:bg-muted/30">
                    <td className="px-3 py-2 sticky left-0 bg-card z-10">
                      <div className="font-medium text-sm truncate max-w-48">{user.full_name || user.email}</div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{user.role ?? "Staff"}</div>
                    </td>
                    {dayKeys.map((dayKey) => {
                      const plan = planMap.get(user.id)?.get(dayKey);
                      const isDone = plan?.status === "done";
                      const isPlanned = plan?.status === "planned";
                      const pillClass = isDone
                        ? "bg-success/10 text-success border border-success/20 hover:bg-success/20"
                        : isPlanned
                        ? "bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20"
                        : "bg-muted/10 text-muted-foreground border border-muted/20";
                      const displayText = plan ? (isDone ? "Done" : "Planned") : "—";

                      return (
                        <td key={dayKey} className="px-2 py-2 text-center">
                          {plan ? (
                            <button
                              type="button"
                              onClick={() => setSelectedPlan(plan)}
                              className={`min-w-[4.5rem] h-8 rounded-full px-3 text-xs font-semibold ${pillClass} transition`}
                            >
                              {displayText}
                            </button>
                          ) : (
                            <div className={`min-w-[4.5rem] h-8 inline-flex items-center justify-center rounded-full px-3 text-xs font-semibold ${pillClass}`}>
                              {displayText}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <Sheet open={!!selectedPlan} onOpenChange={(open) => !open && setSelectedPlan(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{selectedPlan?.user_profiles?.full_name ?? selectedPlan?.id}</SheetTitle>
            <SheetDescription>
              {selectedPlan && new Date(selectedPlan.plan_date).toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </SheetDescription>
          </SheetHeader>

          {selectedPlan && (
            <div className="space-y-4 mt-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={selectedPlan.status === "done" ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground"}>
                  {selectedPlan.status === "done" ? "Done" : "Planned"}
                </Badge>
                <div className="text-sm text-muted-foreground">
                  {selectedPlan.properties?.name ?? "Unknown property"}
                </div>
              </div>
              <div className="rounded-lg border border-muted/50 bg-muted/5 p-4 text-sm whitespace-pre-wrap">
                {selectedPlan.plan_text}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
