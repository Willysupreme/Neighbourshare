// NeighborShare domain types - barrel re-export.
//
// As of REBUILD_DOCUMENTATION Phase 5, the actual type definitions live in
// src/domain/*/types.ts (one module per entity, per the rebuild
// architecture in 05_ARCHITECTURE.md). This file re-exports them so every
// existing `import { X } from "@/types"` across the codebase keeps working
// unchanged - there is exactly ONE authoritative definition of each type
// (in domain/), not a duplicate; this file only re-points to it.

export * from "@/domain/users/types";
export * from "@/domain/items/types";
export * from "@/domain/bookings/types";
export * from "@/domain/messaging/types";
export * from "@/domain/notifications/types";
export * from "@/domain/wishlist/types";
export * from "@/domain/verification/types";
export * from "@/domain/moderation/types";
