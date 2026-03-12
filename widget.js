;(function () {
  const DEFAULT_SERVER = "http://localhost:5678"
  const DEFAULT_TRIGGER = "/"
  const VERSION = "0.2.9"
  const H2C_CDN = "https://unpkg.com/html2canvas@1.4.1/dist/html2canvas.min.js"

  let config = {
    trigger: DEFAULT_TRIGGER,
    server: null,
    secret: null,
    token: null,
    repo: null,
    position: "bottom",
    autoOpen: false,
    button: false,
    contextFns: [],
  }

  const sessionId = crypto.randomUUID()

  let overlayEl = null
  let active = false
  let pendingScreenshot = null

  function loadHtml2Canvas() {
    return new Promise((resolve, reject) => {
      if (window.html2canvas) return resolve(window.html2canvas)
      const s = document.createElement("script")
      s.src = config.server ? config.server + "/html2canvas.min.js" : H2C_CDN
      s.onload = () => resolve(window.html2canvas)
      s.onerror = () => reject(new Error("failed to load html2canvas"))
      document.head.appendChild(s)
    })
  }

  function captureScreenshot() {
    return loadHtml2Canvas()
      .then((h2c) => h2c(document.body, { useCORS: true, scale: 1, logging: false }))
      .then((canvas) => {
        const dataUrl = canvas.toDataURL("image/jpeg", 0.75)
        console.log("[babysit] screenshot captured, size:", dataUrl.length)
        return dataUrl
      })
      .catch((err) => {
        console.warn("[babysit] screenshot capture failed:", err)
        return null
      })
  }

  function collectContext() {
    return config.contextFns.reduce((acc, fn) => {
      try {
        return Object.assign(acc, fn())
      } catch (e) {
        return acc
      }
    }, {})
  }

  function showOverlay() {
    if (active) return
    active = true

    const pos = config.position || "bottom"
    const posStyles = {
      bottom: "bottom:0;left:0;right:0;display:flex;justify-content:center;align-items:flex-end;",
      top:    "top:0;left:0;right:0;display:flex;justify-content:center;align-items:flex-start;",
      left:   "top:0;left:0;bottom:0;display:flex;justify-content:flex-start;align-items:center;",
      right:  "top:0;right:0;bottom:0;display:flex;justify-content:flex-end;align-items:center;",
    }
    overlayEl = document.createElement("div")
    overlayEl.id = "__babysit_overlay"
    overlayEl.style.cssText = `
      position: fixed;
      ${posStyles[pos] || posStyles.bottom}
      z-index: 999999;
      padding: 16px;
      font-family: system-ui, sans-serif;
      background: rgba(0,0,0,0.3);
    `

    const boxStyles = {
      bottom: "border-radius:10px 10px 8px 8px; box-shadow:0 -4px 24px rgba(0,0,0,0.5); width:560px; max-width:100%;",
      top:    "border-radius:8px 8px 10px 10px; box-shadow:0 4px 24px rgba(0,0,0,0.5); width:560px; max-width:100%;",
      left:   "border-radius:8px 10px 10px 8px; box-shadow:4px 0 24px rgba(0,0,0,0.5); width:300px;",
      right:  "border-radius:10px 8px 8px 10px; box-shadow:-4px 0 24px rgba(0,0,0,0.5); width:300px;",
    }
    const box = document.createElement("div")
    box.style.cssText = `
      background: #1a1a1a;
      border: 1px solid #333;
      ${boxStyles[pos] || boxStyles.bottom}
      padding: 16px 20px;
    `

    const label = document.createElement("div")
    label.style.cssText = `
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #888;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 5px;
    `
    const labelTitle = document.createElement("span")
    labelTitle.textContent = "babysit"
    label.appendChild(labelTitle)
    if (config.repo) {
      const sep = document.createElement("span")
      sep.textContent = "→"
      sep.style.cssText = "color: #555; font-weight: 400;"
      label.appendChild(sep)
      const repoLink = document.createElement("a")
      repoLink.href = `https://github.com/${config.repo}/issues`
      repoLink.target = "_blank"
      repoLink.rel = "noopener noreferrer"
      repoLink.textContent = config.repo
      repoLink.style.cssText = `
        color: #666;
        text-decoration: none;
        font-size: 11px;
        letter-spacing: 0.05em;
        transition: color 0.15s;
      `
      repoLink.addEventListener("mouseenter", () => { repoLink.style.color = "#aaa" })
      repoLink.addEventListener("mouseleave", () => { repoLink.style.color = "#666" })
      label.appendChild(repoLink)
    }

    const input = document.createElement("textarea")
    input.placeholder = "Describe the issue or what to fix..."
    input.rows = 3
    input.style.cssText = `
      width: 100%;
      background: #111;
      border: 1px solid #444;
      border-radius: 6px;
      color: #eee;
      font-size: 14px;
      padding: 10px 12px;
      resize: none;
      outline: none;
      box-sizing: border-box;
    `

    const footer = document.createElement("div")
    footer.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 8px;
    `
    const versionLabel = document.createElement("span")
    versionLabel.textContent = `v${VERSION}`
    versionLabel.style.cssText = "font-size: 10px; color: #444;"
    const hint = document.createElement("span")
    hint.textContent = "Enter to send · Esc to cancel"
    hint.style.cssText = "font-size: 10px; color: #555;"
    footer.appendChild(versionLabel)
    footer.appendChild(hint)

    box.appendChild(label)
    box.appendChild(input)
    box.appendChild(footer)
    overlayEl.appendChild(box)
    document.body.appendChild(overlayEl)

    setTimeout(() => input.focus(), 0)

    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        const prompt = input.value.trim()
        if (prompt) submit(prompt)
        else hideOverlay()
      }
      if (e.key === "Escape") {
        hideOverlay()
      }
    })

    overlayEl.addEventListener("mousedown", function (e) {
      if (e.target === overlayEl) hideOverlay()
    })
  }

  function hideOverlay() {
    if (overlayEl) {
      overlayEl.remove()
      overlayEl = null
    }
    active = false
  }

  function showToast(text, color) {
    const t = document.createElement("div")
    t.textContent = text
    t.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: ${color || "#1a1a1a"};
      border: 1px solid #333;
      border-radius: 8px;
      padding: 10px 16px;
      font-family: system-ui, sans-serif;
      font-size: 13px;
      color: #eee;
      z-index: 999999;
      opacity: 1;
      transition: opacity 0.4s ease;
      pointer-events: none;
    `
    document.body.appendChild(t)
    setTimeout(() => { t.style.opacity = "0" }, 1800)
    setTimeout(() => t.remove(), 2300)
  }

  function showIssueToast(issueNumber, issueUrl, action) {
    const t = document.createElement("div")
    t.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: #1a2e1a;
      border: 1px solid #2a4a2a;
      border-radius: 8px;
      padding: 10px 16px;
      font-family: system-ui, sans-serif;
      font-size: 13px;
      color: #eee;
      z-index: 999999;
      opacity: 1;
      transition: opacity 0.4s ease;
      pointer-events: auto;
    `
    const link = document.createElement("a")
    link.href = issueUrl
    link.target = "_blank"
    link.rel = "noopener noreferrer"
    const label = action === "closed" ? "closed" : action === "comment" ? "commented" : "opened"
    link.textContent = `✓ #${issueNumber} ${label} →`
    link.style.cssText = `color: #4ade80; text-decoration: none;`
    t.appendChild(link)
    document.body.appendChild(t)
    setTimeout(() => { t.style.opacity = "0" }, 4000)
    setTimeout(() => t.remove(), 4500)
  }

  function parseIntent(prompt) {
    const match = prompt.match(/#(\d+)/)
    const issueNumber = match ? parseInt(match[1], 10) : null
    const shouldClose = /\bfixed\b/i.test(prompt)
    return { issueNumber, shouldClose }
  }

  function ghFetch(path, method, body) {
    return fetch("https://api.github.com" + path, {
      method: method || "GET",
      headers: {
        Authorization: "Bearer " + config.token,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: body ? JSON.stringify(body) : undefined,
    }).then((r) => r.json().then((d) => { if (!r.ok) throw new Error(d.message || "GitHub error " + r.status); return d }))
  }

  function inferLabel(prompt) {
    const p = prompt.toLowerCase()
    if (/^(fix|bug)/.test(p)) return "bug"
    if (/^(why|what)/.test(p)) return "question"
    if (/^(improve|refine)/.test(p)) return "enhancement"
    return "feedback"
  }

  function formatMeta(meta) {
    let body = "### Report\n"
    body += `**URL:** ${meta?.url || "unknown"}\n`
    body += `**Time:** ${meta?.timestamp ? new Date(meta.timestamp).toLocaleString() : new Date().toLocaleString()}\n`
    body += `**Viewport:** ${meta?.viewport || "unknown"}\n`
    body += `**Session:** \`${meta?.sessionId || ""}\`\n`
    return body
  }

  function formatCommentBody({ prompt, context, meta, screenshotUrl }) {
    let body = formatMeta(meta)
    const ctx = context && Object.keys(context).length > 0
    if (ctx) body += `\n### App State\n\`\`\`json\n${JSON.stringify(context, null, 2)}\n\`\`\`\n`
    if (screenshotUrl) body += `\n### Screenshot\n![screenshot](${screenshotUrl})\n`
    body += "\n---\n*submitted via Babysit*"
    return body
  }

  async function uploadScreenshotBrowser(dataUrl, label, owner, repo) {
    const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, "")
    const ext = dataUrl.startsWith("data:image/png") ? "png" : "jpg"
    const filepath = `babysit-screenshots/${Date.now()}-${label}.${ext}`
    const data = await ghFetch(`/repos/${owner}/${repo}/contents/${filepath}`, "PUT", {
      message: `babysit: screenshot for #${label}`,
      content: base64,
    })
    return `https://raw.githubusercontent.com/${owner}/${repo}/main/${filepath}`
  }

  async function submitBrowser(prompt) {
    const [owner, repo] = config.repo.split("/")
    const meta = { url: location.href, timestamp: new Date().toISOString(), viewport: `${window.innerWidth}x${window.innerHeight}`, sessionId }
    const context = collectContext()
    const { issueNumber, shouldClose } = parseIntent(prompt)

    let screenshotUrl = null
    if (pendingScreenshot) {
      try {
        screenshotUrl = await uploadScreenshotBrowser(pendingScreenshot, issueNumber || "pending", owner, repo)
      } catch (err) {
        console.warn("[babysit] screenshot upload failed:", err.message)
      }
    }

    const body = formatCommentBody({ prompt, context, meta, screenshotUrl })

    if (issueNumber) {
      await ghFetch(`/repos/${owner}/${repo}/issues/${issueNumber}/comments`, "POST", { body })
      if (shouldClose) await ghFetch(`/repos/${owner}/${repo}/issues/${issueNumber}`, "PATCH", { state: "closed" })
      const issue = await ghFetch(`/repos/${owner}/${repo}/issues/${issueNumber}`)
      return { issueUrl: issue.html_url, issueNumber, action: shouldClose ? "closed" : "comment" }
    }

    const issue = await ghFetch(`/repos/${owner}/${repo}/issues`, "POST", {
      title: prompt.split("\n")[0].slice(0, 72),
      body,
      labels: ["babysit", inferLabel(prompt)],
    })
    return { issueUrl: issue.html_url, issueNumber: issue.number, action: "created" }
  }

  function handleResult(data) {
    console.log("[babysit] issue:", data.issueUrl)
    showIssueToast(data.issueNumber, data.issueUrl, data.action)
  }

  function submit(prompt) {
    hideOverlay()
    showToast("⏳ sending…")

    if (config.token) {
      submitBrowser(prompt).then(handleResult).catch((err) => {
        console.error("[babysit] error:", err)
        showToast("✗ " + err.message, "#2e1a1a")
      })
      return
    }

    const server = config.server || DEFAULT_SERVER
    const payload = {
      prompt,
      screenshot: pendingScreenshot || null,
      context: collectContext(),
      repo: config.repo || undefined,
      meta: {
        url: location.href,
        timestamp: new Date().toISOString(),
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        sessionId,
      },
    }

    const headers = { "Content-Type": "application/json" }
    if (config.secret) headers["x-babysit-secret"] = config.secret

    fetch(server + "/report", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    })
      .then((res) => res.json().then((data) => ({ ok: res.ok, status: res.status, data })))
      .then(({ ok, status, data }) => {
        if (ok && data.issueUrl) {
          handleResult(data)
        } else if (status === 401) {
          console.error("[babysit] unauthorized — check BABYSIT_SECRET")
          showToast("✗ unauthorized", "#2e1a1a")
        } else if (status === 429) {
          console.warn("[babysit] rate limit exceeded")
          showToast("✗ rate limit exceeded", "#2e1a1a")
        } else {
          const msg = data?.error || `server error ${status}`
          console.warn("[babysit] error:", msg)
          showToast("✗ " + msg, "#2e1a1a")
        }
      })
      .catch((err) => {
        console.error("[babysit] failed to send report:", err)
        showToast("✗ could not reach server", "#2e1a1a")
      })
  }

  document.addEventListener("keydown", function (e) {
    if (active) return
    const triggerCode = config.trigger === "/" ? "Slash" : null
    if (
      (e.key === config.trigger || (triggerCode && e.code === triggerCode)) &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey &&
      document.activeElement.tagName !== "INPUT" &&
      document.activeElement.tagName !== "TEXTAREA"
    ) {
      e.preventDefault()
      pendingScreenshot = null
      captureScreenshot().then((dataUrl) => {
        pendingScreenshot = dataUrl
        showOverlay()
      })
    }
  })

  function showButton() {
    if (document.getElementById("__babysit_btn")) return
    const btn = document.createElement("button")
    btn.id = "__babysit_btn"
    btn.textContent = "🍼"
    btn.title = "Report issue"
    btn.style.cssText = `
      position: fixed;
      bottom: 16px;
      left: 16px;
      z-index: 999998;
      background: rgba(0,0,0,0.5);
      border: none;
      border-radius: 50%;
      width: 32px;
      height: 32px;
      font-size: 16px;
      line-height: 32px;
      text-align: center;
      cursor: pointer;
      padding: 0;
      opacity: 0.6;
      transition: opacity 0.15s;
    `
    btn.addEventListener("mouseenter", () => { btn.style.opacity = "1" })
    btn.addEventListener("mouseleave", () => { btn.style.opacity = "0.6" })
    btn.addEventListener("click", () => {
      if (active) return
      pendingScreenshot = null
      captureScreenshot().then((dataUrl) => {
        pendingScreenshot = dataUrl
        showOverlay()
      })
    })
    document.body.appendChild(btn)
  }

  window.Babysit = {
    init(opts) {
      if (opts.trigger) config.trigger = opts.trigger
      if (opts.server) config.server = opts.server
      if (opts.secret) config.secret = opts.secret
      if (opts.token) config.token = opts.token
      if (opts.repo) config.repo = opts.repo
      if (opts.position) config.position = opts.position
      if (opts.autoOpen) config.autoOpen = opts.autoOpen
      if (opts.button) config.button = opts.button
      if (opts.context) config.contextFns.push(opts.context)

      if (config.button) showButton()
      if (config.autoOpen) {
        pendingScreenshot = null
        captureScreenshot().then((dataUrl) => {
          pendingScreenshot = dataUrl
          showOverlay()
        })
      }
    },
    addContext(fn) {
      config.contextFns.push(fn)
    },
  }

  console.log("[babysit] widget loaded — press / to report")
})()
