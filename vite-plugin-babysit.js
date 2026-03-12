import fs from "fs"
import path from "path"

function loadEnv(root) {
  const files = [".env.local", ".env"]
  const env = {}
  let dir = path.resolve(root || process.cwd())
  const seen = new Set()
  while (dir && !seen.has(dir)) {
    seen.add(dir)
    for (const file of files) {
      const p = path.join(dir, file)
      if (!fs.existsSync(p)) continue
      for (const line of fs.readFileSync(p, "utf8").split("\n")) {
        const m = line.match(/^\s*([\w]+)\s*=\s*(.*)$/)
        if (m && !(m[1] in env)) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "")
      }
    }
    if (env.BABYSIT_TOKEN && env.BABYSIT_REPO) break
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return env
}

export default function babysitPlugin(opts = {}) {
  return {
    name: "vite-plugin-babysit",
    apply: "serve",
    transformIndexHtml(html, ctx) {
      const root = ctx?.server?.config?.root || process.cwd()
      const env = loadEnv(root)

      const token = opts.token || env.BABYSIT_TOKEN
      const repo = opts.repo || env.BABYSIT_REPO
      const trigger = opts.trigger || env.BABYSIT_TRIGGER || "/"
      const position = opts.position || env.BABYSIT_POSITION || "bottom"
      const autoOpen = opts.autoOpen ?? (env.BABYSIT_AUTO_OPEN === "true") ?? false
      const button = opts.button ?? (env.BABYSIT_BUTTON === "true") ?? true

      if (!token) {
        console.warn("[babysit] vite plugin: missing BABYSIT_TOKEN in .env — skipping widget injection")
        return html
      }
      if (!repo) {
        console.warn("[babysit] vite plugin: missing BABYSIT_REPO in .env or opts.repo — skipping widget injection")
        return html
      }

      const initScript = `
<script src="https://unpkg.com/babysit@latest/widget.js"></script>
<script>
  window.addEventListener('load', function() {
    if (window.Babysit) {
      Babysit.init({
        token: ${JSON.stringify(token)},
        repo: ${JSON.stringify(repo)},
        trigger: ${JSON.stringify(trigger)},
        position: ${JSON.stringify(position)},
        autoOpen: ${JSON.stringify(autoOpen)},
        button: ${JSON.stringify(button)},
      })
    }
  })
</script>`

      return html.replace("</body>", initScript + "\n</body>")
    },
  }
}
