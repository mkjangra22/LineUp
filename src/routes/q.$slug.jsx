import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, PartyPopper, MapPin } from "lucide-react";
import { toast } from "sonner";

import {
  DEFAULT_BRAND_COLOR,
  getQueueInfo,
  getTicketStatus,
  joinQueue,
  logoUrl,
} from "@/lib/queue";
import { brandStyle } from "@/lib/brand";
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

  useEffect(() => {
    setTicketId(window.localStorage.getItem(storageKey(slug)));
    setHydrated(true);
  }, [slug]);

  const infoQuery = useQuery({
    queryKey: ["queue-info", slug],
    queryFn: () => getQueueInfo(slug),
    refetchInterval: 5000,
  });

  const statusQuery = useQuery({
    queryKey: ["ticket", ticketId],
    queryFn: () => getTicketStatus(ticketId),
    enabled: !!ticketId,
    refetchInterval: 4000,
  });

  async function onJoin(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await joinQueue(slug, name);
      window.localStorage.setItem(storageKey(slug), res.ticket_id);
      setTicketId(res.ticket_id);
      toast.success(`You're number ${res.ticket_number}`);
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
      <header className="mx-auto flex w-full max-w-lg items-center justify-center px-6 py-7">
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
      <main className="flex flex-1 justify-center px-6 pb-16">
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
  const status = statusQuery.data;

  if (ticketId && status) {
    const isServing = status.status === "serving";
    const isDone = status.status === "served" || status.status === "skipped";

    return shell(
      <div className="space-y-4">
        <div className="stub-notched px-8 py-10 text-center">
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
            <p className="flex items-center justify-center gap-2 text-lg font-bold text-success">
              <PartyPopper className="size-5" /> It's your turn — head over!
            </p>
          ) : isDone ? (
            <p className="text-lg font-bold text-muted-foreground">
              This ticket is closed.
            </p>
          ) : (
            <>
              <p className="text-3xl font-extrabold">
                {status.people_ahead === 0
                  ? "You're next"
                  : `${status.people_ahead} ahead of you`}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Now serving {status.now_serving > 0 ? `#${status.now_serving}` : "nobody yet"}
              </p>
            </>
          )}
        </div>
        <p className="text-center text-xs text-muted-foreground">
          This page updates on its own — keep it open.
        </p>
        <Button variant="ghost" className="w-full rounded-full" onClick={leave}>
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
          No account needed. We only use your name to call you.
        </p>
      )}
    </div>,
  );
}
