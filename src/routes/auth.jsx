import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { QrCode, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  validateSearch: (search) => ({
    mode: search["mode"] === "login" ? "login" : "signup",
  }),
  head: () => ({
    meta: [
      { title: "Owner sign in — LineUp" },
      {
        name: "description",
        content:
          "Sign in or create a LineUp account to get your QR code and live queue dashboard.",
      },
      { property: "og:title", content: "Owner sign in — LineUp" },
      {
        property: "og:description",
        content: "Create your queue in under a minute and print your QR code.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const isLogin = mode === "login";

  useEffect(() => {
    if (!loading && session) navigate({ to: "/dashboard" });
  }, [loading, session, navigate]);

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/dashboard" });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/dashboard` },
        });
        if (error) throw error;
        if (data.session) {
          navigate({ to: "/dashboard" });
        } else {
          toast.success("Check your inbox to confirm your email, then sign in.");
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background paper-grain">
      <header className="mx-auto flex w-full max-w-6xl items-center px-6 py-6">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl warm-gradient text-primary-foreground">
            <QrCode className="size-5" />
          </span>
          <span className="font-display text-lg font-bold tracking-tight">LineUp</span>
        </Link>
      </header>

      <main className="flex flex-1 items-start justify-center px-6 pb-20 pt-6">
        <div className="stub w-full max-w-md px-8 py-9">
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
            {isLogin ? "Welcome back" : "Get started"}
          </p>
          <h1 className="mt-3 text-3xl font-extrabold">
            {isLogin ? "Sign in to your dashboard" : "Create your queue"}
          </h1>

          <form onSubmit={onSubmit} className="mt-7 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@business.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                autoComplete={isLogin ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
              />
            </div>
            <Button type="submit" className="w-full rounded-full" size="lg" disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              {isLogin ? "Sign in" : "Create account"}
            </Button>
          </form>

          <p className="mt-7 text-center text-sm text-muted-foreground">
            {isLogin ? "No account yet?" : "Already have an account?"}{" "}
            <Link
              to="/auth"
              search={{ mode: isLogin ? "signup" : "login" }}
              className="font-semibold text-primary underline-offset-4 hover:underline"
            >
              {isLogin ? "Create one" : "Sign in"}
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
