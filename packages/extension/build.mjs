// Bundles the extension into ./dist (load it via chrome://extensions → Developer mode → Load unpacked).
//
//   GIGRADAR_API_ORIGIN=https://your-deployment.example  npm run build:extension
//
// The origin is the default API address, is granted at install time (host_permissions), and is the one non-marketplace
// origin where the content script auto-injects (for the /demo-board fixture). Any other address entered in the popup
// is requested at runtime as an optional permission.
import { build } from "esbuild";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const dist = join(root, "dist");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

const rawOrigin = (process.env.GIGRADAR_API_ORIGIN || "http://localhost:3000").trim();
let origin;
try {
  origin = new URL(rawOrigin);
} catch {
  console.error(`GIGRADAR_API_ORIGIN is not a valid URL: ${rawOrigin}`);
  process.exit(1);
}
const isLocal = ["localhost", "127.0.0.1"].includes(origin.hostname);
if (origin.protocol !== "https:" && !(origin.protocol === "http:" && isLocal)) {
  console.error("GIGRADAR_API_ORIGIN must be https:// (http:// is only allowed for localhost).");
  process.exit(1);
}
// Match patterns ignore ports, so use scheme + hostname only.
const originPattern = `${origin.protocol}//${origin.hostname}/*`;
const apiBase = origin.origin;

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

await build({
  entryPoints: {
    background: join(root, "src/background.ts"),
    content: join(root, "src/content.ts"),
    popup: join(root, "src/popup/popup.ts"),
  },
  outdir: dist,
  bundle: true,
  format: "iife", // content scripts and the popup can't be ES modules
  target: "chrome120",
  platform: "browser",
  minify: process.env.GIGRADAR_NO_MINIFY ? false : true,
  sourcemap: false,
  legalComments: "none",
  define: { __API_BASE__: JSON.stringify(apiBase) },
  logLevel: "info",
});

cpSync(join(root, "src/popup/popup.html"), join(dist, "popup.html"));
cpSync(join(root, "src/popup/popup.css"), join(dist, "popup.css"));

const iconDir = join(root, "src/icons");
const icons = {};
for (const size of [16, 32, 48, 128]) {
  const f = `icon-${size}.png`;
  if (existsSync(join(iconDir, f))) {
    mkdirSync(join(dist, "icons"), { recursive: true });
    cpSync(join(iconDir, f), join(dist, "icons", f));
    icons[size] = `icons/${f}`;
  } else console.warn(`warning: missing ${f} — run: node scripts/make-icons.mjs`);
}

const marketplaces = ["https://www.upwork.com/*", "https://*.upwork.com/*", "https://www.fiverr.com/*", "https://www.freelancer.com/*"];
const contentMatches = [...marketplaces, `${origin.protocol}//${origin.hostname}/demo-board*`];
if (!isLocal) {
  // Always allow the local dev fixture too.
  contentMatches.push("http://localhost/demo-board*", "http://127.0.0.1/demo-board*");
}

const manifest = {
  manifest_version: 3,
  name: "GigRadar",
  short_name: "GigRadar",
  version: pkg.version,
  description: "Scores the gigs you're viewing against your skills and drafts the pitch. You review and submit — GigRadar never sends anything for you.",
  minimum_chrome_version: "120",
  action: { default_title: "GigRadar", default_popup: "popup.html", ...(Object.keys(icons).length ? { default_icon: icons } : {}) },
  ...(Object.keys(icons).length ? { icons } : {}),
  background: { service_worker: "background.js" },
  // storage: license key + API address. activeTab + scripting: read the tab you opened the popup on. No cookies, no history, no webRequest.
  permissions: ["storage", "activeTab", "scripting"],
  host_permissions: [originPattern],
  optional_host_permissions: ["https://*/*", "http://localhost/*", "http://127.0.0.1/*"],
  content_scripts: [{ matches: contentMatches, js: ["content.js"], run_at: "document_idle" }],
};
writeFileSync(join(dist, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`\nBuilt GigRadar extension v${pkg.version} → ${dist}\n  default API: ${apiBase}`);
