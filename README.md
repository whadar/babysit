# Babysit

> Press `/` in your browser to file a GitHub issue with screenshot and app state — straight from your dev session.

## Demo
[![Project walkthrough](https://github.com/user-attachments/assets/cc159455-1514-49ed-b82d-3b32ba449b83)](https://www.loom.com/share/7880d391450a470bbb2fd6f5297e9f51)
## Why

You're testing your app and something's off. You could switch to your IDE/CLI, describe the problem, wait for a fix, and reload — but now you've lost your train of thought and your place in the app.

Babysit keeps you in the flow. Press `/`, type what you see, and it captures your note alongside a screenshot and any custom app state you care about. The report lands in a GitHub Issue automatically — no tab switching, no context lost.

## For beta users too

Ship the same widget to your beta users and let them report issues directly from inside the app. Every submission is a labeled GitHub Issue with full visual context — no more "it's broken on my screen" emails with no screenshot.

## Auto-fixing with GitHub Actions

Trigger a workflow on every new Babysit issue to auto-triage, ping your team, or have Claude (or any AI) take a first pass at the fix.

---

## Setup

Create a `.env` file in your project root:

```
GITHUB_TOKEN=ghp_your_token_here
GITHUB_REPO=owner/repo
```

For fine-grained tokens, enable **Issues: Read & Write** and **Contents: Read & Write** on the target repo.

`BABYSIT_SECRET` is optional for local dev — omit it and the server accepts all requests.

Start the server:

```bash
npx babysit
```

Add the widget to your app's HTML:

```html
<script src="http://localhost:5678/widget.js"></script>
<script>
  Babysit.init({
    trigger: "/",
    server: "http://localhost:5678",
    context: () => ({ /* optional app state */ })
  })
</script>
```

Or load directly from npm via unpkg (no local server required for the script tag):

```html
<script src="https://unpkg.com/babysit/widget.js"></script>
```

---

## Usage

- Press `/` in your browser → overlay appears (or click the floating button if `button: true`)
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

For beta users or static frontends with no backend, deploy the included Worker.

**1. Create a GitHub token** for the target repo with fine-grained permissions:
- Issues: Read & Write
- Contents: Read & Write

**2. Install wrangler:**

```bash
cd worker
npm install
```

**3. Edit `worker/wrangler.toml`** — set `name` and `GITHUB_REPO` to your target repo:

```toml
name = "babysit-myapp"

[vars]
GITHUB_REPO = "your-org/your-app-repo"
```

**4. Set secrets:**

```bash
npx wrangler secret put GITHUB_TOKEN
npx wrangler secret put BABYSIT_SECRET
```

**5. Deploy:**

```bash
npm run deploy
```

**6. Add the widget to your app:**

```html
<script src="https://unpkg.com/babysit/widget.js"></script>
<script>
  Babysit.init({
    trigger: "/",
    server: "https://babysit-myapp.your-subdomain.workers.dev",
    secret: "your-secret-here",
    context: () => ({ /* optional app state */ })
  })
</script>
```

> **One Worker per repo.** Each Worker targets a single `GITHUB_REPO`. To use Babysit across multiple projects, deploy a separate Worker for each with a unique `name` in `wrangler.toml`.

---

## Config

| Env var | Required | Description |
|---|---|---|
| `GITHUB_TOKEN` | ✓ | Personal access token with `repo` scope (or fine-grained: `issues:write` + `contents:write`) |
| `GITHUB_REPO` | ✓ | Target repo in `owner/repo` format |
| `BABYSIT_PORT` | — | Server port (default: `5678`) |
| `BABYSIT_SECRET` | — | Shared secret — widget must send matching `x-babysit-secret` header. Prevents casual abuse but is visible in client JS — not a substitute for user auth. |

### Widget options (`Babysit.init`)

| Option | Default | Description |
|---|---|---|
| `server` | `http://localhost:5678` | URL of the Babysit server or Worker |
| `trigger` | `/` | Key that opens the overlay |
| `secret` | — | Must match `BABYSIT_SECRET` on the server |
| `autoOpen` | `false` | Open the overlay automatically on page load |
| `button` | `false` | Show a persistent floating "Report issue" button |
| `context` | — | Function returning app state to attach to every report |

---

## Label inference

| Prompt prefix | Label |
|---|---|
| `fix` / `bug` | `bug` |
| `why` / `what` | `question` |
| `improve` / `refine` | `enhancement` |
| _(anything else)_ | `feedback` |
