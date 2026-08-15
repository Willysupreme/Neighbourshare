"use client";

import { useCallback, useEffect, useState } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { RequireAuth } from "@/context/RequireAuth";
import { authedFetch } from "@/lib/apiClient";
import { formatRelativeTime } from "@/lib/formatRelativeTime";
import { AppUser, Item, Booking, DamageReport, AuditLogEntry, NeighborhoodVerificationRequest, Message, AccountRestriction } from "@/types";

type Tab = "overview" | "users" | "items" | "bookings" | "reports" | "audit" | "verification";

function AdminContent() {
  const [tab, setTab] = useState<Tab>("overview");
  const [users, setUsers] = useState<AppUser[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [reports, setReports] = useState<DamageReport[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [restrictions, setRestrictions] = useState<AccountRestriction[]>([]);
  const [verificationRequests, setVerificationRequests] = useState<NeighborhoodVerificationRequest[]>([]);
  const [viewedConversation, setViewedConversation] = useState<{ bookingId: string; messages: Message[] } | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [usersSnap, itemsSnap, bookingsSnap, reportsSnap, auditSnap, verificationSnap, restrictionsSnap] = await Promise.all([
      getDocs(collection(db, "users")),
      getDocs(collection(db, "items")),
      getDocs(query(collection(db, "bookings"), orderBy("createdAt", "desc"))),
      getDocs(collection(db, "damageReports")),
      getDocs(query(collection(db, "auditLogs"), orderBy("createdAt", "desc"))),
      getDocs(query(collection(db, "neighbourhoodVerificationRequests"), orderBy("createdAt", "desc"))),
      getDocs(collection(db, "accountRestrictions")),
    ]);
    setUsers(usersSnap.docs.map((d) => d.data() as AppUser));
    setItems(itemsSnap.docs.map((d) => d.data() as Item));
    setBookings(bookingsSnap.docs.map((d) => d.data() as Booking));
    setReports(reportsSnap.docs.map((d) => d.data() as DamageReport));
    setAuditLogs(auditSnap.docs.map((d) => d.data() as AuditLogEntry));
    setVerificationRequests(verificationSnap.docs.map((d) => d.data() as NeighborhoodVerificationRequest));
    setRestrictions(restrictionsSnap.docs.map((d) => d.data() as AccountRestriction));
    setLoading(false);
  }, []);

  useEffect(() => {
    // loadAll sets `loading` before/after its async Firestore reads - a
    // standard fetch-on-mount pattern. Deps array prevents re-fire loops.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAll();
  }, [loadAll]);

  async function toggleSuspend(user: AppUser) {
    const next = user.accountStatus === "active" ? "suspended" : "active";
    const confirmMsg =
      next === "suspended"
        ? `Suspend ${user.name}'s account? They won't be able to log in or make new bookings until reinstated.`
        : `Reinstate ${user.name}'s account?`;
    if (!window.confirm(confirmMsg)) return;

    await authedFetch(`/api/admin/users/${user.uid}/suspend`, {
      method: "POST",
      body: JSON.stringify({ status: next }),
    });
    loadAll();
  }

  async function removeItem(itemId: string, itemName: string) {
    if (!window.confirm(`Remove "${itemName}" from the platform? This can't be undone from here.`)) return;
    await authedFetch(`/api/admin/items/${itemId}/remove`, { method: "POST" });
    loadAll();
  }

  async function reviewRequest(requestId: string, decision: "approved" | "rejected", userName: string) {
    const verb = decision === "approved" ? "Approve" : "Reject";
    if (!window.confirm(`${verb} ${userName}'s verification request?`)) return;
    await authedFetch(`/api/admin/verification-requests/${requestId}/review`, {
      method: "POST",
      body: JSON.stringify({ decision }),
    });
    loadAll();
  }

  async function applyRestriction(user: AppUser) {
    const type = window.prompt(
      `Restrict ${user.name} - type exactly one of:\ncannot_book\ncannot_list\ncannot_message\nlisting_hidden`
    );
    if (!type) return;
    if (!["cannot_book", "cannot_list", "cannot_message", "listing_hidden"].includes(type)) {
      window.alert("Not a recognised restriction type - nothing was applied.");
      return;
    }
    const reason = window.prompt("Reason for this restriction (at least 10 characters):");
    if (!reason || reason.trim().length < 10) {
      if (reason !== null) window.alert("Reason must be at least 10 characters - nothing was applied.");
      return;
    }
    await authedFetch(`/api/admin/users/${user.uid}/restrictions`, {
      method: "POST",
      body: JSON.stringify({ restrictionType: type, reason: reason.trim() }),
    });
    loadAll();
  }

  async function liftRestriction(restriction: AccountRestriction) {
    if (!window.confirm(`Lift the "${restriction.restrictionType}" restriction?`)) return;
    await authedFetch(`/api/admin/restrictions/${restriction.id}/lift`, { method: "POST" });
    loadAll();
  }

  async function toggleRepresentative(user: AppUser) {
    const nextRole = user.role === "representative" ? "user" : "representative";
    const confirmMsg =
      nextRole === "representative"
        ? `Make ${user.name} a neighbourhood representative? They'll be able to list items on behalf of residents in their own neighbourhood.`
        : `Remove ${user.name}'s representative status?`;
    if (!window.confirm(confirmMsg)) return;
    await authedFetch(`/api/admin/users/${user.uid}/role`, {
      method: "POST",
      body: JSON.stringify({ role: nextRole }),
    });
    loadAll();
  }

  async function viewConversation(bookingId: string) {
    const reason = window.prompt(
      "Reason for accessing this conversation (e.g. dispute investigation, abuse report). This is logged."
    );
    if (!reason || reason.trim().length < 10) {
      if (reason !== null) {
        window.alert("Please give a reason of at least 10 characters.");
      }
      return;
    }
    try {
      const result = await authedFetch(`/api/admin/bookings/${bookingId}/messages`, {
        method: "POST",
        body: JSON.stringify({ reason: reason.trim() }),
      });
      setViewedConversation({ bookingId, messages: result.messages });
      loadAll(); // refresh so the new audit log entry shows up immediately
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  const openReports = reports.filter((r) => r.status === "OPEN").length;
  const pendingVerifications = verificationRequests.filter((v) => v.status === "PENDING").length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="display-heading text-3xl">Admin dashboard</h1>

      <div className="mt-6 flex gap-2 border-b border-neutral-200 text-sm">
        {(["overview", "users", "items", "bookings", "reports", "audit", "verification"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`border-b-2 px-3 py-2 capitalize ${
              tab === t ? "border-gold font-medium text-leaf" : "border-transparent text-neutral-500"
            }`}
          >
            {t} {t === "reports" && openReports > 0 && `(${openReports})`}
            {t === "verification" && pendingVerifications > 0 && ` (${pendingVerifications})`}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="mt-8 text-sm text-neutral-500">Loading...</p>
      ) : (
        <div className="mt-6">
          {tab === "overview" && (
            <div className="space-y-8">
              <div className="grid grid-cols-4 gap-4">
                <Stat label="Users" value={users.length} />
                <Stat label="Listings" value={items.length} />
                <Stat label="Bookings" value={bookings.length} />
                <Stat label="Open reports" value={openReports} />
              </div>

              <div className="grid gap-6 sm:grid-cols-3">
                <BreakdownCard title="Listings by category" counts={countBy(items, (i) => i.category)} />
                <BreakdownCard title="Bookings by state" counts={countBy(bookings, (b) => b.state)} />
                <BreakdownCard
                  title="Users by verification"
                  counts={countBy(users, (u) => u.verificationStatus)}
                />
              </div>
            </div>
          )}

          {tab === "users" && (
            <Table
              headers={["Name", "Email", "Neighborhood", "Role", "Status", "Trust", ""]}
              rows={users.map((u) => [
                u.name,
                u.email,
                u.neighborhoodId,
                u.role,
                <span
                  key="status"
                  className={`badge ${u.accountStatus === "active" ? "bg-leaf-light text-leaf" : "bg-red-100 text-red-700"}`}
                >
                  {u.accountStatus}
                </span>,
                u.trustScore?.toFixed(1) ?? "—",
                u.role === "admin" ? (
                  <span key="admin" className="text-xs text-neutral-400">
                    admin
                  </span>
                ) : (
                  <div key="actions" className="flex flex-col gap-1">
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => toggleSuspend(u)} className="btn-secondary">
                        {u.accountStatus === "active" ? "Suspend" : "Reinstate"}
                      </button>
                      <button onClick={() => toggleRepresentative(u)} className="btn-secondary">
                        {u.role === "representative" ? "Revoke rep." : "Make rep."}
                      </button>
                      <button onClick={() => applyRestriction(u)} className="btn-secondary">
                        Restrict...
                      </button>
                    </div>
                    {(u.activeRestrictions?.length ?? 0) > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {u.activeRestrictions!.map((r) => {
                          const active = restrictions.find(
                            (rec) => rec.userId === u.uid && rec.restrictionType === r && rec.status === "active"
                          );
                          return (
                            <button
                              key={r}
                              onClick={() => active && liftRestriction(active)}
                              className="badge bg-ochre-light text-ochre"
                              title="Click to lift"
                            >
                              {r.replace(/_/g, " ")} ✕
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
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
                  <button key="remove" onClick={() => removeItem(i.id, i.name)} className="btn-secondary">
                    Remove listing
                  </button>
                ) : (
                  "—"
                ),
              ])}
            />
          )}

          {tab === "bookings" && (
            <>
              <Table
                headers={["Item", "Borrower", "Owner", "Dates", "State", ""]}
                rows={bookings.map((b) => [
                  b.itemName,
                  b.borrowerName,
                  b.ownerName,
                  `${b.startDate} → ${b.endDate}`,
                  b.state,
                  <button key="view" onClick={() => viewConversation(b.id)} className="btn-secondary text-xs">
                    View chat
                  </button>,
                ])}
              />
              {viewedConversation && (
                <div className="card mt-4">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-medium">Conversation - booking {viewedConversation.bookingId}</p>
                    <button onClick={() => setViewedConversation(null)} className="text-xs text-neutral-400 hover:underline">
                      Close
                    </button>
                  </div>
                  {viewedConversation.messages.length === 0 ? (
                    <p className="text-xs text-neutral-500">No messages in this conversation.</p>
                  ) : (
                    <div className="max-h-64 space-y-1 overflow-y-auto">
                      {viewedConversation.messages.map((m) => (
                        <p key={m.id} className="text-xs">
                          <span className="font-medium">{m.senderName}:</span> {m.text}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {tab === "reports" && (
            <Table
              headers={["Item", "Severity", "Status", "Description"]}
              rows={reports.map((r) => [
                bookings.find((b) => b.id === r.bookingId)?.itemName ?? r.bookingId,
                r.severity,
                r.status,
                r.description,
              ])}
            />
          )}

          {tab === "audit" && (
            <Table
              headers={["When", "Actor", "Action", "Target", "Details"]}
              rows={auditLogs.map((log) => [
                formatRelativeTime(toDateString(log.createdAt)),
                log.actorName,
                log.action.replace(/_/g, " "),
                `${log.targetType}:${log.targetId}`,
                log.details ?? "—",
              ])}
            />
          )}

          {tab === "verification" && (
            <Table
              headers={["User", "Neighborhood", "Method", "Details", "Status", ""]}
              rows={verificationRequests.map((v) => [
                v.userName,
                v.neighborhoodName,
                v.verificationMethod.replace(/_/g, " "),
                v.plusCode ?? v.notes ?? (v.approximateLatitude ? `~${v.approximateLatitude.toFixed(3)}, ${v.approximateLongitude?.toFixed(3)}` : "—"),
                <span
                  key="status"
                  className={`badge ${
                    v.status === "APPROVED"
                      ? "bg-leaf-light text-leaf"
                      : v.status === "REJECTED"
                        ? "bg-red-100 text-red-700"
                        : "bg-ochre-light text-ochre"
                  }`}
                >
                  {v.status}
                </span>,
                v.status === "PENDING" || v.status === "UNDER_REVIEW" ? (
                  <div key="actions" className="flex gap-2">
                    <button onClick={() => reviewRequest(v.id, "approved", v.userName)} className="btn-primary">
                      Approve
                    </button>
                    <button onClick={() => reviewRequest(v.id, "rejected", v.userName)} className="btn-secondary">
                      Reject
                    </button>
                  </div>
                ) : (
                  "—"
                ),
              ])}
            />
          )}
        </div>
      )}
    </div>
  );
}

// createdAt fields are typed as `string` for convenience but Firestore
// actually returns Timestamp objects at runtime - normalize before parsing.
function toDateString(value: unknown): string {
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return (value.toDate() as Date).toISOString();
  }
  if (typeof value === "string") return value;
  return new Date(0).toISOString();
}

function countBy<T>(items: T[], keyFn: (item: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const key = keyFn(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function BreakdownCard({ title, counts }: { title: string; counts: Record<string, number> }) {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return (
    <div className="card">
      <p className="mb-2 text-sm font-medium">{title}</p>
      {entries.length === 0 ? (
        <p className="text-xs text-neutral-400">No data yet.</p>
      ) : (
        <div className="space-y-1">
          {entries.map(([label, count]) => (
            <div key={label} className="flex items-center justify-between text-xs">
              <span className="capitalize text-neutral-600">{label.replace(/_/g, " ")}</span>
              <span className="font-tag font-medium">{count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card text-center">
      <p className="display-heading text-3xl">{value}</p>
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
