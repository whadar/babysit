#!/usr/bin/env node

const fs = require("fs")
const path = require("path")

const envPath = path.resolve(process.cwd(), ".env")
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf8")
    .split("\n")
    .forEach((line) => {
      const match = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)$/)
      if (match) process.env[match[1]] = match[2].trim()
    })
}

require("./server")
