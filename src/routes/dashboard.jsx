import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  QrCode,
  Loader2,
  LogOut,
  Copy,
  Download,
  SkipForward,
  Check,
  RotateCcw,
  Pause,
  Play,
  Printer,
  Upload,
  Trash2,
  Palette,
  ArrowLeft,
  Users,
  ExternalLink,
  Smartphone,
  SlidersHorizontal,
  Sparkles,
  MapPin,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import {
  callNext,
  createBusiness,
  fetchMyBusiness,
  fetchTickets,
  logoUrl,
  resetQueue,
  setPaused,
  setTicketStatus,
  skipNext,
  updateBranding,
  uploadLogo,
  DEFAULT_BRAND_COLOR,
} from "@/lib/queue";
import { BRAND_PRESETS, brandStyle, makeQrDataUrl, printPoster } from "@/lib/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Queue dashboard — LineUp" },
      {
        name: "description",
        content:
          "Your live queue: see who is waiting, call the next person, and share your QR code.",
      },
      { property: "og:title", content: "Queue dashboard — LineUp" },
      { property: "og:image", content: "/LineUp(Logo).png" },
      {
        name: "robots",
        content: "noindex",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentView, setCurrentView] = useState("queue"); // 'queue' | 'branding'

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { mode: "login" } });
  }, [loading, user, navigate]);

  const businessQuery = useQuery({
    queryKey: ["business", user?.id],
    queryFn: () => fetchMyBusiness(user.id),
    enabled: !!user,
    refetchInterval: 5000,
  });

  const business = businessQuery.data ?? null;

  const ticketsQuery = useQuery({
    queryKey: ["tickets", business?.id],
    queryFn: () => fetchTickets(business.id),
    enabled: !!business,
    refetchInterval: 4000,
  });

  useEffect(() => {
    if (!business) return;
    const channel = supabase
      .channel(`queue-${business.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tickets" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["tickets", business.id] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "businesses" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["business", user?.id] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [business, queryClient, user?.id]);

  if (loading || businessQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background paper-grain">
      {/* Header: Clean with LineUp logo on left and Sign Out on right (No navbar) */}
      <header className="border-b border-border bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-3.5 group">
            <img
              src="/LineUp(Logo).png"
              alt="LineUp logo"
              className="h-14 sm:h-16 w-auto rounded-xl object-contain transition-transform group-hover:scale-105"
            />
            <span className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight">
              LineUp
            </span>
          </Link>

          <Button
            variant="ghost"
            size="sm"
            className="rounded-full text-muted-foreground hover:text-foreground"
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/" });
            }}
          >
            <LogOut className="size-4" /> Sign out
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {!business ? (
          <CreateBusiness
            userId={user.id}
            onCreated={() => businessQuery.refetch()}
          />
        ) : currentView === "queue" ? (
          <QueueBoard
            business={business}
            tickets={ticketsQuery.data ?? []}
            refetch={() => {
              ticketsQuery.refetch();
              businessQuery.refetch();
            }}
            onOpenBranding={() => setCurrentView("branding")}
          />
        ) : (
          <BrandingStudioView
            business={business}
            refetch={() => {
              businessQuery.refetch();
              ticketsQuery.refetch();
            }}
            onBack={() => setCurrentView("queue")}
          />
        )}
      </main>
    </div>
  );
}

function CreateBusiness({ userId, onCreated }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div className="stub mx-auto max-w-lg px-8 py-9">
      <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
        Step 1 of 1
      </p>
      <h1 className="mt-3 text-3xl font-extrabold">Name your queue</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This is what customers see when they scan your QR code.
      </p>
      <form
        className="mt-7 space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await createBusiness(userId, name);
            toast.success("Queue created — here's your QR code");
            onCreated();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Could not create queue");
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="bname">Business name</Label>
          <Input
            id="bname"
            required
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Corner Barber Shop"
          />
        </div>
        <Button type="submit" size="lg" className="w-full rounded-full" disabled={busy}>
          {busy && <Loader2 className="size-4 animate-spin" />}
          Create queue
        </Button>
      </form>
    </div>
  );
}

function QueueBoard({ business, tickets, refetch, onOpenBranding }) {
  const [qr, setQr] = useState("");
  const [busy, setBusy] = useState(false);
  const [logoSrc, setLogoSrc] = useState(null);

  const joinUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/q/${business.slug}`;
  }, [business.slug]);

  useEffect(() => {
    let alive = true;
    logoUrl(business.logo_path).then((u) => {
      if (alive) setLogoSrc(u);
    });
    return () => {
      alive = false;
    };
  }, [business.logo_path]);

  useEffect(() => {
    if (!joinUrl) return;
    makeQrDataUrl(joinUrl, {
      color: business.brand_color || DEFAULT_BRAND_COLOR,
      logoUrl: logoSrc,
    }).then(setQr);
  }, [joinUrl, business.brand_color, logoSrc]);

  const waiting = tickets
    .filter((t) => t.status === "waiting")
    .sort((a, b) => a.number - b.number);
  const serving = tickets.find((t) => t.status === "serving") ?? null;

  async function run(fn, ok) {
    setBusy(true);
    try {
      await fn();
      if (ok) toast.success(ok);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
      {/* Left Column: Live Queue Operations */}
      <section className="space-y-6">
        <div className="stub-notched px-8 py-9 text-center">
          <div className="mb-5 flex items-center justify-center">
            <Button
              variant={business.paused ? "default" : "outline"}
              size="sm"
              className="rounded-full"
              disabled={busy}
              onClick={() =>
                run(
                  () => setPaused(business.id, !business.paused),
                  business.paused ? "Queue reopened" : "Queue paused — no new joins",
                )
              }
            >
              {business.paused ? <Play className="size-4" /> : <Pause className="size-4" />}
              {business.paused ? "Resume queue" : "Pause queue"}
            </Button>
          </div>
          {business.paused && (
            <p className="mb-5 rounded-xl border border-dashed border-border bg-accent px-4 py-2.5 text-xs text-accent-foreground">
              Paused — people scanning your QR code can't take a number. Everyone
              already in line keeps their place.
            </p>
          )}
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
            Now serving
          </p>
          <p className="font-display text-[5.5rem] font-extrabold leading-none text-primary">
            {business.now_serving > 0 ? business.now_serving : "—"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {serving ? serving.customer_name : "Nobody is being served yet"}
          </p>

          <div className="mt-7 flex flex-wrap justify-center gap-2">
            <Button
              size="lg"
              className="rounded-full px-8"
              disabled={busy || waiting.length === 0}
              onClick={() =>
                run(
                  () => callNext(business, tickets),
                  waiting.length ? `Now serving #${waiting[0].number}` : undefined,
                )
              }
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              Call next
            </Button>
            {serving && (
              <Button
                size="lg"
                variant="outline"
                className="rounded-full"
                disabled={busy}
                onClick={() => run(() => setTicketStatus(serving.id, "served"), "Marked served")}
              >
                <Check className="size-4" /> Done
              </Button>
            )}
            <Button
              size="lg"
              variant="outline"
              className="rounded-full"
              disabled={busy || waiting.length === 0}
              onClick={() =>
                run(
                  () => skipNext(tickets),
                  waiting.length ? `Skipped #${waiting[0].number}` : undefined,
                )
              }
            >
              <SkipForward className="size-4" /> Skip next
            </Button>
          </div>
        </div>

        <div className="stub p-7">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">
              Waiting{" "}
              <span className="font-mono text-sm text-muted-foreground">
                ({waiting.length})
              </span>
            </h2>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-full text-muted-foreground"
                  disabled={busy || tickets.length === 0}
                >
                  <RotateCcw className="size-4" /> Reset
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Start the queue over?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This removes all {tickets.length} ticket
                    {tickets.length === 1 ? "" : "s"} and restarts numbering at 1.
                    Anyone still holding a number will be told their ticket is no
                    longer in line. This can't be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="rounded-full">Keep the queue</AlertDialogCancel>
                  <AlertDialogAction
                    className="rounded-full"
                    onClick={() => run(() => resetQueue(business.id), "Queue reset")}
                  >
                    Reset queue
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          {waiting.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Nobody in line. Show your QR code to get started.
            </p>
          ) : (
            <ul className="mt-5 divide-y divide-border">
              {waiting.map((t) => (
                <li key={t.id} className="flex items-center gap-4 py-3.5">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent font-mono text-sm font-semibold text-accent-foreground">
                    {t.number}
                  </span>
                  <span className="flex-1 font-medium">{t.customer_name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-full text-muted-foreground"
                    disabled={busy}
                    onClick={() => run(() => setTicketStatus(t.id, "skipped"), "Skipped")}
                  >
                    <SkipForward className="size-4" /> Skip
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Right Column: Branded QR Card with Customize button in corner */}
      <aside className="space-y-6">
        <div className="stub h-fit p-7 text-center">
          <div className="flex items-center justify-between border-b border-border pb-3 mb-5">
            <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Counter QR
            </span>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full text-xs gap-1.5 h-8 px-3"
              onClick={onOpenBranding}
            >
              <Palette className="size-3.5" /> Customize QR
            </Button>
          </div>

          {logoSrc && (
            <img
              src={logoSrc}
              alt={`${business.name} logo`}
              className="mx-auto mb-4 h-14 object-contain"
            />
          )}
          <h2 className="text-xl font-bold">{business.name}</h2>
          {business.address && (
            <p className="mt-1 flex items-center justify-center gap-1 text-xs text-muted-foreground">
              <MapPin className="size-3 text-primary shrink-0" />
              <span>{business.address}</span>
            </p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            Print this and stick it on the counter.
          </p>

          <div className="mt-6 rounded-2xl border border-dashed border-border bg-paper p-5">
            {qr ? (
              <img src={qr} alt={`QR code to join the ${business.name} queue`} className="w-full" />
            ) : (
              <div className="flex h-56 items-center justify-center">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
          <p className="mt-4 break-all font-mono text-xs text-muted-foreground">{joinUrl}</p>

          <div className="mt-5 flex gap-2">
            <Button
              variant="outline"
              className="flex-1 rounded-full"
              onClick={() => {
                navigator.clipboard.writeText(joinUrl);
                toast.success("Link copied");
              }}
            >
              <Copy className="size-4" /> Copy
            </Button>
            <Button asChild variant="outline" className="flex-1 rounded-full">
              <a href={qr || "#"} download={`${business.slug}-qr.png`}>
                <Download className="size-4" /> Save
              </a>
            </Button>
          </div>

          <Button
            className="mt-3 w-full rounded-full"
            disabled={!qr}
            onClick={() =>
              printPoster({
                businessName: business.name,
                address: business.address,
                message:
                  business.welcome_message?.trim() ||
                  "Scan to join the queue — no app, no sign-up.",
                qrDataUrl: qr,
                logoUrl: logoSrc,
                color: business.brand_color || DEFAULT_BRAND_COLOR,
                joinUrl,
              })
                ? undefined
                : toast.error("Allow pop-ups to print your poster")
            }
          >
            <Printer className="size-4" /> Print poster
          </Button>
        </div>
      </aside>
    </div>
  );
}

function BrandingStudioView({ business, refetch, onBack }) {
  const [name, setName] = useState(business.name);
  const [address, setAddress] = useState(business.address ?? "");
  const [color, setColor] = useState(business.brand_color || DEFAULT_BRAND_COLOR);
  const [message, setMessage] = useState(business.welcome_message ?? "");
  const [saving, setSaving] = useState(false);
  const [logoSrc, setLogoSrc] = useState(null);
  const [qr, setQr] = useState("");
  const fileRef = useRef(null);

  const joinUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/q/${business.slug}`;
  }, [business.slug]);

  useEffect(() => {
    setName(business.name);
    setAddress(business.address ?? "");
    setColor(business.brand_color || DEFAULT_BRAND_COLOR);
    setMessage(business.welcome_message ?? "");
  }, [business.id, business.name, business.address, business.brand_color, business.welcome_message]);

  useEffect(() => {
    let alive = true;
    logoUrl(business.logo_path).then((u) => {
      if (alive) setLogoSrc(u);
    });
    return () => {
      alive = false;
    };
  }, [business.logo_path]);

  useEffect(() => {
    if (!joinUrl) return;
    makeQrDataUrl(joinUrl, {
      color: color || DEFAULT_BRAND_COLOR,
      logoUrl: logoSrc,
    }).then(setQr);
  }, [joinUrl, color, logoSrc]);

  async function save() {
    setSaving(true);
    try {
      await updateBranding(business.id, {
        name: name.trim() || business.name,
        address: address.trim() || null,
        brand_color: color,
        welcome_message: message.trim() || null,
      });
      toast.success("Branding and QR settings saved!");
      refetch();
      onBack();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save branding");
    } finally {
      setSaving(false);
    }
  }

  async function onPickLogo(file) {
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Please pick an image under 2 MB");
      return;
    }
    setSaving(true);
    try {
      const path = await uploadLogo(business.owner_id, business.id, file);
      await updateBranding(business.id, { logo_path: path });
      toast.success("Logo uploaded successfully");
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not upload the logo");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* Top Bar with Back Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="size-4" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight">Branding & QR Customization</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Personalize your business name, address, colors, logo, and customer-facing QR code and posters.
          </p>
        </div>

        <Button variant="outline" className="rounded-full self-start" onClick={onBack}>
          <ArrowLeft className="size-4" /> Back to Queue
        </Button>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        {/* Customization Settings Column */}
        <div className="lg:col-span-6 space-y-6">
          <div className="stub p-7 space-y-6">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <SlidersHorizontal className="size-4 text-primary" />
              <h2 className="text-lg font-bold">Brand & Location Identity</h2>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bizname">Business display name</Label>
              <Input
                id="bizname"
                maxLength={60}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Corner Coffee & Bakery"
              />
              <p className="text-xs text-muted-foreground">
                Shown prominently at the top of your queue and print posters.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bizaddress">Business address / Location</Label>
              <Input
                id="bizaddress"
                maxLength={120}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. 124 Main Street, Ground Floor"
              />
              <p className="text-xs text-muted-foreground">
                Printed on your QR poster and shown on customer ticket pages.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Brand Logo</Label>
              <div className="flex items-center gap-4">
                <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-border bg-paper shadow-xs">
                  {logoSrc ? (
                    <img src={logoSrc} alt="Current logo" className="size-full object-contain p-2" />
                  ) : (
                    <QrCode className="size-7 text-muted-foreground/60" />
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-full"
                      disabled={saving}
                      onClick={() => fileRef.current?.click()}
                    >
                      <Upload className="size-3.5" /> {logoSrc ? "Replace Logo" : "Upload Logo"}
                    </Button>
                    {business.logo_path && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-full text-muted-foreground hover:text-destructive"
                        disabled={saving}
                        onClick={async () => {
                          await updateBranding(business.id, { logo_path: null });
                          toast.success("Logo removed");
                          refetch();
                        }}
                      >
                        <Trash2 className="size-3.5" /> Remove
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Embedded into the center of your QR code. PNG, JPG or SVG under 2 MB.
                  </p>
                </div>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) onPickLogo(file);
                }}
              />
            </div>

            <div className="space-y-2">
              <Label>Brand Accent Colour</Label>
              <div className="flex flex-wrap items-center gap-2.5">
                {BRAND_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    aria-label={`Use colour ${preset}`}
                    onClick={() => setColor(preset)}
                    className={`size-9 rounded-full border-2 transition-transform ${
                      color.toLowerCase() === preset.toLowerCase()
                        ? "border-foreground scale-110 shadow-sm ring-2 ring-primary/20"
                        : "border-transparent hover:scale-105"
                    }`}
                    style={{ backgroundColor: preset }}
                  />
                ))}
                <label className="flex items-center gap-2 rounded-full border border-border px-3.5 py-2 text-xs font-medium cursor-pointer hover:bg-accent/40">
                  <span>Custom:</span>
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="size-5 cursor-pointer border-0 bg-transparent p-0"
                  />
                  <span className="font-mono text-[11px] text-muted-foreground uppercase">{color}</span>
                </label>
              </div>
              <p className="text-xs text-muted-foreground">
                Used on your QR code, customer mobile buttons, and ticket badges.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="welcome">Welcome Note / Instructions</Label>
              <Textarea
                id="welcome"
                rows={2}
                maxLength={160}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Grab a seat — we'll call your number shortly."
              />
              <p className="text-xs text-muted-foreground">
                Displayed to customers when they scan the QR code to take a ticket.
              </p>
            </div>

            <div className="flex gap-3">
              <Button className="flex-1 rounded-full" size="lg" disabled={saving} onClick={save}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                Save Changes
              </Button>
              <Button variant="outline" size="lg" className="rounded-full" onClick={onBack}>
                Cancel
              </Button>
            </div>
          </div>
        </div>

        {/* Live Previews & Exports Column */}
        <div className="lg:col-span-6 space-y-6">
          {/* QR Code Hub */}
          <div className="stub p-7 text-center space-y-5">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <QrCode className="size-4 text-primary" />
                <h2 className="text-lg font-bold">Custom QR Code</h2>
              </div>
              <span className="font-mono text-xs text-muted-foreground">Real-time Preview</span>
            </div>

            <div className="relative mx-auto max-w-[260px] rounded-2xl border-2 border-dashed border-border bg-paper p-5 shadow-xs">
              {qr ? (
                <img src={qr} alt={`Branded QR code for ${name || business.name}`} className="w-full" />
              ) : (
                <div className="flex h-56 items-center justify-center">
                  <Loader2 className="size-6 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <p className="font-mono text-xs text-muted-foreground break-all bg-accent/40 rounded-lg p-2">
                {joinUrl}
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 rounded-full"
                  onClick={() => {
                    navigator.clipboard.writeText(joinUrl);
                    toast.success("Join link copied to clipboard");
                  }}
                >
                  <Copy className="size-3.5" /> Copy Link
                </Button>
                <Button asChild variant="outline" size="sm" className="flex-1 rounded-full">
                  <a href={qr || "#"} download={`${business.slug}-qr.png`}>
                    <Download className="size-3.5" /> Download QR
                  </a>
                </Button>
                <Button
                  size="sm"
                  className="flex-1 rounded-full"
                  disabled={!qr}
                  onClick={() =>
                    printPoster({
                      businessName: name || business.name,
                      address: address,
                      message:
                        message?.trim() ||
                        "Scan to join the queue — no app, no sign-up.",
                      qrDataUrl: qr,
                      logoUrl: logoSrc,
                      color: color || DEFAULT_BRAND_COLOR,
                      joinUrl,
                    })
                      ? undefined
                      : toast.error("Allow pop-ups to print your poster")
                  }
                >
                  <Printer className="size-3.5" /> Print Poster
                </Button>
              </div>
            </div>
          </div>

          {/* Customer Mobile View Preview */}
          <div className="stub p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Smartphone className="size-4 text-primary" />
                <h3 className="font-bold text-sm">Customer Mobile Screen Preview</h3>
              </div>
              <a
                href={joinUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                Open live page <ExternalLink className="size-3" />
              </a>
            </div>

            <div
              className="mx-auto max-w-[320px] rounded-2xl border border-border bg-paper p-5 text-center shadow-xs"
              style={brandStyle(color)}
            >
              {logoSrc && (
                <img
                  src={logoSrc}
                  alt="Logo preview"
                  className="mx-auto mb-3 h-10 object-contain"
                />
              )}
              <p className="font-display text-base font-bold">{name || business.name}</p>
              {address.trim() && (
                <p className="mt-1 flex items-center justify-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="size-3 text-primary shrink-0" />
                  <span>{address.trim()}</span>
                </p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                {message.trim() || "Take a number to join the line. We'll show your live position."}
              </p>

              <div className="mt-4 rounded-xl border border-dashed border-border bg-background p-3">
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Current Status
                </p>
                <p className="mt-1 font-display text-2xl font-black text-primary">
                  {business.now_serving > 0 ? `#${business.now_serving}` : "Ready"}
                </p>
                <p className="text-[11px] text-muted-foreground">Now Serving</p>
              </div>

              <Button size="sm" className="mt-4 w-full rounded-full pointer-events-none">
                Take a Number
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
