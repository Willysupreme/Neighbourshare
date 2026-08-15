# Feature Integration Audit

Compares the 20 requested features against the codebase as it actually exists
at commit `742f5a9` (the most recent push - Chat, Blocking, Audit Logging).
Classification is per-feature: **Already Implemented**, **Partially
Implemented**, **Missing**, **Conflicts with Existing Design**, or **Requires
Architectural Change**. Nothing here is guessed - every claim traces to a
named file.

## Existing architecture inspected (per the mandatory pre-check)

- **Data models**: `AppUser`, `Neighborhood`, `Item`, `Booking`, `Review`,
  `DamageReport`, `AppNotification`, `Block`, `AuditLogEntry`, `Message` -
  all in `src/types/index.ts`.
- **Firestore collections**: `users`, `neighborhoods`, `items`, `bookings`
  (with a `messages` subcollection), `reviews`, `damageReports`,
  `notifications`, `blocks`, `auditLogs`.
- **Auth/authorisation**: Firebase Authentication (email/password + Google
  redirect), a two-role model (`user` | `admin`) on the user document,
  enforced independently in both Firestore Security Rules
  (`firestore/firestore.rules`) and server-side in every privileged API
  route via `src/lib/auth/verifyRequest.ts`.
- **Booking logic**: `src/app/api/bookings/route.ts` (transactional
  creation with overlap prevention) and
  `src/app/api/bookings/[bookingId]/transition/route.ts` (state-machine
  enforced transitions, `src/lib/booking/stateMachine.ts`).
- **Notification logic**: created inline, per event, directly inside the
  booking and transition API routes - not a shared service.
- **Admin functionality**: `src/app/admin/page.tsx` - Users, Items,
  Bookings, Reports, Audit tabs; suspend/reinstate, remove listing.
- **Tests**: 41 automated unit tests (Vitest) covering pure logic only -
  booking overlap, state machine, trust score, neighborhood distance,
  relative time formatting. No tests yet for auth flows, Firestore rules,
  or any UI component, since none of those are unit-testable without an
  emulator (a documented gap, not an oversight).

## Per-feature classification

| # | Feature | Status | Notes |
|---|---|---|---|
| 1 | Real-time messaging | **Partially Implemented / Requires Architectural Change** | Booking-scoped chat exists and is real-time (Firestore `onSnapshot`), but it's a subcollection of `bookings`, not a standalone `conversations` collection. No unread count, read receipts, conversation list, or admin/user conversations. Moving to the requested model is a genuine schema change, not additive - existing chat data would need migrating. |
| 2 | Communication audit trail | **Missing** | Messages have no `moderationStatus` or `deletedAt`. The existing `auditLogs` collection covers moderation *actions* (suspend, remove, block), not message-level history. |
| 3 | Admin communication audit | **Missing** | No admin conversation viewer exists at all; nothing to require a reason for. |
| 4 | User blocking | **Partially Implemented** | Core mechanism exists (`blocks` collection, deterministic `${blockerId}_${blockedId}` ID, enforced server-side in booking creation and the chat Firestore rule). Missing: a Messaging Preferences settings page, and explicit notification suppression (currently a side-effect of blocking chat/bookings, not a first-class rule). |
| 5 | Admin-assisted listing management | **Missing** | `Item` has no `createdBy`/`updatedBy`/`createdOnBehalfOf` fields; no UI for an admin to list on someone else's behalf. |
| 6 | Account restrictions / shadow states | **Partially Implemented** | Only a binary `accountStatus: 'active' \| 'suspended'` exists today, with a clear (non-shadow) suspension notice shown to the user - this was a deliberate choice (see the "shadow ban" conversation that led to it). Adding RESTRICTED/SHADOW_RESTRICTED states is additive, not conflicting, but is a real, non-trivial state-model expansion. |
| 7 | Neighbourhood verification (Plus Code/geolocation, admin-reviewed) | **Conflicts with Existing Design** | Current model is a self-service shared verification code (a deliberate, documented MVP simplification - technical debt item NS-TD-01). The requested model is a fundamentally different workflow: a review queue with PENDING/UNDER_REVIEW/APPROVED/REJECTED states. This is a *replacement*, not an addition - implementing it without removing the old flow would leave two parallel, contradictory verification systems. |
| 8 | Location verification (Plus Code + geolocation) | **Partially Implemented** | Browser Geolocation API is already used, optionally, in two places (`choose-neighborhood` distance sorting, and `ShareLocationButton` for active-loan tracking) - both already handle permission-denied gracefully and never require it. Plus Code entry does not exist. |
| 9 | Location privacy (no precise coordinates to ordinary users) | **Partially Conflicts - needs a decision, not just code** | The existing `ShareLocationButton`/`BookingLocationMap` feature *does* show a precise lat/lng pin - but only to that one item's owner, only during an active loan, only by the borrower's explicit one-time consent, auto-cleared on return. That's a different, already-scoped-down context from "ordinary users see a neighbour's home address." Before writing code, worth confirming this new privacy rule is about neighbourhood verification/discovery, not meant to also water down the loan-tracking feature. |
| 10 | Configurable discovery radius | **Missing** | Neighbourhoods are a flat name-based directory (`src/lib/neighborhoods/directory.ts`); there's no radius-based item filtering by distance today. |
| 11 | Wishlist | **Missing** | No `wishlists` collection or UI exists. |
| 12 | Wishlist notifications | **Missing** | Depends entirely on #11. |
| 13 | Central Notification Engine | **Requires Architectural Change** | Notifications work correctly today but are created ad-hoc inline in each API route rather than through one shared service function. Refactoring to a single `notify()` helper is a genuine improvement worth doing on its own merits, independent of the other 19 features. |
| 14 | Notification Centre | **Partially Implemented** | `NotificationsBell` already has real-time unread count, a list, and per-item mark-as-read. Missing: "mark all as read," and per-type navigation targets. |
| 15 | Admin dashboard expansion | **Partially Implemented** | Users/Items/Bookings/Reports/Audit tabs exist today. Communication and Verification tabs are missing because features #3 and #7 (which they'd display) don't exist yet. |
| 16 | Authorisation (add OWNER/NEIGHBOUR_REPRESENTATIVE roles) | **Partially Implemented** | The existing two-role model (`user`/`admin`) is enforced both in Firestore rules and server-side in every API route - this part is solid and shouldn't need rework. "Owner" already exists implicitly via `item.ownerId`, just not as a formal role. `NEIGHBOUR_REPRESENTATIVE` is new. |
| 17 | Security review | **Ongoing baseline is solid; new surface area is unreviewed** | Every existing privileged route re-verifies the caller server-side (never trusts client claims) and Firestore rules deny-by-default. None of that changes for old features. Anything newly built here needs the same treatment before it ships, not after. |
| 18 | Testing | **Missing for all new areas** | The 41 existing tests don't and can't cover features that don't exist yet. |
| 19 | Technical debt register | **Missing as a standalone file** | Individual technical debt items are already documented inline in code comments (e.g. `NS-TD-01` for the verification code simplification, referenced in the SRS), but there is no consolidated `technical_debt_register.md` yet - this is part of the Technical_Debt_Plan.pdf we were about to start. |
| 20 | Documentation | **In progress, incomplete** | SRS.pdf exists (11 pages) but was written against the system as it stood before this feature set was proposed - it does not yet cover messaging-as-a-standalone-model, wishlist, the new verification workflow, or location privacy rules, because none of those existed when it was written. |

## What this means practically

Two items above are not simple "add a feature" tasks and are worth a direct
decision before any code gets written:

- **#7 (neighbourhood verification)** would remove and replace the current
  self-service code flow. That changes onboarding for every future user and
  invalidates the existing NS-TD-01 technical debt entry (it gets resolved,
  not superseded).
- **#9 (location privacy)** needs one clarifying question: does the new
  "no precise coordinates" rule apply to the *existing*, already-scoped
  active-loan location sharing feature, or only to the *new* neighbourhood
  discovery/verification context? These are different enough in scope and
  consent model that the answer changes what gets built.

Given the size of the remaining 18 items (a wishlist system, a central
notification engine, admin-assisted listings, an expanded restriction
model, and a full communication audit system are each non-trivial on their
own), building all of it in one pass risks the same problem the original
master prompt explicitly warns against: prioritising breadth over a
defensible, tested core. Recommend sequencing by the P0/P1/P2 priority this
document itself defines, confirming the two flagged decisions first.
