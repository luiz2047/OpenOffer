# Security Policy

_Last updated: June 16, 2026_

OpenOffer is a local-first desktop app. Security reports are welcome, especially for privacy boundaries, Electron IPC, update integrity, local credential storage, prompt-injection boundaries, audio/screen capture behavior, and dependency supply-chain issues.

## Supported Versions

Security fixes target the current `main` branch and the latest GitHub release when releases are available.

## Reporting

Please do not disclose an unpatched vulnerability publicly before maintainers have had a reasonable chance to investigate.

Report issues through GitHub:
https://github.com/luiz2047/openoffer/security/advisories/new

If private advisories are not available, open a minimal issue asking for a private security contact without publishing exploit details.

## Scope

In scope:

- Electron main/renderer/preload boundaries.
- Audio, microphone, screen capture, and permission handling.
- Local credential storage and redaction.
- Auto-update metadata and release integrity.
- Local STT and provider routing.
- Prompt-injection and data-exfiltration boundaries where OpenOffer assembles prompts or sends data to configured providers.

Out of scope:

- Third-party AI/STT/search provider infrastructure.
- User-configured self-hosted endpoints not maintained by this project.
- Social engineering, spam, or reports requiring physical access without a software vulnerability.

## Safe Harbor

Good-faith research that avoids data destruction, avoids service disruption, and gives maintainers time to respond is authorized for this project.
