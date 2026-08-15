import { FieldValue, Firestore } from "firebase-admin/firestore";
import { AuditAction, AuditLogEntry } from "@/types";

export async function logAuditEntry(
  db: Firestore,
  entry: {
    actorId: string;
    actorName: string;
    action: AuditAction;
    targetType: AuditLogEntry["targetType"];
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
