# Yandex AI Studio Setup

OpenOffer supports Yandex AI Studio as an optional BYOK text provider. It is selectable like other cloud models, but it is not used for screenshots or vision routes.

## Prerequisites

- A Yandex Cloud folder with AI Studio access and billing enabled.
- A Yandex AI Studio API key.
- The folder ID for the project that owns the model access.

Official references:

- [Yandex AI Studio quickstart](https://aistudio.yandex.ru/docs/en/ai-studio/quickstart/)
- [Yandex AI Studio models](https://aistudio.yandex.ru/docs/en/ai-studio/concepts/generation/models.html)
- [Disable request logging](https://aistudio.yandex.ru/docs/en/ai-studio/operations/disable-logging.html)

## Configure In OpenOffer

1. Open Settings, then AI Providers.
2. In Yandex AI Studio, enter the API key and folder ID.
3. Keep Request data logging Off unless you explicitly want provider-side request logging.
4. Pick a model. The default is YandexGPT 5 Lite.
5. Choose an Answer style. Automatic is recommended; for Russian YandexGPT flows it uses the Russian interview behavior by default.
6. Click Test Connection.
7. Click Save.
8. Choose a `yandex/...` model in Default Model for Chat if you want Yandex to be the primary model.

OpenOffer stores model IDs as stable values like `yandex/yandexgpt-5-lite`. At request time it expands them to Yandex model URIs like `gpt://<folderId>/yandexgpt-5-lite`. The folder ID is not stored in the default model string.

## Runtime Behavior

- Text generation and streaming use Yandex AI Studio's OpenAI-compatible Chat Completions endpoint.
- Requests include `x-folder-id`.
- When Request data logging is Off, requests include `x-data-logging-enabled: false`.
- Local-only mode and provider data-scope settings block Yandex before outbound calls.
- Screenshot and vision requests do not use Yandex in this version.

## Source Smoke Test

```bash
npm install
npm run app:dev
npm run typecheck:electron
npm run test:answer-style-yandex
npx tsc --noEmit
npm run test:llm
npm run test:services
```

Manual smoke path:

1. Save a Yandex API key and folder ID.
2. Run Test Connection.
3. Set Default Model for Chat to YandexGPT 5 Lite.
4. Keep Answer style on Automatic, or switch to Strict/Grounded for conservative interview answers.
5. Ask a short text-only question.
6. Confirm the response streams and screenshots still route to a vision-capable provider or show a text-only provider message.

## Errors

| Error | Likely Cause | Fix |
| --- | --- | --- |
| Yandex API key is required | No key was entered or saved. | Enter the AI Studio API key and save again. |
| Yandex folder ID is required | The folder ID field is empty. | Add the Yandex Cloud folder ID. |
| Invalid or unauthorized key or folder | Key, IAM permissions, billing, or folder mismatch. | Verify billing, folder access, and key permissions in Yandex Cloud. |
| Model unavailable | The selected model is not available for the folder. | Pick another Yandex model or verify model access. |
| Cloud providers disabled in local-only mode | OpenOffer is configured to block outbound provider calls. | Use a local model or disable local-only mode for this request. |

## Advanced Models

The built-in list is intentionally small and stable. For unsupported Yandex-compatible models in v1, use Custom Provider or a LiteLLM/OpenAI-compatible proxy instead of storing raw `gpt://...` URIs as default models.
