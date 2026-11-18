import { readFileSync } from "node:fs"
import { join } from "node:path"
import type { Plugin } from "vite"
import { createGoogle, loadCode } from "./googleFakes.ts"

/** about how long Apps Script takes to answer, so loading states show in development too */
const LATENCY_MS = 350

/**
 * In `pnpm dev`, the app talks to /dev-api, which runs the real Code.gs on a pretend Google Sheet
 * kept in memory (researchers' password: "dev"). GET /dev-api/sheets shows that Sheet and
 * POST /dev-api/reset starts it over; the end-to-end test uses both.
 */
export function devApi(): Plugin {
  return {
    name: "survey-dev-api",
    apply: "serve",
    configureServer(server) {
      const source = () => readFileSync(join(server.config.root, "server/Code.gs"), "utf8")
      const start = () => {
        const google = createGoogle({ password: "dev" })
        const app = loadCode(source(), google.globals)
        app.setup()
        return { google, app }
      }
      let backend = start()
      server.middlewares.use("/dev-api", (req, res) => {
        const send = (body: unknown) => {
          res.setHeader("content-type", "application/json")
          res.end(JSON.stringify(body))
        }
        if (req.method === "GET" && req.url?.startsWith("/sheets")) {
          send(backend.google.book.dump())
          return
        }
        if (req.method === "POST" && req.url?.startsWith("/reset")) {
          backend = start()
          send({ ok: true })
          return
        }
        if (req.method !== "POST") {
          res.statusCode = 405
          res.end()
          return
        }
        let body = ""
        req.on("data", (chunk) => (body += chunk))
        req.on("end", () => setTimeout(() => send(backend.app.post(body)), LATENCY_MS))
      })
    },
  }
}
