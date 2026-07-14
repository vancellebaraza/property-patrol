import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/app/admin/properties")({
  component: PropertiesPage,
});

function PropertiesPage() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [color, setColor] = useState("#0ea5e9");
  const [logo, setLogo] = useState("");

  const { data: properties } = useQuery({
    queryKey: ["properties-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("properties").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("properties").insert({
        name, slug, theme_color: color, logo_url: logo || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Property created");
      setName(""); setSlug(""); setLogo("");
      qc.invalidateQueries({ queryKey: ["properties-all"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: any }) => {
      const { error } = await supabase.from("properties").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["properties-all"] }),
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <Card className="md:col-span-1">
        <CardHeader><CardTitle className="text-base">New property</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label>Slug</Label><Input value={slug} onChange={(e) => setSlug(e.target.value)} /></div>
          <div><Label>Theme color</Label><Input type="color" value={color} onChange={(e) => setColor(e.target.value)} /></div>
          <div><Label>Logo URL</Label><Input value={logo} onChange={(e) => setLogo(e.target.value)} /></div>
          <Button className="w-full" onClick={() => create.mutate()} disabled={!name || !slug || create.isPending}>Create</Button>
        </CardContent>
      </Card>
      <div className="md:col-span-2 space-y-3">
        {properties?.map((p: any) => (
          <Card key={p.id}>
            <CardContent className="py-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded" style={{ backgroundColor: p.theme_color }} />
              <div className="flex-1">
                <Input defaultValue={p.name} onBlur={(e) => e.target.value !== p.name && update.mutate({ id: p.id, patch: { name: e.target.value } })} />
                <div className="text-xs text-muted-foreground mt-1">/{p.slug}</div>
              </div>
              <Input type="color" defaultValue={p.theme_color} className="w-16 h-10" onChange={(e) => update.mutate({ id: p.id, patch: { theme_color: e.target.value } })} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
