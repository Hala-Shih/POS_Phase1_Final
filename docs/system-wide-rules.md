# System-Wide Rules

This document defines non-negotiable interaction and state-management rules that apply across the entire HandPOS app. Rules are written as enforceable standards using "must" / "must not" language. New screens, drawers, and components must comply.

Scope: cross-screen behavior, drawer/tab orchestration, navigation transitions, and state cleanup. Component-level visual styling that does not affect behavior is out of scope.

---

## 1. Single Drawer Only (Visual Focus Rule)

A drawer represents the user's primary visual focus and the action they care about most at that moment. To preserve focus and avoid stacked surfaces:

- The app **must never** show more than one drawer open at the same time.
- If a drawer is already open and the user taps a tab or action that triggers another drawer, the currently open drawer **must collapse first**, and then the new drawer **must open** in its place.
- The transition **must be a handoff**, not an overlay: no two drawers may animate or render simultaneously.
- This rule applies to all drawers and bottom sheets, including but not limited to: Action Drawer, Payment Drawer, Menu Sheet, Search Drawer, Cart Drawer, Item Config Sheet, Combo Config Sheet.

Exception: modal confirmation dialogs (e.g. "Confirm void") are not drawers and may appear on top of a drawer; they must auto-dismiss back to the original drawer state.

---

## 2. Single Orchestration Source

- Drawer open/close state **must** be controlled from a single orchestration layer (currently the App shell). Child components **must not** own competing toggles for cross-screen drawers.
- Components requesting a drawer **must** call orchestration callbacks rather than mutating other components' state directly.

---

## 3. Tab ↔ Drawer Synchronization

- The footer/tab indicator **must always** reflect the currently open drawer (e.g. Menu drawer open → Menu tab active).
- Closing a drawer **must** reset the active tab to the screen's default tab.
- Selecting a tab whose drawer is already open **must** close that drawer (toggle behavior), not re-open it.

---

## 4. Screen Transition Cleanup

- Any screen/route change **must** close incompatible drawers before mounting the next screen.
- Leaving the Payment screen **must** clear all payment-related drawer flags.
- Returning to Login or Home **must** reset all drawer state to closed.
- A drawer **must not** remain open across an unrelated screen change.

---

## 5. Deterministic Drawer Priority

When multiple drawer triggers fire in the same tick (e.g. rapid taps), the orchestration layer **must** apply a fixed priority to decide which drawer ends up open:

1. Explicit user tap on a tab or action button (latest tap wins).
2. Programmatic open from a completed user flow (e.g. "Pay" inside Action drawer opens Payment drawer).
3. Auto-open triggers from screen arrival (lowest priority).

The end state **must** still satisfy Rule 1 (single drawer only).

---

## 6. Drawer Lifecycle & State Reset

Every drawer **must**:

- Reset its own transient local UI state on close (expanded rows, inline editors, scroll position where appropriate, draft inputs that should not persist).
- Expose a single `onClose` callback to the orchestration layer.
- Avoid persisting draft state silently; either commit it or discard it explicitly on close.

---

## 7. Background Interaction Policy

- While a drawer is open, the content beneath it **must not** receive taps that would trigger conflicting actions.
- Tapping the scrim/backdrop **must** close the drawer (Rule 6) unless the drawer explicitly requires confirmation.

---

## 8. Consistent Interaction Model

All drawers **must** share:

- A consistent close affordance (drag handle and/or back/close button).
- Consistent open/close motion timing and easing.
- Consistent safe-area and bottom-padding handling so underlying content does not become unreachable.

---

## 9. Failure & Fallback

- If a requested drawer cannot open (missing data, invalid state), the app **must** return to a safe base state with no drawers open and no stale open flags.
- Orchestration **must not** leave the UI in a half-open state.

---

## 10. Status Terminology Consistency

Order status terminology across the app **must** use the canonical set:

- **Open** — order is active and editable.
- **Close** — order is finalized.
- **Void** — order is cancelled.
- **Combined** — order has been merged/sent and is no longer individually editable.

Screens, filters, badges, and indicators **must** use these labels. Legacy internal status values may continue to exist in data but **must** be mapped to the canonical labels at the presentation layer.

---

## 11. Drawer Anchoring & Chrome

Every drawer **must**:

- Sit **directly above the footer nav** when open. The footer nav remains visible and is never covered by the drawer.
- Use the **same enter/exit animation** (slide up from above the footer, same duration and easing) across all drawers.
- Render a **consistent drop shadow** along its top edge to visually separate it from the content layer beneath.
- Show a **close button in the top-right corner** of the drawer header, in addition to any backdrop-tap close behavior (Rule 7).
- Use the same corner radius and header layout so drawers feel like one shared surface family.

---

## 12. Drawer Height Standard

- All drawers triggered from the footer nav (Menu, Search, Action, Payment) **must** open to the **same standard height** so users build muscle memory for where content appears.
- The standard height **must** leave the footer nav and a clear strip of the underlying content visible (so the user can still see context behind the drawer).
- **Exception:** Combo and modifier configuration sheets **may** open taller than the standard height when they need more vertical space to show all options without internal scrolling becoming the primary interaction. They **must** still respect Rules 1, 7, and 11.
- Drawers **must not** dynamically resize themselves while open in response to content changes; height is decided at open time.

---

## 13. Background Scroll Behavior While Drawer Is Open

While any drawer is open, the underlying screen (e.g. Order Summary / Check page) **must** remain scrollable so the user can still see all of the underlying content, including totals at the bottom.

- Vertical scrolling of the underlying content **must** continue to work while a drawer is open.
- Scroll **must** be bounded: the user **must not** be able to scroll the underlying content fully off-screen. Scroll stops as soon as the full content fits within the visible window above the drawer.
- The visible window above the drawer is defined by: top of the screen → top edge of the open drawer.
- Bottom padding of the underlying scroll container **must** be adjusted so that the last item (e.g. the order total row) can be scrolled into the visible window when a drawer is open.
- This rule does **not** override Rule 7: taps on the underlying content that would trigger conflicting actions are still blocked while a drawer is open; only scrolling is permitted.

---

## 14. No Visible Scrollbars

This is a mobile-first experience; scrollbars **must not** be visible on any screen.

- All scroll containers **must** hide their scrollbars (WebKit, Firefox, IE) while keeping vertical/horizontal scrolling fully functional via touch and trackpad.
- This applies to every screen, drawer, sheet, list, and modal — including order lists, menu lists, modifier panels, payment views, and tab strips.
- Custom scrollbar styling utilities (e.g. `thin-scrollbar`) **must not** be introduced for new components. Use the global no-scrollbar default.
- Scroll affordance **must** instead come from content (e.g. partial last row, fade/gradient mask, drag handle on drawers), not from a visible scrollbar.

---

## 15. Price Adjustment Transparency

Users must always be able to see what an item originally costs and how its price changed. The original menu price **must never** be silently overwritten by a derived price.

### Visual model

Every per-item row is composed of three regions:

- **Title** — the item name (and quantity badge).
- **Description** — modifiers, combo selections, notes, and any item-level status label (e.g. `Override`). Each price-changing cause shows its delta **inline, immediately after the text that caused it**.
- **Price column** (right-aligned) — original price on top with strikethrough, final unit price below in accent color.

When a row has no price adjustment and no override, the price column collapses to a single neutral line (no strikethrough, no accent color).

### Right-column price stack

| State | Top line | Bottom line |
|---|---|---|
| No adjustment, no override | — | Original price (neutral) |
| Net adjustment ≠ 0 | Original price, strikethrough, muted | Final unit price, accent color |
| Override active | Original price, strikethrough, muted | Override price, accent color |
| Comped | Original price, strikethrough, muted | `$0.00` (or `Comp` badge), accent color |

The bottom line is always the **effective unit price**. The right column **never** displays the literal text `Adjustment:` or `→`; the math is communicated visually by strikethrough + accent.

### Inline cause deltas (description region)

Each price-changing cause is annotated **next to its own text** in the description, in accent color:

- **Modifier upcharge** — appended to the modifier name, e.g. `Lemon Herb, Grilled Shrimp +$10`. Modifiers with no upcharge show no delta.
- **Combo selection upcharge** — same pattern, appended after the selected component name.
- **Note-based adjustment** — appended after the note text, e.g. `Note: add spit  +$4` (or `−$1.50`). The note text itself is rendered in the standard note style (purple italic per Rule 10's note styling); only the `+$X` / `−$X` token is the inline delta.
- **Discount** — rendered as its own description line because it has no underlying text to attach to, e.g. `10% off  −$0.65`.
- **Override** — rendered as a single description line `Override` (accent, italic). Inline modifier / note / discount deltas **must be hidden** when override is active, since they no longer contribute to the final price.

A cause that resolves to $0 **must not** render an inline delta.

### Price override priority

- Price override has the **highest priority** and decides the final unit price, regardless of any other adjustments.
- When override is set:
  - The right-column bottom line is the override price (accent), with the original price struck through above it.
  - The description shows a single `Override` label and **suppresses** the inline deltas for modifier, note, and discount adjustments. Recorded values are preserved in state.
- Removing the override **must** restore the previously-recorded adjustments and their inline deltas without data loss.

### Universal application

This rule applies to every surface that shows a per-item price, including: Check Summary, Cart Drawer, Action Drawer item view, Payment Drawer (main / split / cash / credit), Orders detail, and any printed/sent kitchen view. Adjustments **must not** be collapsed into the original-price field. Inline deltas **must** appear next to the cause that triggered them, never as a separate aggregate `Adjustment:` line.

---

## 16. Minimum Tap Target Size

Every interactive control **must** have a tap target at least **44 × 44 px** (Apple HIG / WCAG 2.5.5 baseline) so it can be reliably hit with a thumb on a handheld device.

- All buttons, icon buttons, chips, list rows, tabs, segmented controls, toggles, checkboxes, radios, and any element with an `onClick` / `onTap` handler **must** measure at least 44 px in height. Width **must** also be at least 44 px unless the control sits inside a row whose full width is itself the tap target.
- Visual size and tap size are decoupled. A control may render visually smaller (e.g. a 24 px close icon) **only if** it is wrapped in a 44 × 44 px hit area (transparent padding or an absolutely-positioned overlay).
- Adjacent tap targets **must** have at least 8 px of spacing between hit areas to avoid mis-taps.
- Disabled buttons **must** preserve the same 44 px minimum so layout does not shift when state changes.
- The 44 px floor applies to every screen, drawer, sheet, and modal — including dense lists. If a list row needs to be shorter visually, the row itself must remain the tap target so the full 44 px height is preserved by row padding.
- New components **must** use the shared minimum-height utilities (`min-h-[44px]`, fixed `h-11`/`h-12`, or equivalent) rather than relying on intrinsic content height.

Exception: purely decorative or non-interactive elements (badges, status pills, read-only labels) are exempt. As soon as a handler is attached, the 44 px rule applies.

---

## Implementation Checklist (for new drawers / screens)

- [ ] Drawer state owned by the orchestration layer, not the component.
- [ ] Opening this drawer closes any other open drawer first.
- [ ] Footer/tab indicator updates when this drawer opens and closes.
- [ ] Screen transitions close this drawer if it would be incompatible with the next screen.
- [ ] `onClose` resets all transient local state.
- [ ] Backdrop tap closes the drawer (or explicitly justifies why not).
- [ ] No competing local toggles duplicate orchestration state.
- [ ] Status labels use the canonical terminology in Rule 10.
- [ ] Drawer is anchored directly above the footer nav with the shared shadow, animation, and top-right close button (Rule 11).
- [ ] Drawer opens to the standard footer-drawer height, unless explicitly justified by Rule 12 (combo/modifier).
- [ ] Underlying screen remains scrollable while this drawer is open, with bottom padding adjusted so the last row (e.g. total) is reachable but the page cannot scroll off-screen (Rule 13).
- [ ] No visible scrollbars on any scrollable container in this screen/drawer (Rule 14).
- [ ] Per-item price displays follow Rule 15: right-column shows the original price struck through above the final unit price (accent color); each price-changing cause (modifier, combo selection, note) shows its delta inline next to its own text; discount renders as its own inline description line; override replaces all inline deltas with a single `Override` label.
- [ ] Every interactive control has a tap target of at least 44 × 44 px with at least 8 px of spacing from adjacent controls (Rule 16). Visually smaller icons are wrapped in a 44 px hit area.

---

## QA Scenarios

Use these scenarios to verify compliance after any change to drawer or navigation logic:

1. Open Menu, then tap Search → Menu must close, Search must open. Only one drawer visible.
2. Open Action, then tap Payment → Action must close, Payment must open.
3. Open Payment drawer, then navigate away from the Payment screen → Payment drawer must be closed on return.
4. Rapidly tap Menu and Search alternately → Final visible drawer must match the last tap; no overlapping drawers at any frame.
5. Open any drawer, then log out / return to Login → All drawers must be closed.
6. Open a drawer, tap the backdrop → Drawer must close and tab indicator must reset.
7. Filter Orders by Open / Close / Void / Combined → Labels and badges must match Rule 10 exactly.
8. Open each footer drawer (Menu, Search, Action, Payment) in turn → Each drawer must sit directly above the footer nav, share the same animation/shadow, and expose a close button in the top-right corner.
9. Open Menu, Search, Action, and Payment drawers individually → All four must open to the same height. Open a combo/modifier sheet → It may be taller, but must still leave the footer visible.
10. On the Check page with many items, open any drawer → Scroll the underlying check list. The total row must be reachable above the drawer, and the page must stop scrolling when the full content fits in the visible window (cannot scroll off-screen).
11. Inspect every screen and drawer with scrollable content → No visible scrollbar must appear, but vertical and horizontal scrolling must still work.
12. Add an item with a modifier upcharge → Modifier name shows `+$X.XX` inline; right-column shows original price struck through above the new final price in accent color. Attach a note-based adjustment → Note text shows `+$X.XX` (or `−$X.XX`) inline; right-column updates. Apply a discount → A `N% off  −$X.XX` line appears in the description; right-column updates. Apply a price override → All inline deltas disappear and the description shows a single `Override` label; right-column shows original price struck through above the override price. Remove the override → Inline deltas reappear and the right-column reflects the recomputed final price.
13. Inspect every interactive control across all screens and drawers (buttons, icon buttons, chips, tabs, list rows, toggles, checkboxes, close affordances) → Each must measure at least 44 × 44 px in its tap area, even when the visible icon or label is smaller. Adjacent controls must have at least 8 px of spacing. Disabled state must preserve the same height.
