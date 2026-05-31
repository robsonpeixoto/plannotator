# Settings Consolidation — Migration Plan (vetted)

> Goal: ONE global, config-store-backed settings dialog (`AppSettingsDialog`). Delete the legacy
> monolith `packages/ui/components/Settings.tsx`. Embedded apps (plan + code-review) open the global
> dialog only — no app-local settings dialogs. One source of truth per setting.
>
> Produced + adversarially reviewed by the `settings-consolidation-plan` workflow (6 agents). 2026-05-30.

---

## The reassuring news

Most of this is **already done**. The map corrected our assumptions:
- `Settings.tsx` is ~1535 lines, already partly gutted. Diff/comments/labels/width/tater are **already on the config store**.
- The embedded apps **already route to the global dialog** (`onOpenSettings` → `appStore.setSettingsOpen`). The monolith's `<Settings>` mounts in the apps are **dead when embedded** (gated by `skipBuiltInSettings`/`externalOpenSettings`).
- The monolith stays alive for only **4 import sites** + one standalone consumer:
  1. `AppSettingsDialog` imports 3 tabs from it (`GitTab`, `ReviewDisplayTab`, `CommentsTab`).
  2. `DiffOptionsPopover` imports 5 option arrays from it.
  3. code-review `App.tsx` (dead-when-embedded mount).
  4. plan `AppHeader.tsx` (dead-when-embedded mount).
  5. **The portal** (`apps/portal`, share.plannotator.ai) — renders the standalone plan `<App/>` with **no `onOpenSettings`**, so the monolith is its **only** settings UI. ← the blocker nobody mapped.

## The two things the adversarial pass caught

- **🔴 Identity re-tag regression (the plan had called it "vestigial" — it's not).** `onIdentityChange` re-authors existing annotations (remaps `old→new` author) in both apps (code-review `App.tsx:1090`, plan `App.tsx:1340`). It reaches the user **only** through the monolith. The global dialog's `GeneralTab` doesn't pass `onIdentityChange`. Deleting the monolith silently breaks identity re-tagging in an open session. **Must add a unit to preserve it** (event/store subscription).
- **🟠 code-review's `aiProviders` is NOT settings-only.** It also drives the live in-page AI chat + sidebar (`App.tsx:547,2397`). Removal must **keep** the fetch+state; remove only the `<Settings aiProviders>` prop.

---

## Units (critical path: U1 → U2/3/4 → U5 → U9 → U8 → U10)

| # | Unit | Risk |
|---|---|---|
| U1 | Extract the diff-option constant arrays → `settings/diffOptions.ts`; repoint `DiffOptionsPopover` | low |
| U2 | Extract `GitTab` → `settings/ReviewGitTab.tsx` (config-store-only) | low |
| U3 | Extract `ReviewDisplayTab` → `settings/ReviewDisplayTab.tsx` (mind SegmentedControl/Toggle styling) | low-med |
| U4 | Extract `CommentsTab` → `settings/CommentsTab.tsx` | low |
| U5 | Repoint `AppSettingsDialog` to the new tabs → **dialog is now monolith-free** | low |
| U6 | Make the global dialog **mode-aware** (default tab by active session mode) — must actually call `setActiveTab` in the open effect | low |
| **U+** | **NEW (from review): preserve identity re-tag** — global dialog reaches the active session's store to remap annotation authors on identity change | med |
| U7 | code-review: delete the dead `<Settings>` mount + import; **keep `aiProviders` fetch/state** (it drives AI chat) | med |
| U8 | plan: delete the built-in `<Settings>` + `skipBuiltInSettings`/`mobileSettingsOpen` plumbing (keep `taterMode` state). **Gated on U9.** | med-high |
| U9 | **Portal settings path** (the hard precondition) — give `apps/portal` an alternative to the monolith, or drop portal settings | high |
| U10 | **DELETE `Settings.tsx`** — gate: grep shows zero importers + portal decoupled; full typecheck + build:hook + build:portal | med |
| U11 | Migrate `uiPreferences` toc/sticky → config store (closes the TOC/sticky live-update seam from the global dialog; also repoint `App.tsx:256` + `:204`) | med |
| U12 | Make config server-sync **deterministic** — route to `/daemon/config`, not the active session's narrower `/api/config` allowlist (silent-drop bug). **Hard gate before U13.** | med |
| U13 | *(optional, deferred)* migrate trivial stray settings (autoClose/permissionMode/theme…) into the config store. **Keep `agentSwitch` + `aiProvider` specialized.** `quickLabels` has wide blast radius. | med |

## Adversarial fixes folded in (must-do)
1. Add the **identity re-tag** unit (U+). 2. U7 **keeps** the aiProviders fetch. 3. U6 must actually `setActiveTab(default)` on open + read `bootstrap.session.mode`. 4. Tighten the dialog's `aiProviders` type to include `models?`. 5. U11 also repoints `App.tsx:256` (`useSidebar(getUIPreferences().tocEnabled)`) + the `lastAppliedTocEnabledRef`. 6. U12 is a **hard gate** before any new server-keyed setting.

## Open decisions (need product/scope calls — see chat)
1. **Portal settings** (gates U9/U10): build a daemon-free portal settings dialog, or drop portal settings entirely?
2. **Scope**: monolith deletion + close the live seams (U1–U12 + identity fix), and **defer** the optional stray-setting migration (U13)? Or do the full config-store consolidation now?
3. **Section-visibility UX** (U6): default to the relevant tab but keep all sections visible, vs. hide the non-active mode's section.

---

*Full map + plan + review: workflow `w3xbd0psd`. 2026-05-30.*
