import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ClipboardCheck } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({ meta: [{ title: "Sign in — OpsCheck" }] }),
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [department, setDepartment] = useState("operations");
  const [showForgot, setShowForgot] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [resetStep, setResetStep] = useState<"email" | "code" | "password">("email");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const exitTimerRef = useRef<number | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/app" });
    });

    return () => {
      if (exitTimerRef.current) window.clearTimeout(exitTimerRef.current);
    };
  }, [navigate]);

  function beginExit() {
    setIsExiting(true);
    exitTimerRef.current = window.setTimeout(() => {
      navigate({ to: "/app" });
    }, 800);
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Signed in");
    beginExit();
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setResetLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    setResetLoading(false);
    if (error) return toast.error(error.message);
    setResetStep("code");
    toast.success("Check your email for the 8-digit reset code");
  }

  async function handleVerifyResetCode(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{8}$/.test(resetCode)) return toast.error("Enter the 8-digit code from your email");

    setResetLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      email: resetEmail,
      token: resetCode,
      type: "recovery",
    });
    setResetLoading(false);
    if (error)
      return toast.error("That code is invalid or has expired. Request a new code and try again.");

    setResetStep("password");
    toast.success("Code verified");
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) return toast.error("Password must be at least 8 characters");
    if (newPassword !== confirmPassword) return toast.error("Passwords don't match");

    setResetLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setResetLoading(false);
    if (error) return toast.error(error.message || "Couldn't update your password");

    await supabase.auth.signOut();
    setShowForgot(false);
    setResetStep("email");
    setResetCode("");
    setNewPassword("");
    setConfirmPassword("");
    setPassword("");
    toast.success("Password reset. You can now sign in.");
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/app`,
        data: { full_name: fullName, department },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Account created — signing you in");
    beginExit();
  }

  return (
    <div
      className={`min-h-screen flex items-center justify-center bg-muted/30 px-4 relative auth-shell${isExiting ? " auth-exit" : ""}`}
    >
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md">
        <Link
          to="/"
          className={`flex items-center justify-center gap-2 mb-6 text-primary auth-brand${isExiting ? " auth-exit" : ""}`}
        >
          <ClipboardCheck className="h-7 w-7" />
          <span className="text-2xl font-bold">OpsCheck</span>
        </Link>
        <Card className={`auth-card${isExiting ? " auth-exit" : ""}`}>
          <CardHeader>
            <CardTitle>{showForgot ? "Reset password" : "Welcome"}</CardTitle>
            <CardDescription>
              {showForgot
                ? "Enter your email and we'll send you an 8-digit reset code."
                : "Sign in or create your account to continue."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {showForgot ? (
              <>
                {resetStep === "email" && (
                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    <div>
                      <Label htmlFor="fp-email">Email</Label>
                      <Input
                        id="fp-email"
                        type="email"
                        required
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={resetLoading}>
                      Send reset code
                    </Button>
                  </form>
                )}
                {resetStep === "code" && (
                  <form onSubmit={handleVerifyResetCode} className="space-y-4">
                    <div>
                      <Label htmlFor="fp-code">8-digit code</Label>
                      <Input
                        id="fp-code"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        pattern="[0-9]{8}"
                        maxLength={8}
                        required
                        value={resetCode}
                        onChange={(e) =>
                          setResetCode(e.target.value.replace(/\D/g, "").slice(0, 8))
                        }
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={resetLoading}>
                      Verify code
                    </Button>
                    <button
                      type="button"
                      onClick={() => setResetStep("email")}
                      className="text-sm text-muted-foreground underline w-full text-center"
                    >
                      Use a different email
                    </button>
                  </form>
                )}
                {resetStep === "password" && (
                  <form onSubmit={handleResetPassword} className="space-y-4">
                    <div>
                      <Label htmlFor="fp-new-password">New password</Label>
                      <Input
                        id="fp-new-password"
                        type="password"
                        minLength={8}
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="fp-confirm-password">Confirm password</Label>
                      <Input
                        id="fp-confirm-password"
                        type="password"
                        minLength={8}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={resetLoading}>
                      Reset password
                    </Button>
                  </form>
                )}
                <button
                  type="button"
                  onClick={() => setShowForgot(false)}
                  className="text-sm text-muted-foreground underline w-full text-center"
                >
                  Back to sign in
                </button>
              </>
            ) : (
              <Tabs defaultValue="signin">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="signin">Sign in</TabsTrigger>
                  <TabsTrigger value="signup">Sign up</TabsTrigger>
                </TabsList>
                <TabsContent value="signin">
                  <form onSubmit={handleSignIn} className="space-y-4 mt-4">
                    <div>
                      <Label htmlFor="si-email">Email</Label>
                      <Input
                        id="si-email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="si-password">Password</Label>
                      <Input
                        id="si-password"
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                      Sign in
                    </Button>
                    <button
                      type="button"
                      onClick={() => setShowForgot(true)}
                      className="text-sm text-muted-foreground underline w-full text-center block"
                    >
                      Forgot password?
                    </button>
                  </form>
                </TabsContent>
                <TabsContent value="signup">
                  <form onSubmit={handleSignUp} className="space-y-4 mt-4">
                    <div>
                      <Label htmlFor="su-name">Full name</Label>
                      <Input
                        id="su-name"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="su-email">Email</Label>
                      <Input
                        id="su-email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="su-password">Password</Label>
                      <Input
                        id="su-password"
                        type="password"
                        required
                        minLength={8}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="su-department">Department</Label>
                      <Select value={department} onValueChange={setDepartment}>
                        <SelectTrigger id="su-department">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="operations">Operations</SelectItem>
                          <SelectItem value="finance">Finance</SelectItem>
                          <SelectItem value="marketing">Marketing</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                      Create account
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
