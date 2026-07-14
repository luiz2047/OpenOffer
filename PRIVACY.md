# Privacy Policy

_Last updated: July 14, 2026_

OpenOffer is a free, open-source, local-first desktop assistant. The public build does not include a hosted OpenOffer API, license server, trial system, commercial gate, or managed subscription service.

## What Stays Local

Audio captures, screen captures, transcripts, notes, meeting history, settings, reference files, and the local SQLite database are stored on your device.

The first-release SQLite database is not SQLCipher-encrypted at rest. Use full-disk encryption and the in-app backup/delete controls when handling sensitive data. Recordings and transcript artifacts follow the retention setting shown in Settings.

## What Can Leave Your Device

Data leaves your device only after the corresponding provider is configured and you explicitly invoke the feature that requires it. Clean launch, deterministic recruiter-text parsing, manual preparation, manual review, and local database operations do not require an internet or localhost request. Examples of separately disclosed traffic include:

- AI providers such as OpenAI, Anthropic, Google Gemini, Groq, DeepSeek, Yandex AI Studio, or a compatible local/self-hosted endpoint.
- Speech-to-text providers such as GigaSTT, Local Whisper, OpenAI Whisper, Deepgram, ElevenLabs, Google, Azure, IBM, or Soniox.
- Search providers such as Tavily when search is enabled.
- GitHub release infrastructure for a manual update check. Background update checks are disabled until you separately enable them in Settings. Stable builds query stable releases; maintainer preview builds must explicitly opt into the preview channel.
- Google Analytics through Google Tag Manager only after the optional analytics setting is enabled. Analytics payloads are intended to contain aggregate feature events, not recruiter text, vacancy titles, transcripts, prompts, model output, file names, or stable local IDs.

External fonts are not loaded. The desktop UI uses bundled or system fonts.

Each third-party provider has its own privacy policy and retention behavior. Review the provider terms before sending sensitive content.

For Yandex AI Studio, OpenOffer sends `x-data-logging-enabled: false` by default on connection tests, generation, and streaming. Your text still leaves the device when you choose Yandex as a cloud provider.

## No OpenOffer Cloud Account

The public OpenOffer build does not create an OpenOffer account, collect billing records, validate licenses, or meter hosted quota.

## Optional Telemetry

Maintainers may configure their own telemetry or install-count endpoint in custom builds. The default public build ships with project install ping disabled.

## Contact

Use GitHub issues or discussions for questions about this policy:
https://github.com/luiz2047/openoffer
