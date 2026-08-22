import { createFileRoute, Link } from "@tanstack/react-router";
import { QrCode, Users, BellRing, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Smart Queue — turn your line into a QR code" },
      {
        name: "description",
        content:
          "Print one QR code. Customers scan, enter their name, and get a queue number. You call the next person from a live dashboard.",
      },
      { property: "og:title", content: "Smart Queue — turn your line into a QR code" },
      {
        property: "og:description",
        content:
          "One QR code on the counter. Customers join the line from their phone. You call the next person from a live dashboard.",
      },
    ],
  }),
  component: Landing,
});

const steps = [
  {
    icon: QrCode,
    title: "Print one QR code",
    body: "Every business gets its own code. Stick it on the counter or the door.",
  },
  {
    icon: Users,
    title: "Customers join instantly",
    body: "They scan, type their name and get a queue number. No login, no download.",
  },
  {
    icon: BellRing,
    title: "Call the next person",
    body: "Your dashboard updates live. One tap moves the next customer to Now Serving.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background paper-grain">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl warm-gradient text-primary-foreground">
            <QrCode className="size-5" />
          </span>
          <span className="font-display text-lg font-bold tracking-tight">Smart Queue</span>
        </div>
        <Link
          to="/auth"
          search={{ mode: "login" }}
          className="rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold transition-colors hover:bg-accent"
        >
          Owner login
        </Link>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-14 px-6 pb-8 pt-10 lg:grid-cols-[1.1fr_0.9fr] lg:pt-20">
          <div>
            <span className="inline-flex items-center rounded-full border border-border bg-card px-3 py-1 font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              No waiting-room chaos
            </span>
            <h1 className="mt-6 text-5xl font-extrabold leading-[0.95] sm:text-6xl lg:text-7xl">
              Turn your line
              <br />
              into a{" "}
              <span className="bg-gradient-to-r from-primary to-chart-2 bg-clip-text text-transparent">
                QR code
              </span>
              .
            </h1>
            <p className="mt-6 max-w-lg text-lg text-muted-foreground">
              Customers scan, enter their name and get a queue number. You call the next
              person from a live dashboard. That's the whole product.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                to="/auth"
                search={{ mode: "signup" }}
                className="inline-flex items-center gap-2 rounded-full warm-gradient px-6 py-3.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-stub)] transition-transform hover:-translate-y-0.5"
              >
                Create your queue <ArrowRight className="size-4" />
              </Link>
              <Link
                to="/auth"
                search={{ mode: "login" }}
                className="inline-flex items-center rounded-full border border-border bg-card px-6 py-3.5 text-sm font-semibold transition-colors hover:bg-accent"
              >
                I already have an account
              </Link>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-sm">
            <div className="stub-notched px-8 py-9">
              <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
                Now serving
              </p>
              <p className="font-display text-8xl font-extrabold leading-none text-primary">
                A-42
              </p>
              <div className="my-6 border-t border-dashed border-border" />
              <ul className="space-y-3 text-sm">
                {[
                  ["43", "Priya"],
                  ["44", "Marcus"],
                  ["45", "Dana"],
                ].map(([n, who]) => (
                  <li key={n} className="flex items-center justify-between">
                    <span className="text-muted-foreground">{who}</span>
                    <span className="font-mono font-semibold">#{n}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="absolute -bottom-5 -right-4 rotate-[-6deg] rounded-xl border border-border bg-card px-4 py-2 font-mono text-xs shadow-[var(--shadow-stub)]">
              3 waiting
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-20">
          <div className="grid gap-5 md:grid-cols-3">
            {steps.map((s, i) => (
              <article key={s.title} className="stub lift-hover p-7">
                <div className="flex items-center justify-between">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                    <s.icon className="size-5" />
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    0{i + 1}
                  </span>
                </div>
                <h2 className="mt-5 text-xl font-bold">{s.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {s.body}
                </p>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-10 text-center text-sm text-muted-foreground">
        Smart Queue — one QR code, zero waiting-room confusion.
      </footer>
    </div>
  );
}
