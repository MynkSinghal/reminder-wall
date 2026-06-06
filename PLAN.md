# Reminder Wall — Full Improvement Plan

> This document is the single source of truth for every change being made.
> We work through sections in order. Each section is a discrete task.

---

## Project Overview

**What it is:** A Next.js (App Router) app where you manage reminders in a web UI, and
`/api/image` generates an iPhone 14 Pro lock-screen wallpaper showing your reminders as
large bold text. Backed by Upstash Redis. Deployed on Vercel.

**Stack:** Next.js 16 · React 19 · TypeScript · Tailwind 4 · Upstash Redis · @vercel/og
(edge image rendering) · nanoid

---

## Section A — Bug Fixes

### A1. `loading` state stuck forever on initial fetch error
**File:** `app/page.tsx`
**Problem:** The `useEffect` fetch chain `.then().then()` has no `.catch()`. If Redis is
cold or unavailable, `setLoading(false)` never runs — user sees "Loading…" forever.
**Fix:** Add `.catch(() => { setReminders([]); setLoading(false); })`.

### A2. `adding` state permanently disables the input on POST error
**File:** `app/page.tsx`
**Problem:** Inside `addReminder()`, if the `fetch` throws, `setAdding(false)` is never
called. The ADD button stays disabled for the rest of the session.
**Fix:** Wrap the entire body of `addReminder` in `try { ... } finally { setAdding(false); }`.

### A3. PATCH endpoint allows overwriting any field (no body validation)
**File:** `app/api/reminders/[id]/route.ts`
**Problem:** `reminders[idx] = { ...reminders[idx], ...body }` — the raw request body is
spread directly onto the reminder object. A client can overwrite `id`, inject extra fields,
or corrupt data silently.
**Fix:** Destructure only the three allowed fields and build a clean partial update:
```ts
const { done, text, order } = await req.json();
const update: Partial<Reminder> = {};
if (done    !== undefined) update.done  = Boolean(done);
if (text    !== undefined) update.text  = String(text).trim();
if (order   !== undefined) update.order = Number(order);
reminders[idx] = { ...reminders[idx], ...update };
```

### A4. Image route instantiates its own Redis client (duplicate)
**File:** `app/api/image/route.tsx`
**Problem:** The image route does `import { Redis } from "@upstash/redis"` and calls
`Redis.fromEnv()` directly, instead of using the shared `redis` instance from `lib/redis.ts`.
**Fix:** Replace with `import { redis } from "@/lib/redis"` and remove the local instantiation.
(Upstash Redis is HTTP-based so this is not a connection-count issue, but it IS inconsistent and
means env-var changes only need to be managed in one place.)

### A5. Wallpaper slices items BEFORE separating pending/done
**File:** `app/api/image/route.tsx`
**Problem:**
```ts
const all    = (data ?? []).sort(...).slice(0, 5);  // ← slice first
const pending = all.filter(r => !r.done);            // ← then filter
```
If the first 5 items by `order` are all done, the wallpaper shows only done items even
if newer pending items exist at positions 6+.
**Fix:** Remove the hard slice (we now show all reminders, font scales). Sort pending first,
then done — within each group, preserve `order` sort.

### A6. No error handling on frontend API calls
**File:** `app/page.tsx`
**Problem:** None of the `fetch` calls check `res.ok`. If any API call fails:
- `deleteReminder` removes the item from local state but it still exists in Redis
- `toggleDone` updates local state incorrectly
- `move` corrupts local order values
**Fix:** After every `fetch`, check `if (!res.ok) throw new Error(...)`, and catch to revert
state. Pattern:
```ts
async function toggleDone(id: string) {
  const r = reminders.find(x => x.id === id)!;
  setReminders(prev => prev.map(x => x.id === id ? { ...x, done: !x.done } : x)); // optimistic
  try {
    const res = await fetch(`/api/reminders/${id}`, { method: "PATCH", ... });
    if (!res.ok) throw new Error();
    const updated = await res.json();
    setReminders(prev => prev.map(x => x.id === id ? updated : x));
  } catch {
    setReminders(prev => prev.map(x => x.id === id ? r : x)); // revert
  }
}
```
Apply this pattern to `toggleDone`, `deleteReminder`, and `move`.

### A7. `move()` has no guard against rapid concurrent clicks
**File:** `app/page.tsx`
**Problem:** Clicking up/down arrows rapidly fires multiple PATCH requests concurrently.
They can arrive out of order and leave `order` values in an inconsistent state.
**Fix:** Add a `isMoving` ref (`useRef(false)`). At the start of `move`, return early if
`isMoving.current` is true. Set to true before fetch, false in finally. This serializes moves.

### A8. Empty/loading state text is essentially invisible
**File:** `app/page.tsx`
**Problem:** `text-[#1c1c1c]` and `text-[#1a1a1a]` on `bg-black` are near-zero contrast.
The "Loading..." and "No reminders yet." states are unreadable.
**Fix:** Change loading text to `text-[#333]` and empty state to `text-[#2a2a2a]` (still
subtle, since the aesthetic is intentionally dark, but actually visible).

---

## Section B — Features

### B1. Remove input length limit + intelligent wallpaper font scaling

**No limit on input:** No UI character counter, no `maxLength` attribute, no server-side
length check. The user decides how long reminders are.

**Wallpaper font scaling algorithm (`app/api/image/route.tsx`):**

The goal is to find the largest font size F such that:
1. All N reminder rows fit vertically within the safe zone.
2. The longest reminder text fits horizontally without truncation.

Constants:
```
CANVAS_W    = 1179
CANVAS_H    = 2556
SIDE_PAD    = 80        // horizontal padding left+right
NUM_COL_W   = 72        // width reserved for "01", "02"… numbers
GAP         = 28        // gap between number and text
TEXT_W      = CANVAS_W - 2*SIDE_PAD - NUM_COL_W - GAP  = 919px

SAFE_TOP    = 900       // first pixel below the iPhone 14 Pro clock face
SAFE_BOTTOM = 2300      // last pixel above the home indicator area
SAFE_H      = SAFE_BOTTOM - SAFE_TOP = 1400px

HEADER_H    = 88        // "REMINDERS / N left" row + divider
FOOTER_H    = 40        // timestamp row at bottom

FONT_MAX    = 120       // never exceed this
FONT_MIN    = 34        // never go below this (below this, text is unreadably small)

CHAR_WIDTH_RATIO = 0.58 // empirical: Inter Bold avg char ≈ 0.58 × fontSize
ITEM_H_RATIO     = 1.30 // item row height = fontSize × 1.30
```

Algorithm:
```
available_for_items = SAFE_H - HEADER_H - FOOTER_H  // 1272px

// Height constraint: all items must fit
F_height = Math.floor(available_for_items / (N × ITEM_H_RATIO))

// Width constraint: longest text must fit
maxChars = max(reminder.text.length for all reminders)
F_width  = Math.floor(TEXT_W / (maxChars × CHAR_WIDTH_RATIO))

// Pick the binding constraint, then clamp
F = Math.min(F_height, F_width, FONT_MAX)
F = Math.max(F, FONT_MIN)

ITEM_H = Math.round(F × ITEM_H_RATIO)
NUM_PX = Math.round(F × 0.34)   // number label is ~34% of text size
```

Centering the block in the safe zone:
```
blockH  = HEADER_H + N × ITEM_H + FOOTER_H
topPad  = SAFE_TOP + Math.floor((SAFE_H - blockH) / 2)
topPad  = Math.max(SAFE_TOP, Math.min(topPad, SAFE_BOTTOM - blockH))
```

**Result:** With 1 reminder the block is vertically centered in the safe zone. With 10 short
reminders the font stays large. With 5 very long reminders the font shrinks until everything
fits.

**Note on `textOverflow`:** We remove `overflow: hidden / whiteSpace: nowrap / textOverflow: ellipsis`
from the wallpaper image items. The font scaling ensures text fits; truncation is a fallback we
no longer need.

### B2. Inline editing of reminder text

**File:** `app/page.tsx`

New state:
```ts
const [editingId, setEditingId]   = useState<string | null>(null);
const [editText,  setEditText]    = useState("");
```

Behavior:
- Clicking the reminder text span sets `editingId = r.id` and `editText = r.text`.
- The span becomes an `<input>` styled to match (same font, same color, transparent bg, no border).
- `onKeyDown`: Enter → save, Escape → cancel.
- `onBlur`: save (same as Enter).
- Save = PATCH to `/api/reminders/${id}` with `{ text: editText.trim() }`.
  - If trimmed text is empty, cancel instead of saving.
  - Optimistic update local state immediately, revert on error.
- After save, `setEditingId(null)`.

The PATCH endpoint already handles `text` after fix A3.

The cursor changes to `cursor-text` on reminder text spans to signal editability.

### B3. Drag-to-reorder

**New dependencies:**
```
@dnd-kit/core       ^6.x
@dnd-kit/sortable   ^8.x
@dnd-kit/utilities  ^3.x
```

**File:** `app/page.tsx`

Implementation:
- Wrap the reminder list in `<DndContext onDragEnd={handleDragEnd} sensors={sensors}>`.
- Use `PointerSensor` with a small activation distance (8px) so clicks still register for
  inline edit and toggle.
- Each item uses `useSortable({ id: r.id })`.
- The item `<li>` gets `transform` and `transition` from `CSS.Transform.toString(transform)`.
- A drag handle (grip icon, `⠿` or custom SVG) replaces the up/down buttons.
- `handleDragEnd`: given `active.id` and `over.id`, recompute orders:
  - Find the current sorted index of active and over items.
  - Move active to over's position.
  - Reassign sequential `order` values (0, 1, 2…) to the whole list.
  - Fire PATCH for each item whose order changed (only items between the two indices need updating).
  - Use optimistic update: reorder local state immediately via `arrayMove`, then fire API calls.

**Why remove up/down arrows:** They become redundant. The grip handle is more intuitive and
takes less horizontal space per item.

**Note on interaction with inline edit:** The PointerSensor's `activationConstraint: { distance: 8 }`
means a short tap still triggers the click handler (inline edit toggle). A longer drag gesture
initiates the DnD. This gives both behaviors on the same element without conflict.

---

## Section C — Wallpaper Layout & Design

### C1. Safe zone and positioning

From the screenshot analysis of iPhone 14 Pro (1179×2556):
- Dynamic Island: y=0–60
- Status bar / carrier info: y=0–54
- Battery/charge info text: y=110–145
- Clock "6:21" large text: y=145–700
- Gap below clock: y=700–870
- Content starts: y=870–900

**Safe zone:** `SAFE_TOP = 900`, `SAFE_BOTTOM = 2300`

Centering formula is described in B1. This guarantees:
- A single reminder sits vertically centered in the lower 3/4 of the screen.
- Many reminders compress together but never go above the clock.

### C2. Remove the hard 5-item cap

Remove `.slice(0, 5)`. All reminders appear. Font scaling handles any count.

The web UI "iOS Shortcut URL" tip panel stays (it helps users set up the shortcut). The "5 of N"
indicator the user asked to remove was the wallpaper-only truncation, which is now gone.

### C3. Wallpaper design refresh ("make it look sexier")

Keeping: black background, orange (#FF693C) accent, bold Inter typography, dark aesthetic.

Changes:
1. **Background:** Add a barely perceptible vertical gradient — `#000000` at top, `#080808`
   at the safe zone, `#000000` at bottom. Creates a sense of depth without being visible.

2. **Header row:** 
   - "REMINDERS" label: keep orange, increase letter-spacing to 0.4em.
   - Add a small orange square `▪` or `·` prefix glyph before "REMINDERS" for visual interest.
   - "N left" counter: increase size slightly, bolder treatment.
   - "all done ✓" state: elegant, not just plain text.

3. **Divider:** Instead of a plain 1px line, use a gradient line: `transparent → #FF693C40 →
   transparent`. Fades in from left, peaks at center, fades out. More refined than a flat line.

4. **Item rows:**
   - Left accent bar: a 3px vertical bar in orange on the far left of each pending item.
     Done items have no bar. This adds structure and visual rhythm.
   - Number column: keep orange, but reduce opacity to 0.6 for done items.
   - Item separator: very subtle — `#0A0A0A` instead of `#0F0F0F` (slightly darker/lighter).
   - Done items: gray strikethrough text, no left bar, dimmed number.

5. **Typography:**
   - Text: tighter letter-spacing (`-0.04em`) at large font sizes for more premium feel.
   - At smaller font sizes (below 70px): letter-spacing `-0.02em`.

6. **Timestamp:** Move from bottom-right of the main div to a more deliberate position.
   Increase visibility slightly — `#222222` instead of `#161616`.

7. **Signature (pending):** If the user provides a signature image, embed it as a small
   base64 PNG in the bottom-right corner, approximately 120×40px, with low opacity (~0.4).

---

## Section D — Web UI Improvements

No major redesign of the web UI is requested. Changes limited to:
- Remove up/down arrows → replace with drag handle icon.
- Add inline edit input state.
- Pending count display: change `text-[#252525]` → `text-[#333]` (marginally more visible).

---

## Section E — Files Changed (Summary)

| File | Changes |
|------|---------|
| `package.json` | Add `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` |
| `app/page.tsx` | A1, A2, A6, A7, A8, B2, B3 |
| `app/api/reminders/[id]/route.ts` | A3 |
| `app/api/image/route.tsx` | A4, A5, B1, C1, C2, C3 |
| `lib/redis.ts` | No changes |
| `app/api/reminders/route.ts` | No changes |

---

## Section F — Execution Order

We tackle these as discrete tasks in this order:

1. **F1 — Dependency install:** Add dnd-kit packages to package.json.
2. **F2 — Bug fixes (backend):** A3 (PATCH validation), A4 (Redis import in image route).
3. **F3 — Bug fixes (frontend):** A1, A2, A6, A7, A8 in page.tsx.
4. **F4 — Inline editing (B2):** Add editingId/editText state, input toggle, save/cancel.
5. **F5 — Drag-to-reorder (B3):** Add dnd-kit, replace arrows with drag handles.
6. **F6 — Wallpaper rebuild (A5, B1, C1, C2, C3):** Font scaling, positioning, design refresh.
7. **F7 — Signature (pending user response).**

Each task is independently deployable — the app remains functional after each step.

---

## Section G — Key Decisions & Constraints

| Decision | Rationale |
|----------|-----------|
| Keep Redis single-blob storage | Changing to row-level storage would require a migration; out of scope for this pass |
| Min wallpaper font: 34px | Below this, text is too small to read at arm's length on a lock screen |
| Max wallpaper font: 120px | Current value; looks good for 1–2 reminders |
| Char width ratio: 0.58 | Empirical for Inter Bold; may need tuning if text still clips. Can bump to 0.65 for safety. |
| SAFE_TOP: 900px | From visual inspection of screenshot; 900px is comfortably below the bottom of the clock |
| SAFE_BOTTOM: 2300px | Leaves room for home indicator bar and avoids cramping |
| dnd-kit over react-beautiful-dnd | react-beautiful-dnd is deprecated and has React 18+ issues |
| PointerSensor distance: 8px | Allows taps (inline edit) to coexist with drags on same element |
| Optimistic UI for all mutations | Faster feel; revert on error |

---

*End of plan. Begin execution at F1.*
