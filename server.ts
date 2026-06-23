import express from "express";
import path from "path";
import dotenv from "dotenv";
import digestRouter from "./src/server/routes/digest";
import parseMediaRouter from "./src/server/routes/parseMedia";
import chatRouter from "./src/server/routes/chat";
import contradictionsRouter from "./src/server/routes/contradictions";
import execSummaryRouter from "./src/server/routes/execSummary";
import playbookRouter from "./src/server/routes/playbook";
import translateRouter from "./src/server/routes/translate";
import digestMediaRouter from "./src/server/routes/digestMedia";
import dayAnalysisRouter from "./src/server/routes/dayAnalysis";

dotenv.config({ path: ".env.local" });
dotenv.config();

export async function createExpressApp() {
  const app = express();

  // Path rewriting middleware — strips the Netlify function prefix so all
  // routes consistently match /api/* regardless of how they are invoked.
  // IMPORTANT: Do NOT remove this middleware.
  app.use((req, res, next) => {
    const originalUrl = req.url;
    if (req.url.startsWith("/.netlify/functions/api")) {
      req.url = req.url.slice("/.netlify/functions/api".length);
    }
    if (!req.url.startsWith("/api") && req.url !== "/" && !req.url.startsWith("/?")) {
      req.url = "/api" + (req.url.startsWith("/") ? req.url : "/" + req.url);
    }
    console.log(`[Express Rewrite] Method: ${req.method} | Original: ${originalUrl} -> Rewritten: ${req.url}`);
    next();
  });

  // Body parser — high limit for large chat text payloads
  app.use(express.json({ limit: "25mb" }));

  // Mount all API route handlers
  app.use("/api", digestRouter);
  app.use("/api", parseMediaRouter);
  app.use("/api", chatRouter);
  app.use("/api", contradictionsRouter);
  app.use("/api", execSummaryRouter);
  app.use("/api", playbookRouter);
  app.use("/api", translateRouter);
  app.use("/api", digestMediaRouter);
  app.use("/api", dayAnalysisRouter);

  return app;
}

async function startServer() {
  const app = await createExpressApp();
  const PORT = 3000;

  // Enable Vite middleware in development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

if (!process.env.NETLIFY && !process.env.LAMBDA_TASK_ROOT) {
  startServer();
}
