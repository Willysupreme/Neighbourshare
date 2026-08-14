import Link from "next/link";

export default function HomePage() {
  return (
    <div>
      <section className="mx-auto max-w-4xl px-4 py-20 text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-neutral-900">
          Share tools with neighbors you can trust.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-neutral-600">
          NeighborShare helps verified residents borrow and lend tools and equipment nearby -
          without the group-chat chaos of tracking who has what and when it&apos;s coming back.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/register" className="btn-primary px-5 py-2.5 text-base">
            Get started
          </Link>
          <Link href="/items" className="btn-secondary px-5 py-2.5 text-base">
            Browse items
          </Link>
        </div>
      </section>

      <section className="border-t border-neutral-200 bg-white py-16">
        <div className="mx-auto grid max-w-4xl gap-8 px-4 sm:grid-cols-3">
          <Feature
            title="Verified neighborhoods"
            body="Join with a neighborhood verification code so you know who you're borrowing from."
          />
          <Feature
            title="No double-booking"
            body="Every request is checked against existing bookings in real time, so conflicts get caught before they happen."
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
      <h3 className="font-medium text-neutral-900">{title}</h3>
      <p className="mt-1 text-sm text-neutral-600">{body}</p>
    </div>
  );
}
