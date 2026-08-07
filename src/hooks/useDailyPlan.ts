import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { UserProfile } from "@/hooks/useAuth";

export type DailyPlanStatus = "planned" | "done";

export interface DailyPlan {
  id: string;
  user_id: string;
  property_id: string;
  plan_date: string;
  plan_text: string;
  status: DailyPlanStatus;
  created_at: string;
  updated_at: string;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function useDailyPlan(profile: UserProfile | null) {
  const qc = useQueryClient();
  const [planText, setPlanText] = useState("");
  const dateKey = todayISO();

  const { data: todayPlan, isLoading: todayPlanLoading } = useQuery({
    queryKey: ["daily-plan", profile?.id, dateKey],
    enabled: !!profile?.id,
    queryFn: async (): Promise<DailyPlan | null> => {
      const { data, error } = await supabase
        .from("daily_plans")
        .select("*")
        .eq("user_id", profile!.id)
        .eq("plan_date", dateKey)
        .maybeSingle();
      if (error) throw error;
      return data as DailyPlan | null;
    },
  });

  const savePlan = useMutation({
    mutationFn: async () => {
      if (!profile) throw new Error("Profile not loaded");
      const { error } = await supabase.from("daily_plans").insert({
        user_id: profile.id,
        property_id: profile.property_id ?? null,
        plan_date: dateKey,
        plan_text: planText,
        status: "planned",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["daily-plan", profile?.id, dateKey] });
      setPlanText("");
    },
  });

  const markDone = useMutation({
    mutationFn: async () => {
      if (!todayPlan) throw new Error("No plan to mark done");
      const { error } = await supabase.from("daily_plans").update({ status: "done" }).eq("id", todayPlan.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["daily-plan", profile?.id, dateKey] }),
  });

  return { todayPlan, todayPlanLoading, planText, setPlanText, savePlan, markDone };
}
