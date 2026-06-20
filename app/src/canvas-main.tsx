// Standalone entry for TraceCanvas — view at http://127.0.0.1:5173/canvas.html
// (additive: does not touch App.tsx / main.tsx). Mount TraceCanvas in App.tsx to
// ship it inside the cockpit; this page is just an isolated dev surface.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import TraceWorkspace from "./TraceWorkspace";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TraceWorkspace />
  </StrictMode>
);
