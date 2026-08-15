"use client";

import { useCallback, useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/context/AuthContext";
import { RequireAuth } from "@/context/RequireAuth";
import { listMyBlocks } from "@/lib/blocks";
import { authedFetch } from "@/lib/apiClient";
import { Block } from "@/types";

function BlockedUsersContent() {
  const { profile } = useAuth();
  const [blocks, setBlocks] = useState<(Block & { blockedName: string })[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    const raw = await listMyBlocks(profile.uid);
    const withNames = await Promise.all(
      raw.map(async (b) => {
        const snap = await getDoc(doc(db, "users", b.blockedId));
        const name = snap.exists() ? (snap.data() as { name?: string }).name ?? "Unknown" : "Unknown";
        return { ...b, blockedName: name };
      })
    );
    setBlocks(withNames);
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function unblock(blockedId: string) {
    if (!window.confirm("Unblock this person? They'll be able to message and request items from you again.")) return;
    await authedFetch(`/api/blocks/${blockedId}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <h1 className="display-heading text-3xl">Blocked users</h1>
      {loading ? (
        <p className="mt-6 text-sm text-neutral-500">Loading...</p>
      ) : blocks.length === 0 ? (
        <p className="mt-6 text-sm text-neutral-500">You haven&apos;t blocked anyone.</p>
      ) : (
        <div className="mt-6 space-y-2">
          {blocks.map((b) => (
            <div key={b.id} className="card flex items-center justify-between">
              <span className="text-sm">{b.blockedName}</span>
              <button onClick={() => unblock(b.blockedId)} className="btn-secondary text-sm">
                Unblock
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function BlockedUsersPage() {
  return (
    <RequireAuth>
      <BlockedUsersContent />
    </RequireAuth>
  );
}
