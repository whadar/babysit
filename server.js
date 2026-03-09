const express = require("express")
const cors = require("cors")
const fs = require("fs")
const path = require("path")
const { createIssue } = require("./github")

const app = express()
app.use(cors())
app.use(express.json({ limit: "50mb" }))

const PORT = process.env.BABYSIT_PORT || 5678
const SECRET = process.env.BABYSIT_SECRET

const rateLimitMap = new Map()
const RATE_LIMIT = 10
const RATE_WINDOW_MS = 60 * 1000

function isRateLimited(ip) {
  const now = Date.now()
  const entry = rateLimitMap.get(ip) || { count: 0, start: now }
  if (now - entry.start > RATE_WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, start: now })
    return false
  }
  if (entry.count >= RATE_LIMIT) return true
  entry.count++
  rateLimitMap.set(ip, entry)
  return false
}

app.post("/report", async (req, res) => {
  if (SECRET) {
    const provided = req.headers["x-babysit-secret"]
    if (provided !== SECRET) {
      return res.status(401).json({ error: "unauthorized" })
    }
  }

  const ip = req.headers["x-forwarded-for"]?.split(",")[0].trim() || req.socket.remoteAddress
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: "rate limit exceeded" })
  }

  const { prompt, screenshot, context, repo, meta } = req.body

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
  const dir = path.resolve(process.cwd(), "babysit")

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  const time = meta?.timestamp
    ? new Date(meta.timestamp).toLocaleString()
    : new Date().toLocaleString()

  let md = `## Babysit Report\n`
  md += `**Time:** ${time}\n`
  md += `**URL:** ${meta?.url || "unknown"}\n`
  md += `**Viewport:** ${meta?.viewport || "unknown"}\n`
  md += `**Prompt:** ${prompt}\n`

  if (context && Object.keys(context).length > 0) {
    md += `\n### App State\n\`\`\`json\n${JSON.stringify(context, null, 2)}\n\`\`\`\n`
  }

  if (screenshot) {
    md += `\n### Screenshot\n![screenshot](${screenshot})\n`
  }

  const filePath = path.join(dir, `${timestamp}.md`)
  fs.writeFileSync(filePath, md, "utf8")
  console.log(`[babysit] wrote ${filePath}`)

  try {
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress
    const userAgent = req.headers["user-agent"]
    const enrichedMeta = { ...meta, ip, userAgent }
    const result = await createIssue({ prompt, screenshot, context, repo, meta: enrichedMeta })

    console.log(`[babysit] issue created: ${result.issueUrl}`)
    res.json({ issueUrl: result.issueUrl, issueNumber: result.issueNumber })
  } catch (err) {
    console.error("[babysit] github error:", err.message)
    res.status(500).json({ error: err.message })
  }
})

app.get("/widget.js", (req, res) => {
  res.sendFile(path.resolve(__dirname, "widget.js"))
})

app.get("/html2canvas.min.js", (req, res) => {
  res.sendFile(path.resolve(__dirname, "node_modules/html2canvas/dist/html2canvas.min.js"))
})

app.use("/screenshots", express.static(path.resolve(process.cwd(), "babysit-screenshots")))

app.listen(PORT, () => {
  console.log(`[babysit] server running on http://localhost:${PORT}`)
})
