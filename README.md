# Babysit

> Press `/` in your browser to file a GitHub issue with screenshot and app state — straight from your dev session.

You're running your app in the browser. You spot something — a bug, a layout issue, a state you want to act on. You hit `/`, type a prompt, and Babysit captures it + your app state and files a GitHub issue. No context switch, no new conversation, no describing what you're looking at.

Multiple reports in the same browser session are grouped as comments on the same issue.

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

The token needs the `repo` scope (to create issues and labels).

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
    context: () => ({ /* optional app state */ })
  })
</script>
```

---

## Usage

- Press `/` in your browser → overlay appears
- First submission: edit the issue title (defaults to `Babysit [Mar 9, 11:14]`)
- Type your prompt → Enter to send
- A toast appears: `✓ #42 opened →` (clickable link to the issue)
- Subsequent prompts in the same session add comments to the same issue

---

## Architecture

```
browser widget  →  POST /report  →  github.js  →  GitHub Issue
(widget.js)        (server.js)      (octokit)      + comments per session
```

- `widget.js` — single script tag, no dependencies
- `server.js` — Express server, manages sessions, writes local `.md` backups
- `github.js` — octokit issue + comment creation, label inference

---

## Config

| Env var | Required | Description |
|---|---|---|
| `GITHUB_TOKEN` | ✓ | Personal access token with `repo` scope |
| `GITHUB_REPO` | ✓ | Target repo in `owner/repo` format |
| `BABYSIT_PORT` | — | Server port (default: `5678`) |

---

## Label inference

| Prompt prefix | Label |
|---|---|
| `fix` / `bug` | `bug` |
| `why` / `what` | `question` |
| `improve` / `refine` | `enhancement` |
| _(anything else)_ | `feedback` |
