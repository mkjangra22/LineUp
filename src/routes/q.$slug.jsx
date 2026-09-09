import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Loader2,
  PartyPopper,
  MapPin,
  Bell,
  BellRing,
  Volume2,
  Sparkles,
  CheckCircle2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import {
  DEFAULT_BRAND_COLOR,
  getQueueInfo,
  getTicketStatus,
  joinQueue,
  logoUrl,
} from "@/lib/queue";
import { brandStyle } from "@/lib/brand";
import {
  unlockAudio,
  playTurnChime,
  vibratePhone,
  notifyCustomerTurn,
  requestNotificationPermission,
} from "@/lib/notifications";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/q/$slug")({
  head: () => ({
    meta: [
      { title: "Join the queue — LineUp" },
      {
        name: "description",
        content:
          "Enter your name to get a queue number and watch your place in line update live.",
      },
      { property: "og:title", content: "Join the queue — LineUp" },
      { property: "og:image", content: "/LineUp(Logo).png" },
      {
        name: "robots",
        content: "noindex",
      },
    ],
  }),
  component: JoinPage,
});

function storageKey(slug) {
  return `lineup-ticket:${slug}`;
}

function JoinPage() {
  const { slug } = Route.useParams();
  const [ticketId, setTicketId] = useState(null);
  const [hydrated, setHydrated] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [logo, setLogo] = useState(null);
  const [notifState, setNotifState] = useState("default");
  const [showTurnModal, setShowTurnModal] = useState(false);

  const prevStatusRef = useRef(null);

  useEffect(() => {
    setTicketId(window.localStorage.getItem(storageKey(slug)));
    setHydrated(true);

    if (typeof window !== "undefined" && "Notification" in window) {
      setNotifState(Notification.permission);
    } else {
      setNotifState("unsupported");
    }
  }, [slug]);

  // Unlock AudioContext on first tap anywhere
  useEffect(() => {
    const handleTouch = () => unlockAudio();
    window.addEventListener("click", handleTouch, { once: true });
    window.addEventListener("touchstart", handleTouch, { once: true });
    return () => {
      window.removeEventListener("click", handleTouch);
      window.removeEventListener("touchstart", handleTouch);
    };
  }, []);

  const infoQuery = useQuery({
    queryKey: ["queue-info", slug],
    queryFn: () => getQueueInfo(slug),
    refetchInterval: 5000,
  });

  const statusQuery = useQuery({
    queryKey: ["ticket", ticketId],
    queryFn: () => getTicketStatus(ticketId),
    enabled: !!ticketId,
    refetchInterval: 3500,
  });

  const status = statusQuery.data;

  // Detect transition to "serving" and trigger Audio + Vibration + Push + Modal
  useEffect(() => {
    if (!status) return;

    if (
      status.status === "serving" &&
      prevStatusRef.current !== "serving"
    ) {
      setShowTurnModal(true);
      notifyCustomerTurn({
        ticketNumber: status.ticket_number,
        businessName: status.business_name,
      });
    }

    prevStatusRef.current = status.status;
  }, [status]);

  async function onEnableNotifications() {
    unlockAudio();
    const perm = await requestNotificationPermission();
    setNotifState(perm);
    if (perm === "granted") {
      toast.success("Alerts enabled! We'll chime, vibrate, and notify you.");
    } else if (perm === "denied") {
      toast.error("Notification permission denied in browser settings.");
    }
  }

  async function onJoin(e) {
    e.preventDefault();
    setBusy(true);
    unlockAudio();

    try {
      const res = await joinQueue(slug, name);
      window.localStorage.setItem(storageKey(slug), res.ticket_id);
      setTicketId(res.ticket_id);
      toast.success(`You're number #${res.ticket_number}`);

      // Ask for notification permission right after joining if still default
      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
        requestNotificationPermission().then((p) => setNotifState(p));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not join the queue");
    } finally {
      setBusy(false);
    }
  }

  function leave() {
    window.localStorage.removeItem(storageKey(slug));
    setTicketId(null);
    setName("");
    setShowTurnModal(false);
    prevStatusRef.current = null;
  }

  const info = infoQuery.data ?? null;

  useEffect(() => {
    let alive = true;
    logoUrl(info?.logo_path).then((u) => {
      if (alive) setLogo(u);
    });
    return () => {
      alive = false;
    };
  }, [info?.logo_path]);

  const shell = (children) => (
    <div
      className="flex min-h-screen flex-col bg-background paper-grain"
      style={brandStyle(info?.brand_color || DEFAULT_BRAND_COLOR)}
    >
      <header className="mx-auto flex w-full max-w-lg items-center justify-center px-6 pt-5 pb-3 sm:pt-6 sm:pb-4">
        {logo ? (
          <img
            src={logo}
            alt={`${info?.business_name ?? "Business"} logo`}
            className="h-12 object-contain"
          />
        ) : (
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
        )}
      </header>
      <main className="flex flex-1 justify-center px-6 pt-3 pb-16 sm:pt-4">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );

  if (!hydrated || infoQuery.isLoading) {
    return shell(
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>,
    );
  }

  if (!infoQuery.data) {
    return shell(
      <div className="stub px-8 py-10 text-center">
        <h1 className="text-2xl font-extrabold">Queue not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This QR code doesn't point to an active queue. Ask the staff for help.
        </p>
      </div>,
    );
  }

  if (!info) return null;

  if (ticketId && status) {
    const isServing = status.status === "serving";
    const isDone = status.status === "served" || status.status === "skipped";

    return shell(
      <div className="space-y-4">
        {/* Fullscreen Turn Alert Modal */}
        {showTurnModal && isServing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="relative w-full max-w-sm rounded-3xl bg-card border-2 border-primary p-7 text-center shadow-2xl animate-in zoom-in-95 duration-200">
              <button
                type="button"
                onClick={() => setShowTurnModal(false)}
                className="absolute top-4 right-4 rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Close"
              >
                <X className="size-5" />
              </button>

              <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-primary/15 text-primary animate-bounce">
                <PartyPopper className="size-8" />
              </div>

              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                <Sparkles className="size-3.5" /> IT'S YOUR TURN!
              </span>

              <p className="mt-3 text-xs font-mono uppercase tracking-wider text-muted-foreground">
                {status.business_name}
              </p>

              <div className="my-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                  Your Number
                </p>
                <p className="font-display text-7xl font-black text-primary leading-none my-1">
                  #{status.ticket_number}
                </p>
              </div>

              <p className="text-sm font-medium text-foreground">
                Please step up to the counter now!
              </p>

              <div className="mt-6 flex flex-col gap-2.5">
                <Button
                  size="lg"
                  className="w-full rounded-full gap-2 font-bold shadow-md"
                  onClick={() => setShowTurnModal(false)}
                >
                  <CheckCircle2 className="size-4" /> I'm heading over
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Live Ticket Card */}
        <div
          className={`stub-notched px-8 py-10 text-center transition-all ${
            isServing
              ? "ring-4 ring-primary/40 border-primary bg-primary/5 animate-pulse"
              : ""
          }`}
        >
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
            {status.business_name}
          </p>
          {info.address && (
            <p className="mt-1 flex items-center justify-center gap-1 text-xs text-muted-foreground">
              <MapPin className="size-3 text-primary shrink-0" />
              <span>{info.address}</span>
            </p>
          )}

          <p className="mt-6 text-sm font-medium text-muted-foreground">Your number</p>
          <p className="font-display text-[6rem] font-extrabold leading-none text-primary">
            {status.ticket_number}
          </p>

          <div className="my-7 border-t border-dashed border-border" />

          {isServing ? (
            <div className="space-y-3">
              <p className="flex items-center justify-center gap-2 text-xl font-black text-primary animate-bounce">
                <PartyPopper className="size-6" /> It's your turn — head over!
              </p>
            </div>
          ) : isDone ? (
            <p className="text-lg font-bold text-muted-foreground">
              This ticket is closed.
            </p>
          ) : (
            <>
              <p className="text-3xl font-extrabold">
                {status.people_ahead === 0
                  ? "You're next!"
                  : `${status.people_ahead} ahead of you`}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Now serving {status.now_serving > 0 ? `#${status.now_serving}` : "nobody yet"}
              </p>
            </>
          )}
        </div>

        {/* Proactive Notification Controls Bar */}
        {!isDone && notifState !== "unsupported" && (
          <div className="rounded-2xl border border-border bg-card/60 p-3 text-center">
            {notifState !== "granted" ? (
              <Button
                variant="outline"
                size="sm"
                className="w-full rounded-full gap-1.5 text-xs text-muted-foreground border-dashed"
                onClick={onEnableNotifications}
              >
                <Bell className="size-3.5" /> Enable background push alert
              </Button>
            ) : (
              <p className="text-[11px] text-muted-foreground flex items-center justify-center gap-1.5 font-medium">
                <BellRing className="size-3.5 text-primary" /> Background push alert active
              </p>
            )}
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground">
          This page updates automatically — keep it open or in the background.
        </p>
        <Button variant="ghost" className="w-full rounded-full text-muted-foreground" onClick={leave}>
          Leave the queue
        </Button>
      </div>,
    );
  }

  return shell(
    <div className="stub px-8 py-9">
      <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
        Join the line
      </p>
      <h1 className="mt-3 text-3xl font-extrabold">{info.business_name}</h1>
      {info.address && (
        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="size-3.5 text-primary shrink-0" />
          <span>{info.address}</span>
        </p>
      )}
      {info.welcome_message?.trim() && (
        <p className="mt-2 text-sm text-muted-foreground">{info.welcome_message}</p>
      )}

      <div className="mt-5 flex gap-3">
        <div className="flex-1 rounded-xl border border-border bg-paper px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Now serving
          </p>
          <p className="font-display text-2xl font-bold">
            {info.now_serving > 0 ? info.now_serving : "—"}
          </p>
        </div>
        <div className="flex-1 rounded-xl border border-border bg-paper px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Waiting
          </p>
          <p className="font-display text-2xl font-bold">{info.waiting_count}</p>
        </div>
      </div>

      {info.paused ? (
        <div className="mt-7 rounded-xl border border-dashed border-border bg-paper px-5 py-6 text-center">
          <p className="font-display text-lg font-bold">Not taking new people right now</p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {info.business_name} has paused the queue. Keep this page open — it
            reopens on its own the moment they start taking names again.
          </p>
        </div>
      ) : (
        <form onSubmit={onJoin} className="mt-7 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Your name</Label>
            <Input
              id="name"
              required
              maxLength={60}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Mayank"
            />
          </div>
          <Button type="submit" size="lg" className="w-full rounded-full" disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            Get my number
          </Button>
        </form>
      )}
      {!info.paused && (
        <p className="mt-4 text-center text-xs text-muted-foreground">
          No account needed. Your phone will chime and vibrate when your turn arrives.
        </p>
      )}
    </div>,
  );
}
