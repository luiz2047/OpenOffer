# Contributing to OpenOffer

First off, thank you for considering contributing to OpenOffer. Contributions help keep the project local-first, free, and open source.

Following these guidelines helps to communicate that you respect the time of the developers managing and developing this open source project. In return, they should reciprocate that respect in addressing your issue, assessing changes, and helping you finalize your pull requests.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
  - [Reporting Bugs](#reporting-bugs)
  - [Suggesting Enhancements](#suggesting-enhancements)
  - [Pull Requests](#pull-requests)
- [Development Workflow](#development-workflow)
  - [Prerequisites](#prerequisites)
  - [Local Development](#local-development)
  - [Architecture Overview](#architecture-overview)
- [Styleguides](#styleguides)
  - [Git Commit Messages](#git-commit-messages)

## Code of Conduct

This project and everyone participating in it is governed by the [OpenOffer Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to the maintainers listed in that document.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the issue tracker as you might find out that you don't need to create one. When you are creating a bug report, please include as many details as possible:

- Use a clear and descriptive title for the issue to identify the problem.
- Describe the exact steps which reproduce the problem in as many details as possible.
- Provide specific examples to demonstrate the steps.
- Describe the behavior you observed after following the steps and point out what exactly is the problem with that behavior.
- Explain which behavior you expected to see instead and why.
- Include screenshots and animated GIFs which show you following the described steps and clearly demonstrate the problem.
- Specify your OS version.
- Specify your Node/Npm versions.

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When you are creating an enhancement suggestion, please include:

- Use a clear and descriptive title for the issue to identify the suggestion.
- Provide a step-by-step description of the suggested enhancement in as many details as possible.
- Provide specific examples to demonstrate the steps.
- Describe the current behavior and explain which behavior you expected to see instead and why.
- Explain why this enhancement would be useful to most OpenOffer users.

### Pull Requests

- Fill in the required template
- Do not include issue numbers in the PR title
- Include screenshots and animated GIFs in your pull request whenever possible.
- Follow the TypeScript and React styleguides.
- Document new code based on the Documentation Styleguide.
- End all files with a newline.

## Development Workflow

### Prerequisites

- Node.js 22 LTS recommended. Node 20 may work, but Node 22 is the preferred baseline for current local development.
- Git
- Rust (required for native audio capture compilation)

### Local Development

1. Fork the repo and create your branch from `main`.
2. Clone your fork locally: `git clone https://github.com/YOUR_USERNAME/openoffer.git`
3. Install dependencies: `npm install`
4. If you need provider credentials, copy `.env.example` to `.env` and fill in local values.
5. Start the development server: `npm run app:dev`

If you've added code that should be tested, add tests.
If you've changed APIs, update the documentation.
Ensure the test suite passes.

If you add or change interface copy, update the English and Russian entries in
`src/i18n/resources.ts` and run `npm run i18n:check`. User-owned languages can
also be tested as data-only custom packs from the app-data translations folder.
See `docs/translations.md` for key naming, interpolation, pack validation, and
plural rules.

### Architecture Overview

OpenOffer uses a modern stack consisting of:

- **Frontend**: React, Vite, TypeScript, TailwindCSS
- **Backend/Desktop**: Electron
- **Native Audio**: Rust (`napi-rs` for zero-copy ABI transfers)
- **Database**: SQLite (local storage with `sqlite-vec` for RAG)

When contributing, ensure you understand which context (Main Process, Renderer Process, or Native/Rust addon) your code will run in, and use the IPC correctly for communication.

## Styleguides

### Git Commit Messages

- Use the present tense ("Add feature" not "Added feature")
- Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
- Limit the first line to 72 characters or less
- Reference issues and pull requests liberally after the first line
- Consider starting the commit message with an applicable emoji:
  - 🎨 `:art:` when improving the format/structure of the code
  - 🐎 `:racehorse:` when improving performance
  - 🚱 `:non-potable_water:` when plugging memory leaks
  - 📝 `:memo:` when writing docs
  - 🐧 `:penguin:` when fixing something on Linux
  - 🍎 `:apple:` when fixing something on macOS
  - 🏁 `:checkered_flag:` when fixing something on Windows
  - 🐛 `:bug:` when fixing a bug
  - 🔥 `:fire:` when removing code or files
  - 💚 `:green_heart:` when fixing the CI build
  - ✅ `:white_check_mark:` when adding tests
  - 🔒 `:lock:` when dealing with security
  - ⬆️ `:arrow_up:` when upgrading dependencies
  - ⬇️ `:arrow_down:` when downgrading dependencies

Thank you for contributing to OpenOffer!
