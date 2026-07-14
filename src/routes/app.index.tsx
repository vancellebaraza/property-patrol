import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/app/")({
  component: ChecklistsHome,
});

function ChecklistsHome() {
  const { profile } = useProfile();

  const { data: templates, isLoading } = useQuery({
    queryKey: ["templates", profile?.property_id, profile?.role],
    enabled: !!profile?.property_id && !!profile?.role,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_templates")
        .select("*")
        .order("cadence")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Your checklists</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Templates assigned to your role for this property.
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

      <div className="grid md:grid-cols-2 gap-4">
        {templates?.map((t) => (
          <Link key={t.id} to="/app/checklists/$templateId" params={{ templateId: t.id }}>
            <Card className="hover:border-primary transition-colors cursor-pointer">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                      <ClipboardList className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{t.name}</CardTitle>
                      <CardDescription className="mt-1 flex gap-2">
                        <Badge variant="secondary" className="capitalize">{t.cadence}</Badge>
                        <Badge variant="outline">{t.format.replace("_", " ")}</Badge>
                      </CardDescription>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
