import pathlib, sys

def patch(path, old, new, label):
    p = pathlib.Path(path)
    text = p.read_text()
    if new.strip() and new.strip() in text:
        print(f"SKIP  {label} (already applied)")
        return
    if old not in text:
        print(f"FAIL  {label} — anchor text not found in {path}. Stopping, nothing else changed.")
        sys.exit(1)
    p.write_text(text.replace(old, new, 1))
    print(f"OK    {label}")

# ================= new file: reset-password landing page =================
reset_path = pathlib.Path("src/routes/auth.reset-password.tsx")
if reset_path.exists():
    print("SKIP  auth.reset-password.tsx (already exists)")
else:
    reset_path.write_text('''import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
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

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  useEffect(() => {
    // Clicking the emailed link gives this page a temporary "recovery" session automatically.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
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
              {ready ? "Choose a new password for your account." : "Checking your reset link…"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {ready ? (
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
            ) : (
              <p className="text-sm text-muted-foreground">
                This link may have expired. <Link to="/auth" className="text-primary underline">Request a new one</Link>.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
''')
    print("OK    auth.reset-password.tsx created")

# ================= auth.tsx: add "Forgot password?" flow =================
patch(
    "src/routes/auth.tsx",
    '''  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const exitTimerRef = useRef<number | null>(null);''',
    '''  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showForgot, setShowForgot] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const exitTimerRef = useRef<number | null>(null);''',
    "auth.tsx forgot-password state",
)

patch(
    "src/routes/auth.tsx",
    '''  async function handleSignUp(e: React.FormEvent) {''',
    '''  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setResetLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    setResetLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Check your email for a reset link");
  }

  async function handleSignUp(e: React.FormEvent) {''',
    "auth.tsx handleForgotPassword",
)

patch(
    "src/routes/auth.tsx",
    '''          <CardHeader>
            <CardTitle>Welcome</CardTitle>
            <CardDescription>Sign in or create your account to continue.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin">''',
    '''          <CardHeader>
            <CardTitle>{showForgot ? "Reset password" : "Welcome"}</CardTitle>
            <CardDescription>
              {showForgot ? "Enter your email and we'll send you a reset link." : "Sign in or create your account to continue."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {showForgot ? (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div>
                  <Label htmlFor="fp-email">Email</Label>
                  <Input id="fp-email" type="email" required value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} />
                </div>
                <Button type="submit" className="w-full" disabled={resetLoading}>Send reset link</Button>
                <button type="button" onClick={() => setShowForgot(false)} className="text-sm text-muted-foreground underline w-full text-center">
                  Back to sign in
                </button>
              </form>
            ) : (
            <Tabs defaultValue="signin">''',
    "auth.tsx conditional forgot form open",
)

patch(
    "src/routes/auth.tsx",
    '''                  <Button type=\"submit\" className=\"w-full\" disabled={loading}>Sign in</Button>
                </form>
              </TabsContent>''',
    '''                  <Button type=\"submit\" className=\"w-full\" disabled={loading}>Sign in</Button>
                  <button type=\"button\" onClick={() => setShowForgot(true)} className=\"text-sm text-muted-foreground underline w-full text-center block\">
                    Forgot password?
                  </button>
                </form>
              </TabsContent>''',
    "auth.tsx forgot link under signin form",
)

patch(
    "src/routes/auth.tsx",
    '''            </Tabs>
          </CardContent>''',
    '''            </Tabs>
            )}
          </CardContent>''',
    "auth.tsx conditional forgot form close",
)

print("\\nAll patches applied.")
