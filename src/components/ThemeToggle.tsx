import { Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  return (
    <Button variant="ghost" size="icon" aria-label="Light theme" disabled>
      <Sun className="h-4 w-4" />
    </Button>
  );
}
