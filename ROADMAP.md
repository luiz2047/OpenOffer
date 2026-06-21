# OpenOffer Roadmap

OpenOffer's public wedge is a local-first job-search and interview workspace.

The goal is not to be a generic chatbot wrapper. The goal is to help users turn messy recruiter, vacancy, interview, meeting, and follow-up context into a private process they can inspect and improve.

## Now

- Make the recruiter-chat-to-process demo the primary first-run story.
- Keep the README, release docs, issue templates, and contribution guide aligned with the current product.
- Publish the first GitHub Release as an unsigned macOS preview, then replace it with signed/notarized artifacts once signing secrets are configured.
- Add contributor-oriented labels and starter issues.
- Improve focused CI around docs, i18n, build, Electron contracts, provider boundaries, and Interview Command Center behavior.

## Next

- Better parsing for HH, Getmatch, Telegram, calendar, and email-style recruiter text.
- Clearer first-run provider setup for Ollama, Local Whisper, GigaSTT, Yandex AI Studio, and OpenAI-compatible endpoints.
- More Russian local STT diagnostics and test fixtures.
- Stage-level transcript, retro, and follow-up workflows.
- Release QA checklist with preview install verification now and signed macOS artifact verification once Apple credentials are configured.
- Good-first-issue docs for local setup, demo recording, screenshots, and translation packs.

## Later

- Offer and negotiation workflows.
- Job-search monitoring and application pipeline tools.
- More local model presets and provider health checks.
- Wider packaging support for Windows and Linux releases.
- Stronger local-data encryption and export/import workflows.
- Community-maintained workflow packs for different interview styles and job markets.

## Contribution Lanes

- `area: docs`
- `area: onboarding`
- `area: interview-workspace`
- `area: local-stt`
- `area: providers`
- `area: privacy`
- `area: release`
- `area: i18n`
- `good first issue`
- `help wanted`
