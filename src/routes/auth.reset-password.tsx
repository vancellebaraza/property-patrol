import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { ClipboardCheck } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export const Route = createFileRoute("/auth/reset-password")({
  component: ResetPasswordPage,
  head: () => ({ meta: [{ title: "Reset password — OpsCheck" }] }),
});

type LinkStatus = "checking" | "ready" | "error";

// Supabase appends either a hash fragment (#access_token=...&type=recovery)
// on success, or (#error=access_denied&error_code=otp_expired&error_description=...)
// when the link is expired, already used, or the redirect URL wasn't allow-listed.
// No longer the primary reset path (moved to OTP in auth.tsx), kept correct as a fallback.
function parseRecoveryParams() {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const query = new URLSearchParams(window.location.search);
  return {
    errorCode: hash.get("error_code") || query.get("error_code"),
    errorDescription: hash.get("error_description") || query.get("error_description"),
  };
}

function friendlyLinkError(errorCode: string | null, description: string | null): string {
  if (errorCode === "otp_expired") {
    return "This reset link has expired or was already used.";
  }
  if (description) return decodeURIComponent(description.replace(/\+/g, " "));
  return "This reset link is invalid.";
}

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<LinkStatus>("checking");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  useEffect(() => {
    let settled = false;
    const settle = (next: LinkStatus, message?: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      if (message) setLinkError(message);
      setStatus(next);
    };

    const { errorCode, errorDescription } = parseRecoveryParams();
    if (errorCode || errorDescription) {
      settle("error", friendlyLinkError(errorCode, errorDescription));
      return;
    }

    // Clicking the emailed link gives this page a temporary "recovery" session automatically.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") settle("ready");
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) settle("ready");
    });

    const timeoutId = window.setTimeout(() => {
      settle("error", "This reset link is invalid.");
    }, 6000);

    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(timeoutId);
    };
  }, []);

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return toast.error("Password must be at least 8 characters");
    if (password !== confirm) return toast.error("Passwords don't match");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated");
    navigate({ to: "/app" });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4 relative">
      <div className="absolute top-4 right-4"><ThemeToggle /></div>
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center justify-center gap-2 mb-6 text-primary">
          <ClipboardCheck className="h-7 w-7" />
          <span className="text-2xl font-bold">OpsCheck</span>
        </Link>
        <Card>
          <CardHeader>
            <CardTitle>Set a new password</CardTitle>
            <CardDescription>
              {status === "ready" && "Choose a new password for your account."}
              {status === "checking" && "Checking your reset link…"}
              {status === "error" && "We couldn't verify this link."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {status === "ready" && (
              <form onSubmit={handleReset} className="space-y-4">
                <div>
                  <Label htmlFor="rp-password">New password</Label>
                  <Input id="rp-password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="rp-confirm">Confirm password</Label>
                  <Input id="rp-confirm" type="password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>Update password</Button>
              </form>
            )}
            {status === "checking" && (
              <p className="text-sm text-muted-foreground">One moment…</p>
            )}
            {status === "error" && (
              <p className="text-sm text-muted-foreground">
                {linkError} <Link to="/auth" className="text-primary underline">Request a new one</Link>.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}