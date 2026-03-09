# Babysit

> Press `/` in your browser to file a GitHub issue with screenshot and app state — straight from your dev session.
<img width="823" height="832" alt="image" src="https://github.com/user-attachments/assets/0b7734dc-b919-4eb7-b9e7-48bda4864e70" />

## Why

You're testing your app and something's off. You could switch to your IDE/CLI, describe the problem, wait for a fix, and reload but now you've lost your train of thought and your place in the app.

Babysit keeps you in the flow. Press `/`, type what you see, and it captures your note alongside a screenshot and any custom app state you care about. The report lands in a GitHub Issue automatically — no tab switching, no context lost.

## For beta users too

Ship the same widget to your beta users and let them report issues directly from inside the app. Every submission is a labeled GitHub Issue with full visual context — no more "it's broken on my screen" emails with no screenshot.

## Auto-fixing with GitHub Actions

Trigger a workflow on every new Babysit issue to auto-triage, ping your team, or have Claude (or any AI) take a first pass at the fix.

---

## Setup

```bash
npm install
```

Create a `.env` file:

```
GITHUB_TOKEN=ghp_your_token_here
GITHUB_REPO=owner/repo
```

The token needs the `repo` scope (to create issues, labels, and upload screenshots).

For fine-grained tokens, enable **Issues: Read & Write** and **Contents: Read & Write** on the target repo.

Start the server:

```bash
npm start
```

Add the widget to your app's dev HTML:

```html
<script src="http://localhost:5678/widget.js"></script>
<script>
  Babysit.init({
    trigger: "/",
    server: "http://localhost:5678",
    secret: "your-secret-here", // must match BABYSIT_SECRET on the server
    context: () => ({ /* optional app state */ })
  })
</script>
```

---

## Usage

- Press `/` in your browser → overlay appears
- Type your prompt (first line becomes the issue title) → Enter to send
- A toast appears: `✓ #42 opened →` — click to go directly to the issue

---

## Architecture

Two server modes — same widget, different `server` URL:

```
browser widget  →  POST /report  →  server.js / worker  →  GitHub Issue
```

- `widget.js` — single script tag, no dependencies
- `server.js` — local Express server for dev use
- `worker/` — Cloudflare Worker for production / beta users
- `github.js` — issue creation, label inference (used by local server)

---

## Deploying to production (Cloudflare Worker)

For beta users or static frontends with no backend, deploy the included Worker:

```bash
cd worker
npm install
```

Set your secrets:

```bash
npx wrangler secret put GITHUB_TOKEN
npx wrangler secret put BABYSIT_SECRET
```

Update `GITHUB_REPO` in `worker/wrangler.toml`, then deploy:

```bash
npm run deploy
```

Point the widget at your Worker URL:

```html
<script src="https://your-worker.workers.dev/widget.js"></script>
<script>
  Babysit.init({
    trigger: "/",
    server: "https://your-worker.workers.dev",
    secret: "your-secret-here",
    context: () => ({ /* optional app state */ })
  })
</script>
```

---

## Config

| Env var | Required | Description |
|---|---|---|
| `GITHUB_TOKEN` | ✓ | Personal access token with `repo` scope (or fine-grained: `issues:write` + `contents:write`) |
| `GITHUB_REPO` | ✓ | Target repo in `owner/repo` format |
| `BABYSIT_PORT` | — | Server port (default: `5678`) |
| `BABYSIT_SECRET` | — | Shared secret — widget must send matching `x-babysit-secret` header |

---

## Label inference

| Prompt prefix | Label |
|---|---|
| `fix` / `bug` | `bug` |
| `why` / `what` | `question` |
| `improve` / `refine` | `enhancement` |
| _(anything else)_ | `feedback` |
