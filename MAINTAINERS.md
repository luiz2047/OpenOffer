# OpenOffer Maintainer Guide

This document sets expectations for public contribution review.

## Review Priorities

1. Protect the local-first privacy boundary.
2. Preserve clear user workflows over broad generic AI features.
3. Keep Electron IPC, provider routing, and local storage changes reviewable.
4. Keep docs and release promises aligned with what is actually shipped.
5. Prefer small PRs with concrete verification.

## Triage Labels

Recommended public labels:

- `area: docs`
- `area: onboarding`
- `area: interview-workspace`
- `area: local-stt`
- `area: providers`
- `area: privacy`
- `area: release`
- `area: i18n`
- `needs reproduction`
- `needs design`
- `first-timers-only`
- `good first issue`
- `help wanted`
- `ru`

## Review Expectations

- Acknowledge new high-quality issues within a few days when possible.
- Ask for a redacted reproduction instead of accepting private data in public threads.
- Move support and broad product discussion to Discussions.
- Keep starter issues scoped to one sitting.
- Require tests or manual evidence for behavior changes.
- Require docs updates for setup, release, provider, privacy, or user-visible workflow changes.

## Merge Bar

A PR can merge when:

- The change is scoped and understandable.
- Privacy/provider boundaries are explicit.
- Relevant checks pass or skipped checks are justified.
- User-facing copy is localized when applicable.
- Release/docs claims match the implemented behavior.

## Security Reports

Do not triage vulnerabilities in public issues. Use [SECURITY.md](SECURITY.md) and GitHub private advisories.
