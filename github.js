const { Octokit } = require("@octokit/rest")

const token = process.env.GITHUB_TOKEN
const repoStr = process.env.GITHUB_REPO

if (!token) {
  console.error("[babysit] GITHUB_TOKEN env var is required")
  process.exit(1)
}
if (!repoStr) {
  console.error("[babysit] GITHUB_REPO env var is required (format: owner/repo)")
  process.exit(1)
}

const [owner, repo] = repoStr.split("/")
const octokit = new Octokit({ auth: token })

function inferLabel(prompt) {
  const p = prompt.toLowerCase()
  if (/^(fix|bug)/.test(p)) return "bug"
  if (/^(why|what)/.test(p)) return "question"
  if (/^(improve|refine)/.test(p)) return "enhancement"
  return "feedback"
}

function parseOS(ua) {
  if (!ua) return "unknown"
  if (/Windows NT 10/.test(ua)) return "Windows 10"
  if (/Windows NT 11/.test(ua)) return "Windows 11"
  if (/Windows/.test(ua)) return "Windows"
  if (/Mac OS X/.test(ua)) return ua.match(/Mac OS X ([\d_]+)/)?.[1]?.replace(/_/g, ".") ? `macOS ${ua.match(/Mac OS X ([\d_]+)/)[1].replace(/_/g, ".")}` : "macOS"
  if (/iPhone/.test(ua)) return "iOS (iPhone)"
  if (/iPad/.test(ua)) return "iOS (iPad)"
  if (/Android/.test(ua)) return `Android ${ua.match(/Android ([\d.]+)/)?.[1] || ""}`
  if (/Linux/.test(ua)) return "Linux"
  return "unknown"
}

function formatBody({ prompt, context, meta, screenshotUrl }) {
  if (prompt) {
    const lines = prompt.split("\n")
    if (lines.length > 1) {
      const body_text = lines.slice(1).join("\n").trim()
      if (body_text) prompt = body_text
      else prompt = null
    } else {
      prompt = null
    }
  }

  let body = `### Report\n`
  body += `**URL:** ${meta?.url || "unknown"}\n`
  body += `**Time:** ${meta?.timestamp ? new Date(meta.timestamp).toLocaleString() : new Date().toLocaleString()}\n`
  body += `**Viewport:** ${meta?.viewport || "unknown"}\n`
  if (meta?.userAgent) body += `**OS:** ${parseOS(meta.userAgent)}\n`
  if (meta?.userAgent) body += `**Browser:** ${meta.userAgent}\n`
  if (meta?.ip) body += `**IP:** ${meta.ip}\n`
  if (meta?.sessionId) body += `**Session:** \`${meta.sessionId}\`\n`

  if (context && Object.keys(context).length > 0) {
    body += `\n### App State\n\`\`\`json\n${JSON.stringify(context, null, 2)}\n\`\`\`\n`
  }

  if (prompt) {
    body += `\n### Details\n${prompt}\n`
  }

  if (screenshotUrl) {
    body += `\n### Screenshot\n![screenshot](${screenshotUrl})\n`
  }

  body += `\n---\n*submitted via Babysit*`
  return body
}

async function uploadScreenshot(dataUrl, issueNumber) {
  const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, "")
  const ext = dataUrl.startsWith("data:image/png") ? "png" : "jpg"
  const filepath = `babysit-screenshots/${Date.now()}-${issueNumber}.${ext}`

  const { data } = await octokit.repos.createOrUpdateFileContents({
    owner, repo,
    path: filepath,
    message: `babysit: screenshot for #${issueNumber}`,
    content: base64,
  })

  return `https://raw.githubusercontent.com/${owner}/${repo}/${data.commit.sha}/${filepath}`
}

async function createIssue({ prompt, screenshot, context, meta, ip }) {
  if (ip) meta = { ...meta, ip }
  const label = inferLabel(prompt)

  let screenshotUrl = null
  if (screenshot) {
    try {
      screenshotUrl = await uploadScreenshot(screenshot, "pending")
      console.log(`[babysit] screenshot uploaded: ${screenshotUrl}`)
    } catch (err) {
      console.error("[babysit] screenshot upload failed — token needs contents:write permission:", err.message)
    }
  }

  const { data: issue } = await octokit.issues.create({
    owner, repo,
    title: prompt.split("\n")[0].slice(0, 72),
    body: formatBody({ prompt, context, meta, screenshotUrl }),
    labels: ["babysit", label],
  })

  return { issueUrl: issue.html_url, issueNumber: issue.number }
}

module.exports = { createIssue }
