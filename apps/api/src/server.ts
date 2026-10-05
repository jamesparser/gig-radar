/** Standalone entrypoint: `npm run dev -w @gigradar/api` (or Docker/Fly). The Vercel deployment mounts createApp() inside Next.js instead. */
import { serve } from "@hono/node-server";
import { createApp } from "./app";

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: createApp().fetch, port }, (info) => console.log(`GigRadar API listening on http://localhost:${info.port}/api/health`));
