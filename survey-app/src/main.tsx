import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./design/tokens.css"
import { LanguageProvider } from "./app/language"
import { App } from "./respondent/App"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </StrictMode>,
)
