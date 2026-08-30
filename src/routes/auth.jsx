import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Lock, Mail, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { fetchMyBusiness, completeOnboardingFlow } from "@/lib/queue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RegisterFlow } from "@/components/RegisterFlow";

export const Route = createFileRoute("/auth")({
  validateSearch: (search) => ({
    mode: search["mode"] === "login" ? "login" : "signup",
  }),
  head: () => ({
    meta: [
      { title: "Owner sign in & registration — LineUp" },
      {
        name: "description",
        content:
          "Sign in or register your business on LineUp to manage live queues and get your QR code.",
      },
      { property: "og:title", content: "Owner sign in & registration — LineUp" },
      {
        property: "og:description",
        content: "Set up your business workspace and start managing queues in minutes.",
      },
      { property: "og:image", content: "/LineUp(Logo).png" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const { session, user, loading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  const isLogin = mode === "login";

  // Check if existing logged-in user already has a business workspace
  useEffect(() => {
    let cancelled = false;
    async function checkExisting() {
      if (!loading && user) {
        try {
          const biz = await fetchMyBusiness(user.id);
          if (!cancelled && biz) {
            navigate({ to: "/dashboard" });
          }
        } catch {
          // If fetch fails, allow staying on page
        }
      }
    }
    checkExisting();
    return () => {
      cancelled = true;
    };
  }, [loading, user, navigate]);

  async function onLoginSubmit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;

      // Determine business membership & ownership under RLS
      let biz = await fetchMyBusiness(data.user.id);

      // If no business exists yet, check if there is pending onboarding data from registration
      if (!biz) {
        try {
          const raw = localStorage.getItem("lineup_pending_onboarding");
          if (raw) {
            const pending = JSON.parse(raw);
            if (pending?.businessName) {
              const res = await completeOnboardingFlow({
                user: data.user,
                businessName: pending.businessName,
                address: pending.address || "",
                businessType: pending.businessType || null,
                phone: pending.phone || null,
              });
              biz = res?.business;
              localStorage.removeItem("lineup_pending_onboarding");
            }
          }
        } catch (onboardingErr) {
          console.warn("Auto-onboarding error on login:", onboardingErr);
        }
      }

      if (biz) {
        toast.success("Welcome back!");
        navigate({ to: "/dashboard" });
      } else {
        // Incomplete registration: user has auth credentials but no workspace
        toast.info("Please finish setting up your business workspace.");
        navigate({ to: "/auth", search: { mode: "signup" } });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to sign in. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col bg-background paper-grain min-h-screen sm:h-screen sm:max-h-dvh sm:overflow-hidden justify-between">
      <header className="mx-auto flex w-full max-w-6xl items-center px-6 py-3 sm:py-4 shrink-0">
        <Link to="/" className="flex items-center gap-4 group">
          <img
            src="/LineUp(Logo).png"
            alt="LineUp logo"
            className="h-14 sm:h-16 w-auto rounded-xl object-contain transition-transform group-hover:scale-105"
          />
          <span className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight">LineUp</span>
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 sm:px-6 py-2 sm:py-3 overflow-y-auto sm:overflow-hidden">
        {isLogin ? (
          /* Separate Clean Login View */
          <div className="stub w-full max-w-md px-6 sm:px-8 py-9">
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-[#077E42] font-semibold">
              Welcome back
            </p>
            <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold tracking-tight">
              Sign in to your dashboard
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter your email and password to access your live queue.
            </p>

            <form onSubmit={onLoginSubmit} className="mt-7 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="login-email" className="text-sm font-semibold">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="login-email"
                    type="email"
                    required
                    autoComplete="email"
                    className="pl-10"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@business.com"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="login-password" className="text-sm font-semibold">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    className="pl-10 pr-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  className="w-full rounded-full bg-[#077E42] hover:bg-[#066e3a] text-white font-semibold"
                  size="lg"
                  disabled={busy}
                >
                  {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Sign in
                </Button>
              </div>
            </form>

            <p className="mt-7 text-center text-sm text-muted-foreground">
              Don't have an account yet?{" "}
              <Link
                to="/auth"
                search={{ mode: "signup" }}
                className="font-semibold text-[#077E42] underline-offset-4 hover:underline"
              >
                Create one
              </Link>
            </p>
          </div>
        ) : (
          /* 3-Step Business Registration Flow */
          <RegisterFlow
            onSwitchToLogin={() => navigate({ to: "/auth", search: { mode: "login" } })}
          />
        )}
      </main>
    </div>
  );
}
