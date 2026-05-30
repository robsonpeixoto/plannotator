# Plan Document — Reskin Scope (production → prototype)

> The plan *document body* is where production and the prototype diverge most. This scopes the
> transfer: what production does today, what the prototype does, and what actually carries over.
> Companion to `header-functionality.md` (the top bar, already done) and `decisions.md`.
>
> Source reads (cited, 2026-05-30): production `packages/plannotator-plan-review/App.tsx` +
> `packages/ui/components/{Viewer,OverlayScrollArea,StickyHeaderLane,DocBadges}.tsx`; prototype
> `/Users/ramos/oss/diffkit/apps/goal-prototype/src/PlanEditor.tsx` + `styles.css`.

---

## 0. The big picture

Production and the prototype lay out the *same pieces* (card, metadata, toolstrip, sidebar, panel)
but organize them differently and make different always-on/optional calls:

| Concern | Production (now) | Prototype (target) |
|---|---|---|
| **Grid background** | **always on** (`.bg-grid` on the scroll container) | **optional, OFF by default** — a Grid3×3 toggle; "legacy look" |
| **Document card** | **always** a card (`bg-card rounded-xl shadow-xl border`) | card by default; in grid mode the card *floats* on the grid |
| **Scrollbar** | **custom** (`overlayscrollbars`, always-visible 10–14px overlay) | **native OS** (`scrollbar-width: thin`) — library dropped |
| **Metadata** (branch·commit·diff·origin) | `DocBadges` absolutely positioned top-left *inside* the card | a context row *inside* the article, above the toolstrip |
| **Toolstrip** | rendered *above* the Viewer card | *inside* the article, grouped clusters, between metadata and blocks |
| **Top bar** | full `AppHeader` (logo + all actions + toggles + menu) | minimal: nav + label + Feedback/Approve + panel/grid toggles |
| **View modes** | `wide` / `focus` — **reshape layout** (hide sidebars/panel) | `default/wide/focus` — **just max-width** (860/1040/720) |
| **Ghost sticky header** | yes (`StickyHeaderLane`) | yes (toolstrip clone on scroll) |
| **Sidebar resize** | `ResizeHandle` drag (no snap-close) | drag-to-close (60% snap) + hover-gutter chevron + edge zone |

---

## 1. Production plan document — current state (cited)

- **Scroll + card:** `OverlayScrollArea` as `<main class="flex-1 bg-grid">` (App.tsx:1930) → centered flex `planAreaRef` (App.tsx:1936) → `<article class="bg-card rounded-xl shadow-xl border p-5…p-12">` (Viewer.tsx:522), max-width 832/1040/1280 via `planMaxWidth` (App.tsx:1746).
- **Grid:** `.bg-grid` defined in theme.css:105–116; applied **unconditionally** — no toggle.
- **Metadata:** `<DocBadges layout="column">` absolutely positioned `top-3 left-3` *inside* the card (Viewer.tsx:530) — repo, branch, source, the `+N/−M` `PlanDiffBadge`, amber demo chip, linked-doc breadcrumb.
- **Toolstrip:** `AnnotationToolstrip` rendered *above* the card (App.tsx:1962). Actions cluster (Global comment + Copy) sticky top-right *inside* the card (Viewer.tsx:549).
- **Ghost header:** `StickyHeaderLane` (App.tsx:1943) — duplicate toolstrip+badges, fades in on scroll, 3 responsive states.
- **View modes:** `wideModeType` null/`wide`/`focus` (App.tsx:200). Both wide & focus **hide both sidebars/panel**; wide drops the max-width, focus keeps it. Toggle = small "Wide | Focus" text above the card (App.tsx:2021).
- **Scrollbar:** custom `os-theme-plannotator` (theme.css:257), always visible, 10px→14px on hover, click-scroll. Native (`::-webkit-scrollbar 6px`) only for unwrapped inner scrollers.
- **Sidebar:** `SidebarContainer` (TOC/Versions/Files), `useResizablePanel` 240px (160–400), `ResizeHandle` — **no snap-to-close**.

## 2. Prototype plan editor — target (cited)

- **Grid toggle (OPTIONAL, default OFF):** `localStorage "plannotator-grid-view"` (PlanEditor.tsx:352). Grid3×3 button in topbar (585). When ON, *three things change together*: `<main>` gets `grid-pattern bg-muted` (807); the article becomes a floating card `rounded-xl border bg-card shadow-xl p-5 md:p-8 lg:p-10` (811); the outer wrapper drops to `bg-transparent` (605). Default (OFF) = the outer wrapper is the clean card, article is plain.
- **View modes:** default 860 / wide 1040 / focus 720 px — **max-width only** (808). `w` cycles (456). Subtle toolstrip button; not persisted.
- **3-layer top organization:**
  1. **Minimal topbar** (538): SidebarTrigger + "Plan Review" + Feedback + Approve + divider + panel toggle + grid toggle.
  2. **Metadata row inside the article** (857): branch/repo + `+N/−M` + origin chip.
  3. **Toolstrip inside the article** (871): grouped clusters — input-method (Select/Pinpoint) · annotation-mode (Markup/Comment/Redline/Label) · primary actions (Global/Copy) right-aligned · subtle view-mode button.
- **Ghost sticky header:** toolstrip clone, IntersectionObserver sentinel, `sticky top-2`, fade/translate (815).
- **Sidebar:** drag-to-close at 60% of `SIDEBAR_MIN` (755), hover-gutter chevron (782), thin edge zone when closed (793), `[data-sidebar-panel]` width transition; TOC/Versions/Archive tabs.
- **Scrollbars:** **native** (`scrollbar-width: thin`, styles.css:137) — no `overlayscrollbars`.

---

## 3. Transfer matrix — what carries over

| # | Item | Decision | Risk / note |
|---|---|---|---|
| T1 | **Grid → optional toggle, default OFF** | **Adopt** the prototype model: Grid3×3 toggle, localStorage, default off, "legacy look". | Behavior change — today's users see grid always; flipping default to OFF is a visible default change. Needs your call on default. |
| T2 | **Document card always present** | **Keep a clean card by default**; grid mode floats the card on the pattern (prototype's dual treatment). | Reconciles with T1; the "3 things change together" pattern (mind the `bg-grid`→`grid-pattern` twMerge gotcha). |
| T3 | **Native scrollbars** (drop `overlayscrollbars`) | **Adopt** native — *this is almost certainly the "remove the custom toolbar/scrollbar" ask.* | Moderate lift: unwrap `OverlayScrollArea`, drop the lib + `os-theme`, re-do layout math (native eats ~15px), retest sticky header / annotation overlays / click-scroll loss. |
| T4 | **Metadata + toolstrip moved INSIDE the article** | **Adopt** the prototype's in-document placement (cleaner, context-aware). | The bigger structural change — touches `App.tsx` + `Viewer.tsx` layout. This is "changed up the toolstrip + the topmost info/action organization." |
| T5 | **Minimal top bar** | **Reconcile:** the prototype's topbar is lean (nav + Feedback/Approve + panel/grid toggles). Production's `AppHeader` carries the full Options menu we decided to keep. → Keep the Options menu; otherwise slim the bar toward the prototype. | We already locked "keep the Options dropdown" (`decisions.md`). |
| T6 | **View modes** | **Decision needed:** keep production's *layout-reshaping* wide/focus (hide sidebars — more powerful), or adopt the prototype's *max-width-only* cycle (simpler)? | Production's is arguably better UX; the prototype's is simpler/cleaner. |
| T7 | **Ghost sticky header** | **Keep** (both have it); align styling. | Low risk. |
| T8 | **Sidebar drag-to-close + hover gutter** | **Adopt** the prototype's drag-to-close (60% snap) + hover-gutter chevron + edge zone. | Replaces `ResizeHandle` interaction; medium lift. |

---

## 4. Decisions needed before implementation

1. **"Custom toolbar" = the custom scrollbar?** Strong inference: yes — drop `overlayscrollbars` for native OS scrollbars (T3), matching the prototype. Confirm.
2. **Grid default:** OFF by default (prototype) — accepted? It's a visible change for existing users.
3. **View modes (T6):** keep production's chrome-hiding wide/focus, or the prototype's simpler width-only cycle?
4. **Scope of the in-document reorg (T4):** full move of metadata + toolstrip into the article now, or phase it (scrollbar + grid first, layout reorg second)?

## 5. Out of scope / production wins (keep, reskin only)

Annotation engine (web-highlighter, pinpoint, toolbar), plan-diff word-level system, version history, linked-doc nav, the rich markdown pipeline, the Options menu + Settings, AI chat panel, image annotator. The prototype is the *visual/layout* target; these stay.

---

*Reads cited inline. 2026-05-30.*
