# Recruiter Chat to Process Demo

This demo is the first public OpenOffer story: turn a messy recruiter chat into a local interview process.

Use fictional or redacted data when recording screenshots or filing issues.

## Sample Input

```text
Рекрутер: Алексей, привет! Есть роль Senior/Lead ML Engineer.
Компания: ExampleAI, remote EU-friendly.
Стек: Python, CV, OCR, LLM evaluation, production MLOps.
Процесс: 1) intro 30 min, 2) technical interview, 3) system design.
ЗП: обсуждаем, ориентир 7-9k EUR gross.
Можем созвониться во вторник в 16:00 MSK? Вот ссылка на Google Meet: [redacted]
Описание вакансии ниже:
Нужно владеть production ML, строить пайплайны оценки качества моделей, общаться с продуктом и ревьюить архитектуру.
```

## Expected OpenOffer Output

OpenOffer should propose:

- New vacancy: `ExampleAI - Senior/Lead ML Engineer`.
- Stage: `Intro call`, scheduled for Tuesday 16:00 MSK.
- Meeting link: redacted and stored only locally.
- Compensation note: `7-9k EUR gross`.
- Role tags: `Python`, `CV`, `OCR`, `LLM evaluation`, `MLOps`.
- Prep brief: production ML examples, CV/OCR cases, model-evaluation tradeoffs, system-design questions.
- Question bank: recruiter questions, technical deep dives, product/leadership questions.
- Follow-up tasks: confirm meeting, prepare portfolio examples, attach resume/JD, record retro after call.

## Manual Walkthrough

1. Start OpenOffer:

   ```bash
   npm run app:dev
   ```

2. Open the Interview Command Center.
3. Paste the sample input into the recruiter/vacancy intake flow.
4. Confirm whether OpenOffer should create a new vacancy or attach a stage to an existing vacancy.
5. Review the generated prep brief and question bank.
6. After a test call or mock transcript, link the recording/transcript to the stage and write a retro.

## Demo Media Capture

Public demo media should be captured from this exact fictional scenario.

Recommended outputs:

- `assets/demo/recruiter-chat-to-process.mp4` for release notes and launch posts.
- `assets/demo/recruiter-chat-to-process.gif` for README embedding if it remains small and legible.
- `assets/demo/recruiter-chat-to-process.png` as a static fallback.

Do not add a README image or video reference until the file exists in the repository.

## What Contributors Can Improve

- Add more redacted examples for HH, Getmatch, Telegram, LinkedIn, email, and calendar invites.
- Improve parsing when compensation, schedule, location, and role title are ambiguous.
- Improve Russian and mixed Russian/English prompt reliability.
- Add tests for duplicate vacancy detection and stage matching.
- Add screenshots or a short demo video without private data.

## Privacy Rules for Demo Assets

- Do not include real meeting links.
- Do not include real recruiter names unless they gave permission.
- Do not include private compensation, resume, employer, transcript, or offer details.
- Prefer fictional examples or heavily reduced text.
