;(function () {
  const DEFAULT_SERVER = "http://localhost:5678"
  const DEFAULT_TRIGGER = "/"

  let config = {
    trigger: DEFAULT_TRIGGER,
    server: DEFAULT_SERVER,
    secret: null,
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
      s.src = config.server + "/html2canvas.min.js"
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

    overlayEl = document.createElement("div")
    overlayEl.id = "__babysit_overlay"
    overlayEl.style.cssText = `
      position: fixed;
      bottom: 0; left: 0; right: 0;
      z-index: 999999;
      display: flex;
      justify-content: center;
      padding: 16px;
      font-family: system-ui, sans-serif;
      background: linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%);
    `

    const box = document.createElement("div")
    box.style.cssText = `
      background: #1a1a1a;
      border: 1px solid #333;
      border-radius: 10px 10px 8px 8px;
      padding: 16px 20px;
      width: 560px;
      max-width: 100%;
      box-shadow: 0 -4px 24px rgba(0,0,0,0.5);
    `

    const label = document.createElement("div")
    label.textContent = "babysit"
    label.style.cssText = `
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #888;
      margin-bottom: 10px;
    `

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

    const hint = document.createElement("div")
    hint.textContent = "Enter to send · Esc to cancel"
    hint.style.cssText = `
      font-size: 11px;
      color: #555;
      margin-top: 8px;
      text-align: right;
    `

    box.appendChild(label)
    box.appendChild(input)
    box.appendChild(hint)
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

  function showIssueToast(issueNumber, issueUrl) {
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
    link.textContent = `✓ #${issueNumber} opened →`
    link.style.cssText = `color: #4ade80; text-decoration: none;`
    t.appendChild(link)
    document.body.appendChild(t)
    setTimeout(() => { t.style.opacity = "0" }, 4000)
    setTimeout(() => t.remove(), 4500)
  }

  function submit(prompt) {
    hideOverlay()
    showToast("⏳ sending…")

    const payload = {
      prompt,
      screenshot: pendingScreenshot || null,
      context: collectContext(),
      meta: {
        url: location.href,
        timestamp: new Date().toISOString(),
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        sessionId,
      },
    }

    const headers = { "Content-Type": "application/json" }
    if (config.secret) headers["x-babysit-secret"] = config.secret

    fetch(config.server + "/report", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    })
      .then((res) => res.json().then((data) => ({ ok: res.ok, status: res.status, data })))
      .then(({ ok, status, data }) => {
        if (ok && data.issueUrl) {
          console.log("[babysit] issue:", data.issueUrl)
          showIssueToast(data.issueNumber, data.issueUrl)
        } else if (status === 401) {
          console.error("[babysit] unauthorized — check BABYSIT_SECRET")
          showToast("✗ unauthorized", "#2e1a1a")
        } else if (status === 429) {
          console.warn("[babysit] rate limit exceeded")
          showToast("✗ rate limit exceeded", "#2e1a1a")
        } else {
          console.warn("[babysit] server responded with", status)
          showToast("✗ server error " + status, "#2e1a1a")
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
