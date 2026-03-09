const RATE_LIMIT = 10
const RATE_WINDOW_MS = 60 * 1000

const rateLimitMap = new Map()

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
      const bodyText = lines.slice(1).join("\n").trim()
      prompt = bodyText || null
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

async function githubFetch(token, path, method = "GET", body = null) {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: body ? JSON.stringify(body) : null,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message || `GitHub API error ${res.status}`)
  return data
}

async function uploadScreenshot(token, owner, repo, dataUrl, issueNumber) {
  const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, "")
  const ext = dataUrl.startsWith("data:image/png") ? "png" : "jpg"
  const filepath = `babysit-screenshots/${Date.now()}-${issueNumber}.${ext}`

  const data = await githubFetch(token, `/repos/${owner}/${repo}/contents/${filepath}`, "PUT", {
    message: `babysit: screenshot for #${issueNumber}`,
    content: base64,
  })

  return data.content.download_url
}

async function createIssue({ token, owner, repo, prompt, screenshot, context, meta }) {
  const label = inferLabel(prompt)

  let screenshotUrl = null
  if (screenshot) {
    try {
      screenshotUrl = await uploadScreenshot(token, owner, repo, screenshot, "pending")
    } catch (err) {
      console.error("screenshot upload failed:", err.message)
    }
  }

  const issue = await githubFetch(token, `/repos/${owner}/${repo}/issues`, "POST", {
    title: prompt.split("\n")[0].slice(0, 72),
    body: formatBody({ prompt, context, meta, screenshotUrl }),
    labels: ["babysit", label],
  })

  return { issueUrl: issue.html_url, issueNumber: issue.number }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, x-babysit-secret",
        },
      })
    }

    if (request.method === "POST" && url.pathname === "/report") {
      if (env.BABYSIT_SECRET) {
        const provided = request.headers.get("x-babysit-secret")
        if (provided !== env.BABYSIT_SECRET) {
          return Response.json({ error: "unauthorized" }, { status: 401, headers: { "Access-Control-Allow-Origin": "*" } })
        }
      }

      const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "unknown"
      if (isRateLimited(ip)) {
        return Response.json({ error: "rate limit exceeded" }, { status: 429, headers: { "Access-Control-Allow-Origin": "*" } })
      }

      let body
      try {
        body = await request.json()
      } catch {
        return Response.json({ error: "invalid JSON" }, { status: 400, headers: { "Access-Control-Allow-Origin": "*" } })
      }

      const { prompt, screenshot, context, meta } = body
      if (!prompt) {
        return Response.json({ error: "prompt is required" }, { status: 400, headers: { "Access-Control-Allow-Origin": "*" } })
      }

      const [owner, repo] = env.GITHUB_REPO.split("/")
      const userAgent = request.headers.get("user-agent")
      const enrichedMeta = { ...meta, ip, userAgent }

      try {
        const result = await createIssue({
          token: env.GITHUB_TOKEN,
          owner, repo,
          prompt, screenshot, context,
          meta: enrichedMeta,
        })
        return Response.json(result, { headers: { "Access-Control-Allow-Origin": "*" } })
      } catch (err) {
        return Response.json({ error: err.message }, { status: 500, headers: { "Access-Control-Allow-Origin": "*" } })
      }
    }

    if (request.method === "GET" && url.pathname === "/widget.js") {
      return fetch("https://unpkg.com/babysit/widget.js", {
        headers: { "Cache-Control": "no-cache" },
      }).then(res => new Response(res.body, {
        headers: {
          "Content-Type": "application/javascript",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=300",
        },
      }))
    }

    return new Response("not found", { status: 404 })
  },
}
