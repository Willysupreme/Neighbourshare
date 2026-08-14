import Link from "next/link";

const SAMPLE_TAGS = [
  { name: "Cordless drill", code: "PWR-014", rotate: "-rotate-3" },
  { name: "Extension ladder", code: "LAD-002", rotate: "rotate-2" },
  { name: "Pressure washer", code: "PWR-009", rotate: "-rotate-1" },
  { name: "Wheelbarrow", code: "GDN-021", rotate: "rotate-3" },
];

export default function HomePage() {
  return (
    <div>
      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-2 md:items-center md:py-24">
        <div>
          <h1 className="display-heading text-5xl leading-[0.95] text-ink sm:text-6xl">
            Borrow what
            <br />
            you need from
            <br />
            <span className="text-rust">neighbors you</span>
            <br />
            <span className="text-rust">trust.</span>
          </h1>
          <p className="mt-6 max-w-md text-neutral-700">
            NeighborShare coordinates verified residents lending tools and equipment
            nearby - no more group-chat chaos over who has the ladder and when it&apos;s
            coming back.
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

        <div className="relative hidden h-80 md:block" aria-hidden="true">
          {SAMPLE_TAGS.map((tag, i) => (
            <div
              key={tag.code}
              className={`group absolute w-44 ${tag.rotate} cursor-default border border-line bg-paper-raised p-3 shadow-sm transition-transform hover:rotate-0`}
              style={{
                top: `${(i % 2) * 130}px`,
                left: `${i * 90}px`,
                backgroundImage:
                  "radial-gradient(circle at 50% 0, var(--paper) 3px, transparent 3.5px)",
                backgroundSize: "16px 100%",
                backgroundRepeat: "repeat-x",
                paddingTop: "14px",
              }}
            >
              <p className="font-tag text-[10px] uppercase tracking-widest text-ink/50">
                {tag.code}
              </p>
              <p className="mt-1 font-display text-lg uppercase leading-tight text-ink">
                {tag.name}
              </p>
              <p className="mt-2 inline-block rounded-sm bg-leaf-light px-1.5 py-0.5 font-tag text-[10px] uppercase tracking-wide text-leaf">
                Available
              </p>
            </div>
          ))}
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
