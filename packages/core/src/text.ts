/**
 * Text helpers for skill matching. Deliberately dependency-free and deterministic.
 */

/** canonical skill -> accepted spellings. Variants shorter than 3 chars only match job *tags*, never free text. */
const ALIASES: Record<string, string[]> = {
  javascript: ["javascript", "js", "ecmascript", "es6"],
  typescript: ["typescript", "ts"],
  node: ["node", "node.js", "nodejs"],
  react: ["react", "react.js", "reactjs"],
  "react native": ["react native", "react-native"],
  nextjs: ["next.js", "nextjs", "next js"],
  vue: ["vue", "vue.js", "vuejs"],
  angular: ["angular", "angularjs"],
  python: ["python", "py"],
  postgres: ["postgres", "postgresql", "psql"],
  mysql: ["mysql", "mariadb"],
  mongodb: ["mongodb", "mongo"],
  kubernetes: ["kubernetes", "k8s"],
  docker: ["docker", "containers", "containerization"],
  aws: ["aws", "amazon web services"],
  gcp: ["gcp", "google cloud"],
  go: ["golang", "go lang", "go"],
  rust: ["rust", "rustlang"],
  "c#": ["c#", "csharp", "c sharp", ".net", "dotnet"],
  "c++": ["c++", "cpp"],
  php: ["php", "laravel"],
  ruby: ["ruby", "rails", "ruby on rails"],
  llm: ["llm", "llms", "large language model", "large language models", "gpt", "openai", "anthropic", "claude"],
  ai: ["ai", "artificial intelligence", "genai", "generative ai", "gen ai"],
  "machine learning": ["machine learning", "ml"],
  "data engineering": ["data engineering", "etl", "data pipeline", "data pipelines"],
  sql: ["sql", "t-sql", "plsql"],
  wordpress: ["wordpress", "wp", "woocommerce"],
  shopify: ["shopify", "liquid"],
  figma: ["figma"],
  "ux design": ["ux", "ui/ux", "ux design", "ux/ui", "product design"],
  seo: ["seo", "search engine optimization"],
  "copywriting": ["copywriting", "copywriter", "copy writing"],
  solidity: ["solidity", "smart contract", "smart contracts"],
  blockchain: ["blockchain", "web3", "crypto", "defi"],
  scraping: ["scraping", "web scraping", "crawler", "crawling"],
  automation: ["automation", "zapier", "n8n", "make.com"],
  devops: ["devops", "ci/cd", "cicd", "terraform"],
  tailwind: ["tailwind", "tailwindcss"],
  graphql: ["graphql"],
  stripe: ["stripe", "stripe api"],
  api: ["api", "apis", "restful", "rest api"],
};

const REVERSE = new Map<string, string>();
for (const [canon, variants] of Object.entries(ALIASES)) {
  for (const v of variants) REVERSE.set(v, canon);
  REVERSE.set(canon, canon);
}

export function clean(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Canonical name for a skill phrase ("k8s" -> "kubernetes", "Node.js" -> "node"). */
export function canonicalSkill(raw: string): string {
  const c = clean(raw);
  return REVERSE.get(c) ?? c;
}

/** All spellings to look for in text. Includes the original phrase. */
export function skillVariants(raw: string): string[] {
  const canon = canonicalSkill(raw);
  const set = new Set<string>([clean(raw), canon, ...(ALIASES[canon] ?? [])]);
  return [...set].filter(Boolean);
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Word-boundary-ish containment that also works for terms like "c++", "c#", "node.js". */
export function containsTerm(haystackLower: string, term: string): boolean {
  const t = clean(term);
  if (!t) return false;
  const re = new RegExp(`(^|[^a-z0-9+#])${escapeRe(t)}($|[^a-z0-9+#])`, "i");
  return re.test(haystackLower);
}

/** Does free text (title/description) mention this skill? Short variants (<3 chars) are ignored to avoid "go ahead" -> Go. */
export function textMentionsSkill(textLower: string, skill: string): boolean {
  return skillVariants(skill)
    .filter((v) => v.length >= 3)
    .some((v) => containsTerm(textLower, v));
}

/** Does a job tag equal this skill (any spelling, including short ones)? */
export function tagMatchesSkill(tag: string, skill: string): boolean {
  return canonicalSkill(tag) === canonicalSkill(skill);
}

export function titleCaseSkill(s: string): string {
  const c = canonicalSkill(s);
  const SPECIAL: Record<string, string> = {
    javascript: "JavaScript",
    typescript: "TypeScript",
    node: "Node.js",
    nextjs: "Next.js",
    postgres: "PostgreSQL",
    mongodb: "MongoDB",
    graphql: "GraphQL",
    llm: "LLM",
    ai: "AI",
    aws: "AWS",
    gcp: "GCP",
    sql: "SQL",
    seo: "SEO",
    api: "API",
    php: "PHP",
    "c#": "C#",
    "c++": "C++",
    "ux design": "UX design",
    devops: "DevOps",
    wordpress: "WordPress",
    shopify: "Shopify",
  };
  if (SPECIAL[c]) return SPECIAL[c];
  return c.replace(/\b[a-z]/g, (m) => m.toUpperCase());
}
