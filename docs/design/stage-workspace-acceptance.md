# Stage Workspace acceptance ledger

This file tracks the evidence for the Stage Workspace rollout described in the
design document. It deliberately separates deterministic/local evidence from
acceptance that requires a physical device, signing identity, or real users.

## Verified locally

- Stage-owned reads and writes are revision-aware and replay-safe.
- Recording entrypoints (stage card, global start, legacy IPC) require the
  selected workspace and durable session handshake.
- Calendar linking and manual recording attachment update the workspace
  revision and reject cross-stage ownership drift.
- Preparation, transcript, summary, AI-review draft, next action, export, and
  recovery paths are stage-strict.
- Stage-session deletion is explicit, revision-aware, blocked for active or
  review-source sessions, and cascades context/artifact/transcript rows.
- Five isolated multi-stage synthetic dogfood runs complete without leakage.
- Legacy v19 schema migration fixture opens successfully.
- Upgrade/recovery matrix replays the migration idempotently, backs up the
  upgraded database, and reopens the restored copy with legacy data intact.
- Clean-launch network policy and packaged launch smoke pass.
- Telemetry consent is stored independently from updater consent with a policy
  version and grant timestamp; clean launch still fails closed.
- Runtime clean-launch network smoke observes the packaged process and rejects
  established outbound connections before consent.
- Public docs, localization, full regression, Electron typecheck, renderer
  build, and packaged macOS smoke pass.
- Full Playwright E2E passes 12 tests with 4 intentional skips (including the
  physical-media capture scenario).

## Reproducible commands

```bash
npm test
npm run typecheck:electron
npm run build
npm run public-docs:check
npm run i18n:check
npm run build:electron
ELECTRON_RUN_AS_NODE=1 ./node_modules/.bin/electron --test \
  electron/services/__tests__/StageWorkspaceDogfood.test.mjs \
  electron/services/__tests__/StageWorkspaceRecovery.test.mjs \
  electron/services/__tests__/StageWorkspaceInvalidation.test.mjs \
  electron/services/__tests__/LegacySchemaFixture.test.mjs \
  electron/services/__tests__/UpgradeRecoveryMatrix.test.mjs \
  electron/services/__tests__/CleanLaunchNetworkPolicy.test.mjs
node scripts/packaged-launch-smoke.mjs \
  release/mac-arm64/OpenOffer.app/Contents/MacOS/OpenOffer
OPENOFFER_REQUIRE_NETWORK_CAPTURE=1 node scripts/clean-launch-network-smoke.mjs \
  release/mac-arm64/OpenOffer.app/Contents/MacOS/OpenOffer
```

## Still required before public beta

- Two consented interviews using a physical microphone, system audio, and the
  supported STT path; record the provider, OS permissions, transcript result,
  stop/recovery behavior, and resulting review/next action.
- Clean install and upgrade matrix from every supported public version.
- Developer ID signing, notarization, stapling, and Gatekeeper install on
  macOS; no `xattr` workaround is acceptable for the official channel.
- Authenticode signing and SmartScreen install verification on Windows.
  The workflow path is implemented; it remains pending until
  `WINDOWS_CERT_P12_BASE64` and `WINDOWS_CERT_PASSWORD` are configured and a
  signed artifact is installed on a clean Windows runner.
- Packet-capture verification that clean launch makes no network request until
  the corresponding consent or explicit product action. The release workflow
  now observes macOS/Linux with `lsof` and Windows with PowerShell
  `Get-NetTCPConnection`; a clean install still needs to be observed on each
  supported OS.
- Retention/delete verification on a real user database, including recordings,
  transcripts, context snapshots, exports, and recovery after restart.

These items are intentionally not marked complete by mocked renderer tests or
synthetic fixtures.
