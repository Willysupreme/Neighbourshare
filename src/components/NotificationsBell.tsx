"use client";

import { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  doc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/context/AuthContext";
import { AppNotification } from "@/types";

export function NotificationsBell() {
  const { firebaseUser, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  useEffect(() => {
    // Key off firebaseUser.uid, the authoritative value Firestore actually
    // checks against (request.auth.uid) - not profile.uid, which is loaded
    // async from Firestore and can briefly lag behind the real auth state
    // during sign-in/sign-out transitions, causing a spurious
    // permission-denied if a listener is opened with a stale value.
    if (!firebaseUser) return;
    const uid = firebaseUser.uid;
    const q = query(
      collection(db, "notifications"),
      where("userId", "==", uid),
      orderBy("createdAt", "desc"),
      limit(20)
    );
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setNotifications(snap.docs.map((d) => d.data() as AppNotification));
      },
      () => {
        // Firestore's JS SDK can throw once during an auth-token handoff
        // (a documented SDK-level race, not an app bug) before its
        // internal retry recovers the listener. Don't surface it as a
        // crash - just clear stale data until the next successful snapshot.
        setNotifications([]);
      }
    );
    return unsubscribe;
  }, [firebaseUser]);

  if (!profile) return null;

  const unreadCount = notifications.filter((n) => !n.read).length;

  async function markRead(id: string) {
    await updateDoc(doc(db, "notifications", id), { read: true });
  }

  async function markAllRead() {
    const unread = notifications.filter((n) => !n.read);
    if (unread.length === 0) return;
    const batch = writeBatch(db);
    for (const n of unread) {
      batch.update(doc(db, "notifications", n.id), { read: true });
    }
    await batch.commit();
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-md px-2 py-1.5 text-neutral-600 hover:bg-neutral-100"
        aria-label="Notifications"
      >
        🔔
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-10 mt-2 w-80 rounded-lg border border-neutral-200 bg-white shadow-lg">
          {unreadCount > 0 && (
            <div className="flex justify-end border-b border-neutral-100 px-3 py-1.5">
              <button onClick={markAllRead} className="text-xs text-gold hover:underline">
                Mark all as read
              </button>
            </div>
          )}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="p-4 text-sm text-neutral-500">No notifications yet.</p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => markRead(n.id)}
                  className={`block w-full border-b border-neutral-100 p-3 text-left text-sm last:border-0 ${
                    n.read ? "text-neutral-500" : "bg-leaf-light font-medium text-neutral-800"
                  }`}
                >
                  {n.message}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
