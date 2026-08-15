import { FieldValue, Firestore } from "firebase-admin/firestore";
import { AuditAction } from "@/types";

export async function logAuditEntry(
  db: Firestore,
  entry: {
    actorId: string;
    actorName: string;
    action: AuditAction;
    targetType: "user" | "item";
    targetId: string;
    details?: string;
  }
): Promise<void> {
  const ref = db.collection("auditLogs").doc();
  await ref.set({
    id: ref.id,
    ...entry,
    createdAt: FieldValue.serverTimestamp(),
  });
}
