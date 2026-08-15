// Messaging domain - see SRS.pdf FR-CHAT
//
// Deliberately booking-scoped, not a general Conversation entity. The
// rebuild brief's example type list (§7) includes "Conversation" as a
// standalone entity associated with users/items/bookings/disputes. This
// was evaluated during the original feature-integration phase of this
// project and rejected in favour of the current design: FR-CHAT-03
// explicitly requires "the system shall NOT provide open, unscoped direct
// messaging between arbitrary users." Reintroducing a general Conversation
// entity would reopen that decision, not merely restructure existing code.
// See ADR in REBUILD_DOCUMENTATION/09_DECISIONS_LOG.md.

export interface Message {
  id: string;
  bookingId: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: string;
}
