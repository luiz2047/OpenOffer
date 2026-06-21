# Interface Translations

OpenOffer has built-in interface translations for English and Russian.
Users can add custom translations without rebuilding the app by placing data-only
JSON packs in the app-data translations folder.

Interface language is separate from:

- transcription language, which controls what the STT provider listens for;
- AI response language, which controls what assistant suggestions and notes use;
- user content such as meeting titles, transcripts, notes, and AI-generated answers.

## Current Coverage

The current localized shell covers:

- Settings navigation and core General language controls;
- Launcher shell, top search assistant, onboarding popovers, and calendar refresh feedback;
- Interview Command Center shell for the first-screen calendar/interview workflow;
- live overlay warnings, quick actions, screenshot attachment copy, and input placeholder;
- first-run permissions onboarding shell.

Deep provider setup screens, historical engineering docs, native OS permission strings, and tray/native menu copy are not part of this MVP.

## Locale Files

Translation resources live in:

- `src/i18n/resources.ts`
- `src/i18n/locales.ts`

Supported built-in preferences are `system`, `en`, and `ru`. `system` resolves to Russian for `ru-*` system locales, English for `en-*` locales, and valid custom packs when their locale matches the system language.

Custom packs live under the Electron user-data folder:

```text
<OpenOffer user data>/translations/<locale>/
```

Open the exact folder from Settings -> General -> Translation packs -> Open Folder.

Example:

```text
translations/
  pl/
    manifest.json
    common.json
    settings.json
    launcher.json
    overlay.json
    interviews.json
```

`manifest.json`:

```json
{
  "schemaVersion": 1,
  "locale": "pl",
  "label": "Polish",
  "nativeLabel": "Polski",
  "fallback": "en",
  "direction": "ltr"
}
```

## Key Rules

- Use dot-separated keys grouped by product surface: `common`, `settings`, `launcher`, `interviews`, `topSearch`, `overlay`, `onboarding`, `search`.
- Keep values plain text. Do not add HTML.
- Keep interpolation placeholders identical across languages, for example `{{count}}` or `{{version}}`.
- Use i18next plural suffixes for count strings: `_one`, `_few`, `_many`, `_other` as needed.
- Do not translate provider names, model names, company names, user notes, transcripts, calendar titles, or generated AI responses.

## Pack Validation

Custom packs are scanned in the main process before resources reach the renderer.

- Locale folder and `manifest.locale` must match, for example `pl` or `pt-br`.
- Custom packs cannot override built-in `en` or `ru`.
- Only JSON files named for supported groups are loaded.
- Pack size is capped at 2 MB.
- Each namespace file is capped at 512 KB.
- Each string is capped at 2,000 Unicode code points.
- Values must be strings or nested objects. Arrays, HTML, JavaScript, and remote URLs are rejected.
- Missing keys are allowed and fall back to English.

## Contributor Workflow

1. Add or update keys in `src/i18n/resources.ts`.
2. Use `t('namespace.key')` in React components.
3. Run:

```bash
npm run i18n:check
npm run test:i18n
```

4. For UI changes, manually switch Settings -> General -> Interface language between English and Русский and check the migrated surface.
5. For custom packs, use Settings -> General -> Translation packs -> Refresh after editing files.
