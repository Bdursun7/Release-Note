# Release Note Builder

Release notes from Git commits. Readable outcomes, not a raw changelog dump, and not a social-post generator.

Desktop web app. Turkish and English. Single workspace per signed-in user.

## What you get

1. Connect GitHub with a **personal access token** (recommended locally) or optional OAuth **or** use the built-in sample repo
2. Pick repository, branch, and range: **last N commits** is the default (50, 1–500); **two refs** (GitHub Compare `base...head`) is optional
3. Review: ~90% pre-selected (merge / chore / deps noise dropped), drop noise, optional groups, LLM group suggestions with Apply/Ignore
4. Generate notes in the UI language (optional override)
5. Export the **same content tree** as PDF, Word (`.docx`), and Markdown

### Notes shape (all locales)

1. Title: `owner/repo@branch` + range
2. Summary (2–4 sentences)
3. Changes under headings (empty headings omitted): Improvements | Geliştirmeler, Bug fixes | Hata düzeltmeleri, Other | Diğer
4. Under each heading: **group name**, then that group’s outcome bullets/description (ungrouped changes stay as bullets)
5. Footnote stats only: commit count, authors, file ±, count left out of notes
6. Optional collapsed appendix: source commits (hash + one line) — not the main body

Commit **messages** stay in their source language. Headings, summary, and skeleton follow the notes locale.

## Stack

- Next.js 15 (App Router) + TypeScript
- PostgreSQL + Prisma
- NextAuth (GitHub PAT or OAuth; optional isolated demo credentials in development)
- Octokit (`@octokit/rest`) — Compare API uses **three-dot** `base...head`
- OpenAI-compatible LLM (env for GitHub users, or BYOK) with a heuristic fallback — the UI warns when that fallback is used (it is not presented as full synthesis)
- `pdf-lib` (embedded IBM Plex Sans, so Turkish glyphs work) + `docx`

## Quick start

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

Open [http://localhost:3000](http://localhost:3000).

**Real repos (local dogfood):** **Connect GitHub** → paste a classic or fine-grained [personal access token](https://docs.github.com/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token). You do **not** need `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`. Then pick a repo → last N or two refs → curate → generate → export.

**Sample repo (no GitHub):** **Try sample repo** → last 50 commits (recommended) → review → generate → export.

The sample history is `acme/checkout-service` (fixture commits). Named refs such as `v1.4.0` and `main` are honored (not the whole fixture). Demo mode never calls GitHub. In production, sample sign-in stays off unless `ALLOW_DEMO_AUTH=true`.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `NEXTAUTH_URL` | yes | App origin, e.g. `http://localhost:3000` |
| `NEXTAUTH_SECRET` | yes | Session signing secret |
| `GITHUB_CLIENT_ID` | no | OAuth App / GitHub App client ID. Optional if you connect with a PAT. |
| `GITHUB_CLIENT_SECRET` | no | Matching client secret. Optional if you connect with a PAT. |
| `GITHUB_SCOPE` | no | Default `read:user public_repo` (read-only public). Classic OAuth has **no private read-only scope**; set `read:user repo` only if you need private repos. Prefer a GitHub App with **Contents: Read-only**. |
| `ALLOW_DEMO_AUTH` | no | Sample-repo sign-in. Default **on** in development, **off** in production. Set `true` to enable on a deploy. Each click creates an isolated user (not a shared `demo@` account). Demo never uses `OPENAI_API_KEY`; BYOK is rate-limited. |
| `OPENAI_API_KEY` | no | Server-side LLM key for **GitHub-signed-in** users. If empty, grouping + synthesis use a **basic summary from commit subjects** and the generate/notes UI shows a warning. Not used for demo sessions. |
| `OPENAI_BASE_URL` | no | OpenAI-compatible base, default `https://api.openai.com/v1` |
| `OPENAI_MODEL` | no | Default `gpt-4o-mini`. **Groq users should set `OPENAI_MODEL=openai/gpt-oss-20b`** (`llama-3.3` is deprecated) and `OPENAI_BASE_URL=https://api.groq.com/openai/v1`. |
| `MOCK_GITHUB` | no | `true` forces fixture repos/commits even with a GitHub token (CI) |

BYOK: on the generate screen you can paste an OpenAI-compatible key. It is stored **only in this browser** (`localStorage`) and sent for that request; it is not written to the database. Demo/sample sessions that send BYOK are rate-limited (per user, IP, and globally).

## GitHub: personal access token (recommended locally)

You can list your repos without registering an OAuth app.

1. GitHub → **Settings** → **Developer settings** → [Personal access tokens](https://docs.github.com/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token)
2. Create a **classic** or **fine-grained** token
   - Classic, public repos: `public_repo` (and `read:user` is implied for `/user`)
   - Classic, private repos: `repo`
   - Fine-grained: grant the repositories you want; **Contents: Read-only**, **Metadata: Read-only**
3. On the landing page, paste the token and connect
4. The token is validated with GitHub `GET /user`, then stored **only on the server** in the encrypted NextAuth JWT (same as OAuth `accessToken`). `/api/auth/session` never includes it. Sign out clears it.

If `GITHUB_CLIENT_ID` is empty, **Connect GitHub** uses this PAT flow instead of sending you to a broken GitHub authorize URL.

## GitHub OAuth App (optional, production-like login)

NextAuth can also use the GitHub **OAuth user flow**. A GitHub App’s Client ID / Client Secret work for that flow and are preferred for one-click login because permissions are least-privilege. This is optional when PAT is enough.

Callback URL: `{NEXTAUTH_URL}/api/auth/callback/github` (e.g. `http://localhost:3000/api/auth/callback/github`).

If Client ID / secret are missing or invalid, the app **does not** redirect to GitHub’s 404 page. You get an in-app error and the PAT form.

### GitHub App

1. GitHub → **Settings** → **Developer settings** → **GitHub Apps** → **New GitHub App**
2. Homepage URL: `http://localhost:3000` (or your deployed origin)
3. Callback URL: `{origin}/api/auth/callback/github`
4. Deselect webhooks if you do not need them
5. Repository permissions: **Contents: Read-only**, **Metadata: Read-only** (this is the read-only path; GitHub Apps do not use the classic `repo` write scope)
6. Where can this GitHub App be installed: your account, or any account
7. Create the app, then **generate a client secret**
8. Put Client ID / secret in `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`
9. **Install** the app on the accounts/orgs whose repositories you will brief

### Classic OAuth App (acceptable for MVP)

1. **Settings** → **Developer settings** → **OAuth Apps** → **New OAuth App**
2. Homepage: `{origin}`
3. Authorization callback URL: `{origin}/api/auth/callback/github`
4. Copy client ID / secret into the same env vars
5. Default scopes are `read:user public_repo`. Private repositories require `GITHUB_SCOPE=read:user repo` because classic OAuth has no private read-only scope — prefer a GitHub App instead.

If these env vars are empty, **Connect GitHub** still works via PAT. Sample-repo sign-in remains available in development.

### Empty repository list

`/api/repos` calls GitHub `repos.listForAuthenticatedUser` with the server-side token. An empty list usually means:

- Fine-grained PAT / GitHub App does not include those repositories (install the app, or grant the token access)
- Classic OAuth / PAT is missing `repo` (private) or `public_repo` (public). Operators can set `GITHUB_SCOPE=read:user repo` for OAuth
- Session has no token (sign out and connect again with PAT or OAuth)

The repos screen explains this instead of showing a blank “no matches” row.

## Architecture

```
src/app            App Router pages + API
src/components     Desktop UI
src/lib            GitHub, review heuristics, LLM, exports, i18n
prisma             PostgreSQL schema (User, Draft)
```

Happy path:

1. `POST /api/drafts` creates a draft for `owner/repo` (range defaults to last 50 commits)
2. Range screen saves branch + last N (recommended) or two refs. GitHub load uses Compare `base...head` (merge-base). Fixtures apply the same exclusive-base rule.
3. `POST /api/drafts/:id/load` fetches commits (Octokit or fixtures), applies the noise filter, stores curation JSON. The GitHub access token is read from the encrypted JWT via `getToken()` on the server — it is **not** copied onto `/api/auth/session`.
4. Review PATCHes selection + groups (does **not** touch git)
5. `POST /api/drafts/:id/suggest` returns LLM or heuristic groups (`usedLlm` is false on fallback; the UI warns)
6. `POST /api/drafts/:id/generate` writes a `BriefDocument` (`usedLlm` + optional `llmFallback`). Missing key or LLM error uses a basic summary and a visible warning.
7. `GET /api/drafts/:id/export?format=md|pdf|docx` renders that same tree (category → group title → bullets)

i18n is a compact **TR | EN** toggle (top right). Default is `tr` when `Accept-Language` / browser language starts with `tr`, otherwise English. The generate step can override brief language independently of the UI.

## Scripts

- `npm run dev` — Next.js dev server
- `npm test` — Vitest (filter, i18n key parity, synthesis, PDF/DOCX bytes)
- `npm run build` / `npm start` — production
- `npx prisma migrate deploy` — apply migrations
- GitHub Actions: `.github/workflows/ci.yml` runs `npm test` and `npm run build`

## Out of this MVP

LinkedIn / Teams / Canva publish, suggestion cards, sprint dashboard, multi-tenant RBAC, GitLab / Bitbucket, iOS, freemium billing. Stripe can wait.

IBM Plex Sans (SIL Open Font License) is vendored under `src/fonts` for PDF embedding.
