"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/context/AuthContext";
import { RequireAuth } from "@/context/RequireAuth";
import { BookingActions } from "@/components/BookingActions";
import { ClaimTag } from "@/components/ClaimTag";
import { getTimeBasedGreeting, firstNameOf } from "@/lib/greeting";
import { Booking, Item } from "@/types";

function DashboardContent() {
  const { profile } = useAuth();
  const [view, setView] = useState<"owner" | "borrower">("owner");
  const [items, setItems] = useState<Item[]>([]);
  const [ownerBookings, setOwnerBookings] = useState<Booking[]>([]);
  const [borrowerBookings, setBorrowerBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    const [itemsSnap, ownerSnap, borrowerSnap] = await Promise.all([
      getDocs(query(collection(db, "items"), where("ownerId", "==", profile.uid))),
      getDocs(query(collection(db, "bookings"), where("ownerId", "==", profile.uid))),
      getDocs(query(collection(db, "bookings"), where("borrowerId", "==", profile.uid))),
    ]);
    setItems(itemsSnap.docs.map((d) => d.data() as Item));
    setOwnerBookings(ownerSnap.docs.map((d) => d.data() as Booking));
    setBorrowerBookings(borrowerSnap.docs.map((d) => d.data() as Booking));
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    // Same justified pattern as admin/page.tsx - see comment there.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAll();
  }, [loadAll]);

  if (!profile) return null;

  const greeting = getTimeBasedGreeting(new Date().getHours());
  const availableCount = items.filter((i) => i.status === "active").length;
  const pendingRequests = ownerBookings.filter((b) => b.state === "REQUESTED");

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="display-heading text-3xl">
            {greeting}, {firstNameOf(profile.name)}
          </h1>
          <p className="mt-0.5 font-tag text-xs uppercase tracking-wide text-neutral-400">Dashboard</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/blocked" className="text-xs text-neutral-500 hover:text-ink hover:underline">
            Blocked users
          </Link>
          <Link href="/dashboard/wishlist" className="text-xs text-neutral-500 hover:text-ink hover:underline">
            Wishlist
          </Link>
          <Link href="/dashboard/settings" className="text-xs text-neutral-500 hover:text-ink hover:underline">
            Settings
          </Link>
          <div className="flex gap-2 rounded-md bg-neutral-100 p-1 text-sm">
            <button
              onClick={() => setView("owner")}
              className={`rounded px-3 py-1 ${view === "owner" ? "bg-white shadow-sm font-medium" : "text-neutral-500"}`}
            >
              As owner
            </button>
            <button
              onClick={() => setView("borrower")}
              className={`rounded px-3 py-1 ${view === "borrower" ? "bg-white shadow-sm font-medium" : "text-neutral-500"}`}
            >
              As borrower
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <p className="mt-8 text-sm text-neutral-500">Loading...</p>
      ) : view === "owner" ? (
        <OwnerView
          items={items}
          bookings={ownerBookings}
          pendingCount={pendingRequests.length}
          availableCount={availableCount}
          onChanged={loadAll}
        />
      ) : (
        <BorrowerView bookings={borrowerBookings} onChanged={loadAll} />
      )}
    </div>
  );
}

function OwnerView({
  items,
  bookings,
  pendingCount,
  availableCount,
  onChanged,
}: {
  items: Item[];
  bookings: Booking[];
  pendingCount: number;
  availableCount: number;
  onChanged: () => void;
}) {
  const upcoming = bookings.filter((b) => ["APPROVED", "RESERVED"].includes(b.state));
  const active = bookings.filter((b) => ["PICKED_UP", "IN_USE"].includes(b.state));

  return (
    <div className="mt-6 space-y-8">
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Listed items" value={items.length} />
        <StatCard label="Available" value={availableCount} />
        <StatCard label="Pending requests" value={pendingCount} />
      </div>

      <Section title="Pending requests">
        {bookings.filter((b) => b.state === "REQUESTED").length === 0 ? (
          <EmptyNote text="No pending requests." />
        ) : (
          bookings
            .filter((b) => b.state === "REQUESTED")
            .map((b) => <BookingRow key={b.id} booking={b} role="owner" onChanged={onChanged} />)
        )}
      </Section>

      <Section title="Upcoming & active loans">
        {[...upcoming, ...active].length === 0 ? (
          <EmptyNote text="Nothing upcoming right now." />
        ) : (
          [...upcoming, ...active].map((b) => (
            <BookingRow key={b.id} booking={b} role="owner" onChanged={onChanged} />
          ))
        )}
      </Section>

      <Section title="My items">
        {items.length === 0 ? (
          <EmptyNote text="You haven't listed any items yet." link="/items/new" linkText="List your first item" />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {items.map((item) => (
              <div key={item.id} className="card">
                <div className="flex items-center justify-between">
                  <Link href={`/items/${item.id}`} className="font-medium hover:underline">
                    {item.name}
                  </Link>
                  <span
                    className={`badge ${item.status === "active" ? "bg-leaf-light text-leaf" : "bg-neutral-200 text-neutral-600"}`}
                  >
                    {item.status}
                  </span>
                </div>
                <Link href={`/items/${item.id}/edit`} className="mt-2 inline-block text-xs text-leaf hover:underline">
                  Edit listing →
                </Link>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function BorrowerView({ bookings, onChanged }: { bookings: Booking[]; onChanged: () => void }) {
  const requests = bookings.filter((b) => b.state === "REQUESTED");
  const upcoming = bookings.filter((b) => ["APPROVED", "RESERVED"].includes(b.state));
  const active = bookings.filter((b) => ["PICKED_UP", "IN_USE"].includes(b.state));
  const history = bookings.filter((b) => ["COMPLETED", "DECLINED", "CANCELLED", "RETURNED"].includes(b.state));

  return (
    <div className="mt-6 space-y-8">
      <Section title="Pending requests">
        {requests.length === 0 ? (
          <EmptyNote text="No pending requests." link="/items" linkText="Browse items to borrow" />
        ) : (
          requests.map((b) => <BookingRow key={b.id} booking={b} role="borrower" onChanged={onChanged} />)
        )}
      </Section>

      <Section title="Active loans">
        {active.length === 0 ? (
          <EmptyNote text="No active loans." />
        ) : (
          active.map((b) => <BookingRow key={b.id} booking={b} role="borrower" onChanged={onChanged} />)
        )}
      </Section>

      <Section title="Upcoming">
        {upcoming.length === 0 ? (
          <EmptyNote text="Nothing upcoming." />
        ) : (
          upcoming.map((b) => <BookingRow key={b.id} booking={b} role="borrower" onChanged={onChanged} />)
        )}
      </Section>

      <Section title="History">
        {history.length === 0 ? (
          <EmptyNote text="No past bookings yet." />
        ) : (
          history.map((b) => <BookingRow key={b.id} booking={b} role="borrower" onChanged={onChanged} />)
        )}
      </Section>
    </div>
  );
}

function BookingRow({
  booking,
  role,
  onChanged,
}: {
  booking: Booking;
  role: "owner" | "borrower";
  onChanged: () => void;
}) {
  const otherPartyLabel = role === "owner" ? `Requested by ${booking.borrowerName}` : `Owned by ${booking.ownerName}`;

  return (
    <div className="card mb-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium">{booking.itemName}</p>
          <p className="text-sm text-neutral-600">
            {otherPartyLabel} · {booking.startDate} → {booking.endDate}
          </p>
          {booking.note && <p className="text-xs text-neutral-500">&ldquo;{booking.note}&rdquo;</p>}
          {role === "owner" && booking.state === "REQUESTED" && (
            <p className="mt-1 flex items-center gap-2 font-tag text-xs">
              <span className="text-ochre">★ {booking.borrowerTrustScore?.toFixed(1) ?? "—"} trust score</span>
              {booking.borrowerVerified ? (
                <span className="text-leaf">✓ Verified neighbor</span>
              ) : (
                <span className="text-clay">Not yet verified</span>
              )}
            </p>
          )}
        </div>
        <ClaimTag state={booking.state} />
      </div>
      <BookingActions booking={booking} viewerRole={role} onChanged={onChanged} />
      {booking.state === "COMPLETED" && (
        <Link href={`/dashboard/bookings/${booking.id}`} className="mt-2 inline-block text-xs text-leaf hover:underline">
          Leave a review / view details →
        </Link>
      )}
      {["RETURNED", "IN_USE", "PICKED_UP"].includes(booking.state) && (
        <Link href={`/dashboard/bookings/${booking.id}`} className="mt-2 inline-block text-xs text-neutral-500 hover:underline">
          Report an issue →
        </Link>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">{title}</h2>
      {children}
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="card text-center">
      <p className="display-heading text-3xl">{value}</p>
      <p className="text-xs text-neutral-500">{label}</p>
    </div>
  );
}

function EmptyNote({ text, link, linkText }: { text: string; link?: string; linkText?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500">
      <p>{text}</p>
      {link && linkText && (
        <Link href={link} className="mt-2 inline-block font-medium text-leaf hover:underline">
          {linkText}
        </Link>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <RequireAuth>
      <DashboardContent />
    </RequireAuth>
  );
}
