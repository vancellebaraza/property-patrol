import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Property {
  id: string;
  name: string;
  slug: string;
  theme_color: string | null;
  logo_url: string | null;
}

export function useProperty(propertyId: string | null | undefined) {
  return useQuery({
    queryKey: ["property", propertyId],
    enabled: !!propertyId,
    queryFn: async (): Promise<Property | null> => {
      if (!propertyId) return null;
      const { data, error } = await supabase
        .from("properties")
        .select("id,name,slug,theme_color,logo_url")
        .eq("id", propertyId)
        .maybeSingle();
      if (error) throw error;
      return data as Property | null;
    },
  });
}

export function useAllProperties() {
  return useQuery({
    queryKey: ["properties-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("id,name,slug,theme_color,logo_url")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Property[];
    },
  });
}

/** Build inline style overriding --primary + --ring with property theme color. */
export function themeStyle(color?: string | null): React.CSSProperties {
  if (!color) return {};
  return {
    ["--primary" as any]: color,
    ["--ring" as any]: color,
  };
}
