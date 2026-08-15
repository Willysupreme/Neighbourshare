"use client";

import { useCallback, useEffect, useState } from "react";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/context/AuthContext";
import { RequireAuth } from "@/context/RequireAuth";
import { authedFetch } from "@/lib/apiClient";
import { NeighborhoodVerificationRequest } from "@/types";

function VerificationReviewContent() {
  const { profile } = useAuth();
  const [requests, setRequests] = useState<NeighborhoodVerificationRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile?.neighborhoodId) return;
    setLoading(true);
    const snap = await getDocs(
      query(
        collection(db, "neighbourhoodVerificationRequests"),
        where("neighborhoodId", "==", profile.neighborhoodId),
        orderBy("createdAt", "desc")
      )
    );
    setRequests(snap.docs.map((d) => d.data() as NeighborhoodVerificationRequest));
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function review(requestId: string, decision: "approved" | "rejected", userName: string) {
    if (!window.confirm(`${decision === "approved" ? "Approve" : "Reject"} ${userName}'s verification request?`)) return;
    try {
      await authedFetch(`/api/admin/verification-requests/${requestId}/review`, {
        method: "POST",
        body: JSON.stringify({ decision }),
      });
      load();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  const pending = requests.filter((r) => r.status === "PENDING" || r.status === "UNDER_REVIEW");
  const decided = requests.filter((r) => r.status !== "PENDING" && r.status !== "UNDER_REVIEW");

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="display-heading text-3xl">Verification review</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Requests for your neighbourhood only - as a{" "}
        {profile?.role === "representative" ? "neighbourhood representative" : "administrator"}, you
        can review requests here without needing full admin dashboard access.
      </p>

      {loading ? (
        <p className="mt-6 text-sm text-neutral-500">Loading...</p>
      ) : (
        <>
          <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Pending ({pending.length})
          </h2>
          {pending.length === 0 ? (
            <p className="mt-3 text-sm text-neutral-500">No pending requests.</p>
          ) : (
            <div className="mt-3 space-y-3">
              {pending.map((r) => (
                <div key={r.id} className="card">
                  <p className="text-sm font-medium">{r.userName}</p>
                  <p className="text-xs text-neutral-500">
                    Method: {r.verificationMethod.replace(/_/g, " ")}
                  </p>
                  {r.plusCode && <p className="text-xs text-neutral-600">Plus Code: {r.plusCode}</p>}
                  {r.notes && <p className="text-xs text-neutral-600">Notes: {r.notes}</p>}
                  {r.approximateLatitude != null && (
                    <p className="text-xs text-neutral-600">
                      Approx. location: {r.approximateLatitude.toFixed(3)}, {r.approximateLongitude?.toFixed(3)}
                    </p>
                  )}
                  <div className="mt-2 flex gap-2">
                    <button onClick={() => review(r.id, "approved", r.userName)} className="btn-primary text-xs">
                      Approve
                    </button>
                    <button onClick={() => review(r.id, "rejected", r.userName)} className="btn-secondary text-xs">
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {decided.length > 0 && (
            <>
              <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-neutral-500">
                Previously decided
              </h2>
              <div className="mt-3 space-y-2">
                {decided.map((r) => (
                  <div key={r.id} className="flex items-center justify-between text-sm">
                    <span>{r.userName}</span>
                    <span className={r.status === "APPROVED" ? "text-leaf" : "text-clay"}>{r.status}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

export default function VerificationReviewPage() {
  return (
    <RequireAuth allowRoles={["admin", "representative"]}>
      <VerificationReviewContent />
    </RequireAuth>
  );
}
