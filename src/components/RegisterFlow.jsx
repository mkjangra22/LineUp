import { useState, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Check,
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  Upload,
  Trash2,
  Building2,
  Mail,
  Phone,
  Lock,
  Sparkles,
  Loader2,
  AlertCircle,
  Image as ImageIcon,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase";
import { completeOnboardingFlow, DEFAULT_BRAND_COLOR } from "@/lib/queue";
import { PLANS, PLAN_LIST } from "@/lib/plans";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const BUSINESS_CATEGORIES = [
  "Clinic",
  "Salon",
  "Restaurant",
  "Bank",
  "Service",
  "Retail",
  "Other",
];

export function RegisterFlow({ onSwitchToLogin }) {
  const navigate = useNavigate();

  // Step indicator: 1 = Account, 2 = Details, 3 = Plan
  const [currentStep, setCurrentStep] = useState(1);
  const [maxCompletedStep, setMaxCompletedStep] = useState(0);

  // Form State
  // Step 1: Account
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Step 2: Details
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [address, setAddress] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [customBusinessType, setCustomBusinessType] = useState("");

  // Step 3: Plan
  const [selectedPlanId, setSelectedPlanId] = useState("free");

  // UI state
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});
  const fileInputRef = useRef(null);

  // Validation functions
  function validateStep1() {
    const errs = {};

    const trimmedName = businessName.trim();
    if (!trimmedName) {
      errs.businessName = "Business name is required";
    } else if (trimmedName.length < 2) {
      errs.businessName = "Must be at least 2 characters";
    } else if (trimmedName.length > 60) {
      errs.businessName = "Must be 60 characters or less";
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      errs.email = "Email is required";
    } else if (!emailPattern.test(email.trim())) {
      errs.email = "Please enter a valid email";
    }

    const rawDigits = phone.replace(/\D/g, "");
    if (!phone.trim()) {
      errs.phone = "Phone number is required";
    } else if (rawDigits.length < 10 || rawDigits.length > 15) {
      errs.phone = "Must be 10-15 digits";
    }

    if (!password) {
      errs.password = "Password is required";
    } else if (password.length < 8) {
      errs.password = "At least 8 characters";
    } else if (!/[0-9]/.test(password)) {
      errs.password = "Must include a number";
    } else if (!/[a-zA-Z]/.test(password)) {
      errs.password = "Must include a letter";
    }

    if (!confirmPassword) {
      errs.confirmPassword = "Confirm your password";
    } else if (confirmPassword !== password) {
      errs.confirmPassword = "Passwords do not match";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function validateStep2() {
    const errs = {};
    if (!address.trim()) {
      errs.address = "Business address is required";
    } else if (address.trim().length < 5) {
      errs.address = "Please provide a full address";
    }

    if (businessType === "Other" && !customBusinessType.trim()) {
      errs.businessType = "Please specify category";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleStep1Continue(e) {
    e.preventDefault();
    if (validateStep1()) {
      setMaxCompletedStep((prev) => Math.max(prev, 1));
      setCurrentStep(2);
    }
  }

  function handleStep2Continue(e) {
    e.preventDefault();
    if (validateStep2()) {
      setMaxCompletedStep((prev) => Math.max(prev, 2));
      setCurrentStep(3);
    }
  }

  function handleLogoSelect(file) {
    if (!file) return;

    const allowedMime = [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/webp",
      "image/svg+xml",
    ];
    if (!allowedMime.includes(file.type)) {
      toast.error("Please upload PNG, JPG, WebP, or SVG.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo file size must be less than 2MB.");
      return;
    }

    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(reader.result);
    reader.readAsDataURL(file);
  }

  function handleRemoveLogo() {
    setLogoFile(null);
    setLogoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleCompleteRegistration() {
    if (selectedPlanId !== "free") {
      toast.info("This plan is coming soon. Please start with Free today!");
      setSelectedPlanId("free");
      return;
    }

    if (!validateStep1() || !validateStep2()) {
      toast.error("Please check the form for errors before submitting.");
      return;
    }

    setBusy(true);
    try {
      const finalCategory =
        businessType === "Other"
          ? customBusinessType.trim() || "Other"
          : businessType;

      // 1. Check if user already has an active authenticated session
      let authUser = null;
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session?.user) {
        authUser = sessionData.session.user;
      }

      // 2. If no active session, attempt signUp or resume existing account via signIn
      if (!authUser) {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              phone: phone.trim(),
              business_name: businessName.trim(),
            },
          },
        });

        if (signUpError) {
          const isRateLimit =
            signUpError.code === "over_email_send_rate_limit" ||
            signUpError.message?.toLowerCase().includes("rate limit");
          const isExisting =
            signUpError.message?.toLowerCase().includes("already registered") ||
            signUpError.message?.toLowerCase().includes("user_already_exists");

          if (isRateLimit || isExisting) {
            // Attempt to sign in with password in case account was created in a previous step
            const { data: signInData, error: signInError } =
              await supabase.auth.signInWithPassword({
                email: email.trim(),
                password,
              });

            if (!signInError && signInData?.user && signInData?.session) {
              authUser = signInData.user;
            } else if (isRateLimit) {
              throw new Error(
                "Email verification rate limit exceeded. If you already created this account, please sign in. Otherwise, please wait a few moments or disable email confirmations in your Supabase dashboard."
              );
            } else if (signInError) {
              throw new Error(
                "An account with this email already exists. Please sign in with your existing password or use a different email."
              );
            }
          } else {
            throw signUpError;
          }
        } else {
          // signUp succeeded
          if (signUpData.session) {
            authUser = signUpData.user;
          } else {
            // Email confirmation is required by Supabase project settings.
            // Attempt immediate password login in case session can be established.
            const { data: signInData } = await supabase.auth.signInWithPassword({
              email: email.trim(),
              password,
            });

            if (signInData?.session?.user) {
              authUser = signInData.session.user;
            } else {
              // Save pending onboarding so that upon confirmation & login, workspace is completed
              try {
                localStorage.setItem(
                  "lineup_pending_onboarding",
                  JSON.stringify({
                    businessName: businessName.trim(),
                    address: address.trim(),
                    businessType: finalCategory,
                    phone: phone.trim(),
                  })
                );
              } catch (_) {}

              toast.success(
                "Account created! Please check your email inbox to confirm your account, then sign in to access your dashboard.",
                { duration: 10000 }
              );
              onSwitchToLogin();
              return;
            }
          }
        }
      }

      if (!authUser) {
        throw new Error("Could not authenticate user session. Please sign in.");
      }

      // 3. Complete database and storage onboarding flow with authenticated session
      const { business, logoWarning } = await completeOnboardingFlow({
        user: authUser,
        businessName: businessName.trim(),
        address: address.trim(),
        businessType: finalCategory,
        phone: phone.trim(),
        logoFile,
        brandColor: DEFAULT_BRAND_COLOR,
      });

      // Clear any pending onboarding data
      try {
        localStorage.removeItem("lineup_pending_onboarding");
      } catch (_) {}

      if (logoWarning) {
        toast.warning(logoWarning);
      } else {
        toast.success("Welcome to LineUp! Your workspace is ready.");
      }

      navigate({ to: "/dashboard" });
    } catch (err) {
      console.error("[Registration] Error:", err);
      const errMsg =
        err?.message ||
        err?.error_description ||
        (typeof err === "string" ? err : "Registration failed. Please try again.");
      toast.error(errMsg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-2xl my-auto">
      {/* Compact Progress Indicator */}
      <div className="mb-3 sm:mb-4 flex items-center justify-between border-b border-border/70 pb-2 sm:pb-2.5">
        {[
          { num: 1, label: "01 Account" },
          { num: 2, label: "02 Details" },
          { num: 3, label: "03 Plan" },
        ].map((step, idx) => {
          const isCurrent = currentStep === step.num;
          const isCompleted = maxCompletedStep >= step.num;
          const canClick = isCompleted || step.num <= currentStep;

          return (
            <div key={step.num} className="flex items-center">
              <button
                type="button"
                disabled={!canClick || busy}
                onClick={() => {
                  if (canClick) {
                    setErrors({});
                    setCurrentStep(step.num);
                  }
                }}
                className={`group flex items-center gap-1.5 sm:gap-2 text-left transition-all ${
                  isCurrent
                    ? "text-[#077E42] font-bold"
                    : isCompleted
                    ? "text-foreground font-semibold hover:text-[#077E42]"
                    : "text-muted-foreground opacity-60 cursor-not-allowed"
                }`}
              >
                <span
                  className={`flex size-6 sm:size-7 items-center justify-center rounded-full text-xs font-mono transition-colors ${
                    isCurrent
                      ? "bg-[#077E42] text-white shadow-sm"
                      : isCompleted
                      ? "bg-[#077E42]/15 text-[#077E42] border border-[#077E42]/40"
                      : "bg-muted text-muted-foreground border border-border"
                  }`}
                >
                  {isCompleted && !isCurrent ? (
                    <Check className="size-3 stroke-[2.5]" />
                  ) : (
                    step.num
                  )}
                </span>
                <span className="font-mono text-xs sm:text-sm tracking-tight hidden sm:inline">
                  {step.label}
                </span>
              </button>

              {idx < 2 && (
                <div
                  className={`mx-2 sm:mx-5 h-px w-6 sm:w-10 transition-colors ${
                    isCompleted ? "bg-[#077E42]/50" : "bg-border"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* STEP 1 — ACCOUNT (Viewport-fitted 2-column layout) */}
      {currentStep === 1 && (
        <div className="stub px-5 sm:px-8 py-4 sm:py-5 shadow-[var(--shadow-stub)] transition-all">
          <div className="border-b border-border/50 pb-2 sm:pb-2.5">
            <span className="inline-block font-mono text-[10px] sm:text-[11px] uppercase tracking-[0.2em] text-[#077E42] font-semibold">
              Step 01 of 03
            </span>
            <h1 className="mt-0.5 text-xl sm:text-2xl font-extrabold tracking-tight">
              Create your LineUp account
            </h1>
            <p className="text-xs text-muted-foreground">
              Set up your business workspace and start managing queues.
            </p>
          </div>

          <form onSubmit={handleStep1Continue} className="mt-3.5 sm:mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2.5 sm:gap-y-3">
              {/* Business Name (Full Width) */}
              <div className="sm:col-span-2 space-y-1">
                <Label htmlFor="reg-bname" className="text-xs font-semibold">
                  Business Name <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="reg-bname"
                    type="text"
                    required
                    maxLength={60}
                    className={`h-9 pl-9 text-xs sm:text-sm ${
                      errors.businessName ? "border-destructive focus-visible:ring-destructive" : ""
                    }`}
                    placeholder="Enter Business Name"
                    value={businessName}
                    onChange={(e) => {
                      setBusinessName(e.target.value);
                      if (errors.businessName) setErrors((prev) => ({ ...prev, businessName: null }));
                    }}
                  />
                </div>
                {errors.businessName && (
                  <p className="text-[11px] text-destructive flex items-center gap-1">
                    <AlertCircle className="size-3" /> {errors.businessName}
                  </p>
                )}
              </div>

              {/* Email */}
              <div className="space-y-1">
                <Label htmlFor="reg-email" className="text-xs font-semibold">
                  Email Address <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="reg-email"
                    type="email"
                    required
                    autoComplete="email"
                    className={`h-9 pl-9 text-xs sm:text-sm ${
                      errors.email ? "border-destructive focus-visible:ring-destructive" : "" 
                    }`}
                    placeholder="business@email.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (errors.email) setErrors((prev) => ({ ...prev, email: null }));
                    }}
                  />
                </div>
                {errors.email && (
                  <p className="text-[11px] text-destructive flex items-center gap-1">
                    <AlertCircle className="size-3" /> {errors.email}
                  </p>
                )}
              </div>

              {/* Phone */}
              <div className="space-y-1">
                <Label htmlFor="reg-phone" className="text-xs font-semibold">
                  Phone Number <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="reg-phone"
                    type="tel"
                    required
                    autoComplete="tel"
                    className={`h-9 pl-9 text-xs sm:text-sm font-mono ${
                      errors.phone ? "border-destructive focus-visible:ring-destructive" : ""
                    }`}
                    placeholder="+91 9876543210" 
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      if (errors.phone) setErrors((prev) => ({ ...prev, phone: null }));
                    }}
                  />
                </div>
                {errors.phone && (
                  <p className="text-[11px] text-destructive flex items-center gap-1">
                    <AlertCircle className="size-3" /> {errors.phone}
                  </p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-1">
                <Label htmlFor="reg-password" className="text-xs font-semibold">
                  Password <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="reg-password"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    className={`h-9 pl-9 pr-9 text-xs sm:text-sm ${
                      errors.password ? "border-destructive focus-visible:ring-destructive" : ""
                    }`}
                    placeholder="Min 8 chars, letter & digit"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errors.password) setErrors((prev) => ({ ...prev, password: null }));
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-[11px] text-destructive flex items-center gap-1">
                    <AlertCircle className="size-3" /> {errors.password}
                  </p>
                )}
              </div>

              {/* Confirm Password */}
              <div className="space-y-1">
                <Label htmlFor="reg-confirm-password" className="text-xs font-semibold">
                  Confirm Password <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="reg-confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    className={`h-9 pl-9 pr-9 text-xs sm:text-sm ${
                      errors.confirmPassword ? "border-destructive focus-visible:ring-destructive" : ""
                    }`}
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (errors.confirmPassword) setErrors((prev) => ({ ...prev, confirmPassword: null }));
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="text-[11px] text-destructive flex items-center gap-1">
                    <AlertCircle className="size-3" /> {errors.confirmPassword}
                  </p>
                )}
              </div>

              {/* Submit CTA */}
              <div className="sm:col-span-2 pt-1.5">
                <Button
                  type="submit"
                  size="default"
                  className="w-full h-9 sm:h-10 rounded-full bg-[#077E42] hover:bg-[#066e3a] text-white font-semibold flex items-center justify-center gap-2 text-sm shadow-sm"
                >
                  Continue <ArrowRight className="size-4" />
                </Button>
              </div>
            </div>
          </form>

          <p className="mt-3 text-center text-xs text-muted-foreground">
            Already have an account?{" "}
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="font-semibold text-[#077E42] underline-offset-4 hover:underline"
            >
              Sign in
            </button>
          </p>
        </div>
      )}

      {/* STEP 2 — DETAILS (Compact side-by-side layout) */}
      {currentStep === 2 && (
        <div className="stub px-5 sm:px-8 py-4 sm:py-5 shadow-[var(--shadow-stub)] transition-all">
          <div className="border-b border-border/50 pb-2 sm:pb-2.5">
            <span className="inline-block font-mono text-[10px] sm:text-[11px] uppercase tracking-[0.2em] text-[#077E42] font-semibold">
              Step 02 of 03
            </span>
            <h1 className="mt-0.5 text-xl sm:text-2xl font-extrabold tracking-tight">
              Tell us about your business
            </h1>
            <p className="text-xs text-muted-foreground">
              Add the details customers will see when scanning your queue.
            </p>
          </div>

          <form onSubmit={handleStep2Continue} className="mt-3.5 sm:mt-4 space-y-3 sm:space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 items-start">
              {/* Business Logo Upload */}
              <div className="space-y-1.5 rounded-xl border border-border/70 p-3 bg-muted/20">
                <Label className="text-xs font-semibold block">
                  Business Logo <span className="font-normal text-muted-foreground">(Optional)</span>
                </Label>

                <div className="flex items-center gap-3">
                  <div className="relative flex size-12 shrink-0 items-center justify-center rounded-xl border border-dashed border-border bg-card overflow-hidden">
                    {logoPreview ? (
                      <img
                        src={logoPreview}
                        alt="Logo preview"
                        className="size-full object-contain p-0.5"
                      />
                    ) : (
                      <ImageIcon className="size-5 text-muted-foreground/50" />
                    )}
                  </div>

                  <div className="space-y-1">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleLogoSelect(file);
                      }}
                    />
                    <div className="flex gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs rounded-full px-2.5"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="mr-1 size-3" />
                        {logoPreview ? "Replace" : "Upload"}
                      </Button>
                      {logoPreview && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs rounded-full px-2 text-destructive hover:bg-destructive/10"
                          onClick={handleRemoveLogo}
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground">PNG/JPG up to 2MB</p>
                  </div>
                </div>
              </div>

              {/* Business Type / Category */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold block">
                  Category <span className="font-normal text-muted-foreground">(Optional)</span>
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {BUSINESS_CATEGORIES.map((cat) => {
                    const isSelected = businessType === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => {
                          setBusinessType(isSelected ? "" : cat);
                          if (errors.businessType) setErrors((prev) => ({ ...prev, businessType: null }));
                        }}
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all ${
                          isSelected
                            ? "bg-[#077E42] text-white shadow-sm"
                            : "border border-border bg-card text-foreground hover:bg-muted"
                        }`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>

                {businessType === "Other" && (
                  <Input
                    placeholder="e.g. Office, Shop, etc"
                    value={customBusinessType}
                    onChange={(e) => setCustomBusinessType(e.target.value)}
                    className="h-8 text-xs mt-1.5"
                  />
                )}
              </div>
            </div>

            {/* Business Address */}
            <div className="space-y-1">
              <Label htmlFor="reg-address" className="text-xs font-semibold">
                Business Address <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="reg-address"
                required
                rows={2}
                className={`resize-none text-xs sm:text-sm py-1.5 ${
                  errors.address ? "border-destructive focus-visible:ring-destructive" : ""
                }`}
                placeholder="Enter Address of your Business"
                value={address}
                onChange={(e) => {
                  setAddress(e.target.value);
                  if (errors.address) setErrors((prev) => ({ ...prev, address: null }));
                }}
              />
              {errors.address ? (
                <p className="text-[11px] text-destructive flex items-center gap-1">
                  <AlertCircle className="size-3" /> {errors.address}
                </p>
              ) : (
                <p className="text-[10px] text-muted-foreground">
                  Printed on your physical counter QR poster.
                </p>
              )}
            </div>

            {/* Navigation CTAs */}
            <div className="flex items-center gap-2.5 pt-1">
              <Button
                type="button"
                variant="outline"
                size="default"
                className="h-9 sm:h-10 rounded-full border-border text-xs sm:text-sm"
                onClick={() => setCurrentStep(1)}
              >
                <ArrowLeft className="mr-1.5 size-3.5" /> Back
              </Button>
              <Button
                type="submit"
                size="default"
                className="flex-1 h-9 sm:h-10 rounded-full bg-[#077E42] hover:bg-[#066e3a] text-white font-semibold flex items-center justify-center gap-2 text-xs sm:text-sm shadow-sm"
              >
                Continue <ArrowRight className="size-3.5" />
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* STEP 3 — PLAN (Fitted horizontal card grid) */}
      {currentStep === 3 && (
        <div className="transition-all">
          <div className="text-center max-w-md mx-auto mb-3 sm:mb-4">
            <span className="inline-block font-mono text-[10px] sm:text-[11px] uppercase tracking-[0.2em] text-[#077E42] font-semibold">
              Step 03 of 03
            </span>
            <h1 className="mt-0.5 text-xl sm:text-2xl font-extrabold tracking-tight">
              Choose your plan
            </h1>
            <p className="text-xs text-muted-foreground">
              Start free and upgrade whenever you need. No payment required today.
            </p>
          </div>

          {/* Pricing Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
            {PLAN_LIST.map((plan) => {
              const isSelected = selectedPlanId === plan.id;
              const isFree = plan.id === "free";

              return (
                <div
                  key={plan.id}
                  onClick={() => {
                    if (isFree) setSelectedPlanId(plan.id);
                  }}
                  className={`stub relative flex flex-col justify-between p-3.5 sm:p-4 transition-all ${
                    isFree
                      ? isSelected
                        ? "ring-2 ring-[#077E42] border-[#077E42]/60 shadow-md cursor-pointer"
                        : "hover:border-[#077E42]/40 cursor-pointer"
                      : "opacity-80 border-dashed"
                  }`}
                >
                  <div>
                    {/* Badge */}
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[9px] uppercase font-bold tracking-wider ${
                          isFree
                            ? "bg-[#077E42]/15 text-[#077E42]"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {plan.badge}
                      </span>
                      {isSelected && isFree && (
                        <span className="flex size-4 items-center justify-center rounded-full bg-[#077E42] text-white">
                          <Check className="size-2.5 stroke-[3]" />
                        </span>
                      )}
                    </div>

                    <h2 className="text-base sm:text-lg font-bold">{plan.name}</h2>
                    <p className="text-[11px] text-muted-foreground line-clamp-2 min-h-[28px]">
                      {plan.description}
                    </p>

                    {/* Price */}
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-2xl sm:text-3xl font-extrabold tracking-tight font-display">
                        {plan.priceDisplay}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {plan.intervalDisplay}
                      </span>
                    </div>

                    {/* Features List */}
                    <ul className="mt-2.5 space-y-1 sm:space-y-1.5 text-[11px] border-t border-border/50 pt-2.5">
                      {plan.features.slice(0, 4).map((feat, fidx) => (
                        <li key={fidx} className="flex items-start gap-1.5 text-foreground/90">
                          <Check className="size-3 shrink-0 text-[#077E42] stroke-[2.5] mt-0.5" />
                          <span className="line-clamp-1">{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Selection Button */}
                  <div className="mt-3 pt-2.5 border-t border-border/40">
                    {isFree ? (
                      <Button
                        type="button"
                        size="sm"
                        disabled={busy}
                        onClick={handleCompleteRegistration}
                        className="w-full h-8 rounded-full bg-[#077E42] hover:bg-[#066e3a] text-white text-xs font-semibold"
                      >
                        {busy ? (
                          <>
                            <Loader2 className="mr-1.5 size-3 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          plan.cta
                        )}
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled
                        className="w-full h-8 rounded-full text-muted-foreground bg-muted/20 border-dashed text-xs"
                      >
                        Coming soon
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Secondary Actions */}
          <div className="mt-3 sm:mt-4 flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              className="h-8 sm:h-9 rounded-full border-border text-xs"
              onClick={() => setCurrentStep(2)}
            >
              <ArrowLeft className="mr-1.5 size-3" /> Back
            </Button>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                disabled={busy}
                onClick={handleCompleteRegistration}
                className="h-8 sm:h-9 rounded-full bg-[#077E42] hover:bg-[#066e3a] text-white font-semibold px-5 text-xs sm:text-sm shadow-sm"
              >
                {busy ? (
                  <>
                    <Loader2 className="mr-1.5 size-3 animate-spin" /> Setting up...
                  </>
                ) : (
                  <>
                    Start with Free <Sparkles className="ml-1.5 size-3.5" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
