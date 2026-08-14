"use client";

import { useCallback, useEffect, useState } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { RequireAuth } from "@/context/RequireAuth";
import { authedFetch } from "@/lib/apiClient";
import { AppUser, Item, Booking, DamageReport } from "@/types";

type Tab = "overview" | "users" | "items" | "bookings" | "reports";

function AdminContent() {
  const [tab, setTab] = useState<Tab>("overview");
  const [users, setUsers] = useState<AppUser[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [reports, setReports] = useState<DamageReport[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [usersSnap, itemsSnap, bookingsSnap, reportsSnap] = await Promise.all([
      getDocs(collection(db, "users")),
      getDocs(collection(db, "items")),
      getDocs(query(collection(db, "bookings"), orderBy("createdAt", "desc"))),
      getDocs(collection(db, "damageReports")),
    ]);
    setUsers(usersSnap.docs.map((d) => d.data() as AppUser));
    setItems(itemsSnap.docs.map((d) => d.data() as Item));
    setBookings(bookingsSnap.docs.map((d) => d.data() as Booking));
    setReports(reportsSnap.docs.map((d) => d.data() as DamageReport));
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function toggleSuspend(user: AppUser) {
    const next = user.accountStatus === "active" ? "suspended" : "active";
    await authedFetch(`/api/admin/users/${user.uid}/suspend`, {
      method: "POST",
      body: JSON.stringify({ status: next }),
    });
    loadAll();
  }

  async function removeItem(itemId: string) {
    await authedFetch(`/api/admin/items/${itemId}/remove`, { method: "POST" });
    loadAll();
  }

  const openReports = reports.filter((r) => r.status === "OPEN").length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Admin dashboard</h1>

      <div className="mt-6 flex gap-2 border-b border-neutral-200 text-sm">
        {(["overview", "users", "items", "bookings", "reports"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`border-b-2 px-3 py-2 capitalize ${
              tab === t ? "border-emerald-600 font-medium text-emerald-700" : "border-transparent text-neutral-500"
            }`}
          >
            {t} {t === "reports" && openReports > 0 && `(${openReports})`}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="mt-8 text-sm text-neutral-500">Loading...</p>
      ) : (
        <div className="mt-6">
          {tab === "overview" && (
            <div className="grid grid-cols-4 gap-4">
              <Stat label="Users" value={users.length} />
              <Stat label="Listings" value={items.length} />
              <Stat label="Bookings" value={bookings.length} />
              <Stat label="Open reports" value={openReports} />
            </div>
          )}

          {tab === "users" && (
            <Table
              headers={["Name", "Email", "Neighborhood", "Status", "Trust", ""]}
              rows={users.map((u) => [
                u.name,
                u.email,
                u.neighborhoodId,
                <span
                  key="status"
                  className={`badge ${u.accountStatus === "active" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}
                >
                  {u.accountStatus}
                </span>,
                u.trustScore?.toFixed(1) ?? "—",
                u.role === "admin" ? (
                  <span key="admin" className="text-xs text-neutral-400">
                    admin
                  </span>
                ) : (
                  <button key="action" onClick={() => toggleSuspend(u)} className="btn-secondary">
                    {u.accountStatus === "active" ? "Suspend" : "Reinstate"}
                  </button>
                ),
              ])}
            />
          )}

          {tab === "items" && (
            <Table
              headers={["Name", "Category", "Status", ""]}
              rows={items.map((i) => [
                i.name,
                i.category,
                i.status,
                i.status !== "removed" ? (
                  <button key="remove" onClick={() => removeItem(i.id)} className="btn-secondary">
                    Remove listing
                  </button>
                ) : (
                  "—"
                ),
              ])}
            />
          )}

          {tab === "bookings" && (
            <Table
              headers={["Item", "Dates", "State"]}
              rows={bookings.map((b) => [b.itemId, `${b.startDate} → ${b.endDate}`, b.state])}
            />
          )}

          {tab === "reports" && (
            <Table
              headers={["Booking", "Severity", "Status", "Description"]}
              rows={reports.map((r) => [r.bookingId, r.severity, r.status, r.description])}
            />
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card text-center">
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-xs text-neutral-500">{label}</p>
    </div>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-neutral-500">Nothing here yet.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200">
      <table className="w-full text-left text-sm">
        <thead className="bg-neutral-50 text-xs uppercase text-neutral-500">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-4 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-2">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminPage() {
  return (
    <RequireAuth requireAdmin>
      <AdminContent />
    </RequireAuth>
  );
}
