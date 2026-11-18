import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { fileURLToPath, URL } from "node:url"
import { devApi } from "./server/devApi.ts"

/**
 * Two pages: the questionnaire (index.html) and the researchers' page (researchers/). A relative
 * base, so the built files work from any folder of any host (GitHub Pages serves them under the
 * repository's name). Built for real, the app needs the Apps Script web app's address in
 * VITE_API_URL; in `pnpm dev` it talks to /dev-api instead (server/devApi.ts).
 */
export default defineConfig(({ command }) => {
  if (command === "build" && !process.env.VITE_API_URL && !process.env.VITEST) {
    throw new Error(
      "Set VITE_API_URL to the Apps Script web app's address, e.g. VITE_API_URL=https://script.google.com/macros/s/…/exec pnpm build",
    )
  }
  return {
    base: "./",
    plugins: [react(), tailwindcss(), devApi()],
    resolve: {
      alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    },
    server: { port: 5181 },
    build: {
      rollupOptions: {
        input: {
          main: fileURLToPath(new URL("./index.html", import.meta.url)),
          researchers: fileURLToPath(new URL("./researchers/index.html", import.meta.url)),
        },
      },
    },
    test: {
      include: ["src/**/*.test.ts", "server/**/*.test.ts"],
    },
  }
})
