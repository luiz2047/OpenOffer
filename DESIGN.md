# OpenOffer Design System

Last updated: 2026-06-26

## Product Thesis

OpenOffer is a local-first job-search operating surface for people who are actively interviewing. It should feel like a serious desktop workbench: dense, quiet, direct, and trustworthy. The product is not a generic AI chat and not a marketing-style job tracker. The core value is turning vacancies, recruiter messages, stages, meetings, recordings, notes, and calendar state into one controllable workflow.

## Locked UX

These surfaces are considered the current baseline and must not be redesigned without a separate explicit product decision:

- Calendar layout and day navigation.
- Vacancy list workflow.
- Expanded vacancy view.
- Expanded vacancy stage editing flow.
- The three-column command center mental model: calendar, vacancies, selected vacancy.

Design work may polish the visual system around these areas, but it must not change their structure, information architecture, or user mental model by default.

## Design Direction

OpenOffer should look like an industrial desktop workbench:

- Dark-first graphite surfaces.
- Compact but readable density.
- Clear pane separation.
- Minimal decorative styling.
- Cyan only for focus, selection, and sync-relevant signals.
- Amber/red/green only for semantic status.
- White primary buttons used sparingly for the main action in the current context.
- Cards only when the card is the interaction or a contained editor area.

Avoid:

- Purple/blue AI gradients.
- Marketing hero composition inside the app.
- Decorative orbs, blobs, and glass effects that do not carry status.
- Large rounded SaaS cards.
- Replacing established vacancy/calendar workflows with novelty.

## Current Baseline Assessment

The current command center is visually solid. It has a strong workbench feel: left calendar, middle vacancy pipeline, right selected vacancy. The user can understand the daily story by scanning: what is today, which vacancies are active, which vacancy is selected, and what the nearest stage is.

Current design score: B+ after the 2026-06-26 typography/color pass.

AI slop score: A-. The app avoids the common AI-generated landing-page patterns. The remaining generic signal is now mostly small-surface polish, not core layout or palette.

The current calendar and vacancy surfaces should be kept. The best design work from here is not a new layout. It is consistency, typography, contrast, state clarity, and trust feedback.

## Story-First UX Principles

Every UI decision should support one of these user stories.

### Daily Control

Story: "I open OpenOffer and immediately know what needs attention today."

The first scan should show:

- Today or tomorrow's meetings.
- Active vacancies.
- The selected vacancy.
- The nearest stage.
- Whether calendar sync is trustworthy.

Do not add instructional copy. The layout should make the story obvious.

### Vacancy Triage

Story: "I track several vacancies without losing the next step."

The vacancy list should remain compact. Status and stage count should be visible, but the list should not turn into a button-heavy dashboard. The selected vacancy should feel stable and readable.

### Expanded Vacancy Work

Story: "I open one vacancy and edit the facts without fighting the app."

The expanded vacancy view should remain an editor-like surface. Fields, URLs, status, raw source text, and nearest stage are useful because the user wants control. Preserve direct editability.

### Stage Handling

Story: "I received a next-stage message and need to update the right vacancy."

The stage screen should keep explicit fields and visible save states. Calendar sync actions must state which provider they will use. If sync fails, show a readable popup with an i18n error key and code.

### AI Assistance

Story: "I paste recruiter text and AI proposes changes, but I approve them."

AI should behave like a reviewed proposal layer:

- It may parse text, find matching vacancies, and suggest stage updates.
- It must show the target vacancy, proposed writes, confidence, and source text.
- It must not silently mutate calendar or vacancy data.
- Chat should be the main AI surface, with local vacancy and resume context.

### Calendar Trust

Story: "I need to know whether OpenOffer really synced this meeting."

Calendar UI must be honest:

- Google cannot look connected when credentials are missing.
- macOS Calendar should be visible as an available provider when present.
- Sync buttons must describe the actual provider path.
- Provider failures should not make other providers look broken.

## Visual Rules

### Color

Use the existing graphite palette as the base:

- Background shell: `#111113`.
- Header/secondary shell: `#18181B`.
- Sidebar pane: `#18181B`.
- Main workspace pane: `#1E1E21`.
- Card/editor surface: `#242429`.
- Input surface: `#18181B`.
- Borders: low-contrast slate alpha.
- Focus/selection accent: `#67E8F9`.
- Primary action: white button on dark surface.
- Error: rose/red.
- Warning: amber.
- Success: green.

`#111113` is reserved for the outer shell, gutters, and window frame. Large task panes should sit on `#1E1E21`; otherwise the app reads black instead of graphite.

Color should communicate state, not decorate the interface.

### Typography

F-002 was implemented on 2026-06-26 without changing the locked calendar/vacancy UX:

- UI/body stack: Aptos, Avenir Next, SF Pro Text, Inter, system sans.
- Display stack: Avenir Next, Aptos Display, SF Pro Display, Inter, system sans.
- Mono stack: Geist Mono, JetBrains Mono, SF Mono, system mono.
- Negative tracking is normalized to `0` so compact panes do not look artificially squeezed.

No typography change should alter the locked calendar/vacancy UX.

### Spacing And Density

Use a 4px base rhythm. Keep app controls compact, but preserve practical hit targets where possible:

- Primary controls: 40-44px high.
- Dense secondary controls: 32-36px high only when the area is clearly desktop-first.
- Cards and editor sections: 6-8px radius.
- Avoid nested cards unless each nested block is a real editor/control group.

### Interaction States

Every interactive element needs visible hover and focus-visible states. Disabled states must look disabled and explain themselves through nearby state where necessary.

Date and calendar fields should use popovers, not manual raw date entry as the primary path.

### Errors

Errors should appear as readable popups/toasts, not inline clutter across the workspace. Every user-facing product error should have:

- Localized message.
- Stable i18n key.
- Machine-readable error code.
- Clear recovery action where possible.

## Settings

Settings should stay utilitarian and searchable. The sidebar search is a visual/navigation improvement, similar to IDE settings search. It should not introduce a new product mode.

Provider rows should show real state: available, needs setup, permission denied, sync target, read capability, write capability.

## External Reference Points

OpenOffer should borrow the right lessons from adjacent tools:

- Linear: command menus are most useful when actions are contextual to the current view or selection.
- Raycast: power-user desktop tools can make command search part of the product identity.
- Notion Agent: AI is trusted when permissions, context, proposed edits, and reversibility are clear.
- Teal, Huntr, Simplify: job-search trackers win by preserving application history and follow-up context, but OpenOffer should stay more local-first and interview-stage focused.

## Implementation Guardrails

Before visual UI work:

1. Check this file.
2. Confirm whether the requested work touches a locked UX surface.
3. If it touches calendar, vacancy list, or expanded vacancy structure, stop and ask before redesigning.
4. Prefer CSS/token polish over component restructuring.
5. Preserve Russian and English i18n.
6. Verify compact desktop and narrow viewport behavior.

## Current Implementation Notes

As of 2026-06-26:

- Top search is the primary command/AI entrypoint and uses the graphite card surface (`#242429`) rather than near-black custom fills.
- Vacancy parsing and stage-update writes open the unified AI chat proposal flow. Top search may detect intent, but it should not render a separate proposal editor.
- Ordinary AI chat now receives local vacancy context plus enabled profile/resume context before the launch query is submitted.
- Stage calendar sync labels are localized and provider-aware, for example "Synced to macOS Calendar" instead of raw states such as `linked`.
- Settings navigation hides experimental Skills and Modes entrypoints until the profile/context model is simplified.
- Settings has an `AI Context` section with profile status, profile-context toggle, and advanced intelligence controls behind disclosure.
- Settings search opens matching sections, supports arrow/Enter keyboard navigation, and does not expose hidden Skills/Modes.
- Latest Release 1/Release 2 verification covered i18n, TypeScript, top-search helper tests, main vacancy E2E flow, generic AI chat with vacancy/profile context, calendar settings/search smoke, and duplicate React key warning detection in the vacancy flow.

## Latest Design Docs Completion Status

Source docs checked on 2026-06-26:

- `/Users/alekseyk/.gstack/projects/luiz2047-OpenOffer/alekseyk-main-design-20260625-135844.md`
- `/Users/alekseyk/.gstack/projects/luiz2047-OpenOffer/designs/design-audit-20260625-221635/design-audit-openoffer.md`
- `/Users/alekseyk/.gstack/projects/luiz2047-OpenOffer/alekseyk-feat-release-1-stabilization-design-audit-20260625-155028.md`

Completion matrix:

- Release 1 Checkpoint 1, Calendar Trust: implemented in the roadmap task list and currently smoke-tested through provider-aware settings plus macOS sync labels.
- Release 1 Checkpoint 2, Shared Date/Time Picker: implemented; stage date editing opens the shared picker rather than requiring raw datetime typing.
- Release 1 Checkpoint 3, Calendar Navigation and Date Labels: implemented in the current roadmap status; no new redesign requested.
- Release 1 Checkpoint 4, Vacancy Surface Cleanup: implemented; current vacancy and expanded vacancy layouts are now locked by user feedback.
- Release 1 Checkpoint 5, Error UX and i18n: implemented in the roadmap task list; full release-bound verification should still run the broader error/i18n test set before packaging.
- Release 2 Checkpoint 6, Unified AI Chat: implemented for top-search parse/stage proposals, RU/EN stage-update fixtures, ambiguous match handling, and ordinary chat with vacancy/profile context.
- Release 2 Checkpoint 7, AI Engine and Settings Simplification: implemented for visible settings navigation; Skills/Modes are hidden, and profile intelligence is reframed as AI/profile context.
- Release 2 Checkpoint 8, Settings and Visual Polish: implemented for settings search, keyboard navigation, compact settings smoke, and graphite/typography polish.
- Design audit F-001, top command/search under-weighted: addressed within scope by stronger graphite active/opened treatment without changing layout.
- Design audit F-002, typography generic: addressed by the 2026-06-26 typography token pass.
- Design audit F-003, small targets: accepted as desktop-first polish; no structural calendar/vacancy change was made.
- Design audit F-004, raw sync state labels: addressed for stage calendar sync labels.
- Design audit F-005, duplicate React key warning: covered by the main vacancy E2E flow with duplicate-key warning detection.

Remaining release-bound gates before shipping a packaged build: broader `npm test` or documented targeted equivalent, `npm run build:electron`, package verification, and manual macOS calendar dogfood.
