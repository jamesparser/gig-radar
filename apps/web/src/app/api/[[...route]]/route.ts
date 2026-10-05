import { handle } from "hono/vercel";
import { createApp } from "@gigradar/api";

/** The whole GigRadar API (apps/api) is mounted here, same origin as the dashboard, so session cookies just work. */
export const runtime = "nodejs";

const handler = handle(createApp());

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const OPTIONS = handler;
