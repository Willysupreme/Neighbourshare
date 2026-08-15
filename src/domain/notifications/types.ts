// Notification domain - see SRS.pdf FR-NOTIF, notificationEngine.ts

export type NotificationType =
  | "request_received"
  | "request_approved"
  | "request_declined"
  | "booking_cancelled"
  | "item_returned"
  | "pickup_reminder"
  | "return_reminder"
  | "damage_reported"
  | "review_available"
  | "verification_update"
  | "wishlist_match"
  | "message_received"
  | "moderation_update";

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  message: string;
  relatedBookingId?: string;
  read: boolean;
  createdAt: string;
}
