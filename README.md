# Pulseboard

Frontend half of a two-repository customer-feedback application built to test multi-repository
Novus analysis. The Fastify API lives in
[`TalBaram-work/novus-feedback-backend`](https://github.com/TalBaram-work/novus-feedback-backend).

## Features

- Switch between seeded visitors from three customer accounts
- Submit ideas, vote, and filter the roadmap by status
- Optional Pendo initialization and track events for realistic usage data
- Responsive React and TypeScript UI

## Run locally

Start the backend first, then:

```bash
corepack enable
pnpm install
cp .env.example .env
pnpm dev
```

Open `http://localhost:5173`.

## Pendo and Novus

Set `VITE_PENDO_API_KEY` and optionally `VITE_PENDO_CDN_HOST` before starting or building the app.
The selected seeded visitor is sent to Pendo with account, plan, and role metadata. The app emits:

- `feedback_vote_toggled`
- `feedback_vote_failed`
- `feedback_submitted`
- `feedback_submission_failed`
- `feedback_filter_changed`
- `visitor_switched`

Connect this repository and the backend repository to the same Novus app to exercise multi-repo
code context.

## Checks

```bash
pnpm test
pnpm typecheck
pnpm build
```

## Deploy

Build the included `Dockerfile` with `VITE_API_URL` set to the deployed backend. Pendo values are
also build arguments because Vite embeds them at build time.
