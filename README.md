# Ship Brief Builder

Internal ship briefs from Git commits. Synthesized outcomes, not a raw changelog dump, and not a LinkedIn post generator.

Desktop web app. Turkish and English. Single workspace per signed-in user.

## What you get

1. Connect GitHub (GitHub App user OAuth preferred; classic OAuth App also works) **or** use the built-in sample repo
2. Pick repository, branch, and range: **base..head** (default) or **last N commits** (default 50, 1–500)
3. Curate: ~90% pre-selected (merge / chore / deps noise dropped), bulk include/exclude, merge into groups, LLM group suggestions with Apply/Ignore
4. Generate a brief in the UI language (optional override)
5. Export the **same content tree** as PDF, Word (`.docx`), and Markdown

### Brief shape (all locales)

1. Title: `owner/repo@branch` + range
2. Summary (2–4 sentences)
3. Changes under headings (empty headings omitted): Improvements | Geliştirmeler, Bug fixes | Hata düzeltmeleri, Other | Diğer
4. Footnote stats only: commit count, authors, file ±, count left out of brief
5. Optional collapsed appendix: source commits (hash + one line) — not the main body

Commit **messages** stay in their source language. Headings, summary, and skeleton follow the brief locale.

## Stack

- Next.js 15 (App Router) + TypeScript
- PostgreSQL + Prisma
- NextAuth (GitHub OAuth + demo credentials)
- Octokit (`@octokit/rest`)
- OpenAI-compatible LLM (env or BYOK) with a heuristic fallback
- `pdf-lib` (embedded IBM Plex Sans, so Turkish glyphs work) + `docx`

## Quick start (demo, no GitHub App)

Requires Node 20+ and PostgreSQL 16.

```bash
cp .env.example .env
# set NEXTAUTH_SECRET (openssl rand -base64 32)
# DATABASE_URL defaults to postgresql://shipbrief:shipbrief@localhost:5432/shipbrief

# Postgres via Docker:
docker compose up -d

# or a local cluster, then:
#   createuser shipbrief && createdb -O shipbrief shipbrief

npm install
npx prisma migrate deploy
npm test
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) → **Try sample repo** → last N commits → curate → generate → export.

The sample history is `acme/checkout-service` (fixture commits). Demo mode never calls GitHub.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `NEXTAUTH_URL` | yes | App origin, e.g. `http://localhost:3000` |
| `NEXTAUTH_SECRET` | yes | Session signing secret |
| `GITHUB_CLIENT_ID` | for real repos | GitHub App or OAuth App client ID |
| `GITHUB_CLIENT_SECRET` | for real repos | Matching client secret |
| `GITHUB_SCOPE` | no | Default `read:user repo` (use `read:user public_repo` for public-only) |
| `OPENAI_API_KEY` | no | Server-side LLM key. If empty, grouping + synthesis use heuristics |
| `OPENAI_BASE_URL` | no | OpenAI-compatible base, default `https://api.openai.com/v1` |
| `OPENAI_MODEL` | no | Default `gpt-4o-mini` |
| `MOCK_GITHUB` | no | `true` forces fixture repos/commits even with a GitHub token (CI) |

BYOK: on the generate screen you can paste an OpenAI-compatible key. It is stored **only in this browser** (`localStorage`) and sent for that request; it is not written to the database.

## GitHub: App (preferred) or OAuth App

NextAuth uses the GitHub **OAuth user flow**. A GitHub App’s Client ID / Client Secret work for that flow and are preferred because permissions are least-privilege.

### GitHub App

1. GitHub → **Settings** → **Developer settings** → **GitHub Apps** → **New GitHub App**
2. Homepage URL: `http://localhost:3000` (or your deployed origin)
3. Callback URL: `{origin}/api/auth/callback/github`
4. Deselect webhooks if you do not need them
5. Repository permissions: **Contents: Read-only**, **Metadata: Read-only**
6. Where can this GitHub App be installed: your account, or any account
7. Create the app, then **generate a client secret**
8. Put Client ID / secret in `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`
9. **Install** the app on the accounts/orgs whose repositories you will brief

### Classic OAuth App (acceptable for MVP)

1. **Settings** → **Developer settings** → **OAuth Apps** → **New OAuth App**
2. Homepage: `{origin}`
3. Authorization callback URL: `{origin}/api/auth/callback/github`
4. Copy client ID / secret into the same env vars

If these env vars are empty, the UI hides a working GitHub button and tells you to use the sample repo (this is how CI / first-run works without registering an app).

## Architecture

```
src/app            App Router pages + API
src/components     Desktop UI (curation is the dense screen)
src/lib            GitHub, curation heuristics, LLM, exports, i18n
prisma             PostgreSQL schema (User, Draft)
```

Happy path:

1. `POST /api/drafts` creates a draft for `owner/repo`
2. Range screen saves branch + `base..head` or last N
3. `POST /api/drafts/:id/load` fetches commits (Octokit or fixtures), applies the noise filter, stores curation JSON
4. Curation PATCHes selection + groups (does **not** touch git)
5. `POST /api/drafts/:id/suggest` returns LLM or heuristic groups (Apply / Ignore)
6. `POST /api/drafts/:id/generate` writes a `BriefDocument`
7. `GET /api/drafts/:id/export?format=md|pdf|docx` renders that same tree

i18n is a compact **TR | EN** toggle (top right). Default is `tr` when `Accept-Language` / browser language starts with `tr`, otherwise English. The generate step can override brief language independently of the UI.

## Scripts

- `npm run dev` — Next.js dev server
- `npm test` — Vitest (filter, i18n key parity, synthesis, PDF/DOCX bytes)
- `npm run build` / `npm start` — production
- `npx prisma migrate deploy` — apply migrations

## Out of this MVP

LinkedIn / Teams / Canva publish, suggestion cards, sprint dashboard, multi-tenant RBAC, GitLab / Bitbucket, iOS, freemium billing. Stripe can wait.

IBM Plex Sans (SIL Open Font License) is vendored under `src/fonts` for PDF embedding.
