import Link from "next/link";

const CAUGHT_ITEMS = [
  { name: "Cordless drill", ring: 1, spoke: 1 },
  { name: "Extension ladder", ring: 2, spoke: 3 },
  { name: "Pressure washer", ring: 1, spoke: 5 },
  { name: "Wheelbarrow", ring: 3, spoke: 7 },
];

// Precomputed 8-spoke orb-web geometry (Ananse's eight legs), center (200,200).
const RING_RADII = [55, 95, 135, 175];
const SPOKE_ANGLES_DEG = [-90, -45, 0, 45, 90, 135, 180, 225];

function pointOn(ring: number, spoke: number) {
  const r = RING_RADII[ring];
  const angle = (SPOKE_ANGLES_DEG[spoke] * Math.PI) / 180;
  return { x: 200 + r * Math.cos(angle), y: 200 + r * Math.sin(angle) };
}

export default function HomePage() {
  return (
    <div>
      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-2 md:items-center md:py-24">
        <div>
          <h1 className="display-heading text-5xl leading-[0.95] text-ink sm:text-6xl">
            A web of trust,
            <br />
            woven between
            <br />
            <span className="text-gold">neighbors.</span>
          </h1>
          <p className="mt-6 max-w-md text-neutral-700">
            Like Ananse spinning his threads, NeighborShare connects verified residents
            lending tools and equipment nearby - no more group-chat chaos over who has
            the ladder and when it&apos;s coming back.
          </p>
          <div className="mt-8 flex gap-3">
            <Link href="/register" className="btn-primary px-5 py-2.5 text-sm normal-case">
              Get started
            </Link>
            <Link href="/items" className="btn-secondary px-5 py-2.5 text-sm normal-case">
              Browse items
            </Link>
          </div>
        </div>

        <div className="relative hidden h-[400px] md:block" aria-hidden="true">
          <svg viewBox="0 0 400 400" className="h-full w-full">
            {SPOKE_ANGLES_DEG.map((deg, i) => {
              const angle = (deg * Math.PI) / 180;
              const x = 200 + RING_RADII[3] * Math.cos(angle);
              const y = 200 + RING_RADII[3] * Math.sin(angle);
              return (
                <line
                  key={i}
                  x1={200}
                  y1={200}
                  x2={x}
                  y2={y}
                  stroke="var(--web)"
                  strokeWidth="1"
                />
              );
            })}
            {RING_RADII.map((r) => {
              const pts = SPOKE_ANGLES_DEG.map((deg) => {
                const angle = (deg * Math.PI) / 180;
                return `${200 + r * Math.cos(angle)},${200 + r * Math.sin(angle)}`;
              }).join(" ");
              return (
                <polygon key={r} points={pts} fill="none" stroke="var(--web)" strokeWidth="1" />
              );
            })}
            {/* Ananse at the center of his web */}
            <g transform="translate(200,200)">
              <circle r="10" fill="var(--ink)" />
              {[...Array(8)].map((_, i) => {
                const angle = (i * 45 * Math.PI) / 180;
                return (
                  <line
                    key={i}
                    x1={0}
                    y1={0}
                    x2={16 * Math.cos(angle)}
                    y2={16 * Math.sin(angle)}
                    stroke="var(--ink)"
                    strokeWidth="1.5"
                  />
                );
              })}
            </g>
            {CAUGHT_ITEMS.map((item) => {
              const { x, y } = pointOn(item.ring, item.spoke);
              return <circle key={item.name} cx={x} cy={y} r="5" fill="var(--gold)" />;
            })}
          </svg>

          {CAUGHT_ITEMS.map((item) => {
            const { x, y } = pointOn(item.ring, item.spoke);
            return (
              <div
                key={item.name}
                className="absolute w-32 -translate-x-1/2 rounded-sm border border-line bg-paper-raised px-2 py-1 text-center shadow-sm"
                style={{ left: `${(x / 400) * 100}%`, top: `${(y / 400) * 100}%` }}
              >
                <p className="font-tag text-[10px] uppercase tracking-wide text-ink/80">
                  {item.name}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="border-t border-line bg-paper-raised py-14">
        <div className="mx-auto grid max-w-4xl gap-8 px-4 sm:grid-cols-3">
          <Feature
            title="Verified neighborhoods"
            body="Join with a neighborhood code so you know who you're borrowing from."
          />
          <Feature
            title="No double-booking"
            body="Every request is checked against existing bookings in real time, catching conflicts before they happen."
          />
          <Feature
            title="Full loan history"
            body="Track condition, pickup, return, and reviews for every item you lend or borrow."
          />
        </div>
      </section>
    </div>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h3 className="font-display text-lg uppercase tracking-tight text-ink">{title}</h3>
      <p className="mt-1 text-sm text-neutral-600">{body}</p>
    </div>
  );
}
