"use client";

import { useEffect, useRef, useState, FormEvent } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/context/AuthContext";
import { Message } from "@/types";

export function BookingChat({ bookingId }: { bookingId: string }) {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query(
      collection(db, "bookings", bookingId, "messages"),
      orderBy("createdAt", "asc")
    );
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setMessages(snap.docs.map((d) => d.data() as Message));
      },
      () => {
        // Same benign Firestore SDK auth-transition race documented in
        // NotificationsBell - not a real app error.
      }
    );
    return unsubscribe;
  }, [bookingId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!profile || !text.trim()) return;
    setError(null);
    setSending(true);
    try {
      await addDoc(collection(db, "bookings", bookingId, "messages"), {
        bookingId,
        senderId: profile.uid,
        senderName: profile.name,
        text: text.trim(),
        createdAt: serverTimestamp(),
      });
      setText("");
    } catch {
      // Most likely cause: the other party has blocked you, which the
      // Firestore rule enforces server-side regardless of this UI.
      setError("Couldn't send that message. The other party may not be reachable right now.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="card flex h-80 flex-col">
      <p className="mb-2 text-sm font-medium">Messages</p>
      <div className="flex-1 space-y-2 overflow-y-auto pr-1">
        {messages.length === 0 ? (
          <p className="text-xs text-neutral-400">No messages yet - say hello.</p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`max-w-[80%] rounded-sm px-3 py-1.5 text-sm ${
                m.senderId === profile?.uid
                  ? "ml-auto bg-gold text-paper-raised"
                  : "bg-paper text-ink"
              }`}
            >
              <p>{m.text}</p>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {error && <p className="mt-2 text-xs text-clay">{error}</p>}

      <form onSubmit={handleSend} className="mt-2 flex gap-2">
        <input
          className="input"
          placeholder="Type a message..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={1000}
        />
        <button type="submit" disabled={sending || !text.trim()} className="btn-primary">
          Send
        </button>
      </form>
    </div>
  );
}
