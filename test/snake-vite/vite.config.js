import { defineConfig } from "vite"
import babysit from "../../vite-plugin-babysit.js"

export default defineConfig({
  plugins: [
    babysit({
      repo: "whadar/babysit",
      position: "bottom",
      autoOpen: true,
      button: true,
    }),
  ],
})
