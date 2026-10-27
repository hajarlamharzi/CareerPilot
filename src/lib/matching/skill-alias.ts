/**
 * Skill normalisation.
 *
 * Matching compares skills by *canonical* name, so "js", "JS", "javascript"
 * and "JavaScript" all resolve to the same token. `SKILL_CANONICALS` maps each
 * canonical skill name to the aliases that should count as evidence of it.
 */

export const SKILL_CANONICALS: Record<string, string[]> = {
  react: ["react", "reactjs", "react.js", "react js"],
  "react native": ["react native", "reactnative"],
  typescript: ["typescript", "ts"],
  javascript: ["javascript", "js", "ecmascript"],
  "node.js": ["node.js", "nodejs", "node"],
  express: ["express", "express.js", "expressjs"],
  "next.js": ["next.js", "nextjs", "next"],
  "vue.js": ["vue.js", "vuejs", "vue"],
  laravel: ["laravel"],
  php: ["php"],
  html: ["html", "html5"],
  css: ["css", "css3"],
  "tailwind css": ["tailwind css", "tailwind"],
  sass: ["sass", "scss"],
  sql: ["sql"],
  mysql: ["mysql"],
  postgresql: ["postgresql", "postgres"],
  mongodb: ["mongodb", "mongo"],
  redis: ["redis"],
  python: ["python"],
  pandas: ["pandas"],
  numpy: ["numpy", "numPy"],
  java: ["java"],
  "spring boot": ["spring boot", "spring"],
  kotlin: ["kotlin"],
  go: ["go", "golang"],
  rust: ["rust"],
  csharp: ["c#", "csharp"],
  cpp: ["c++", "cpp"],
  ruby: ["ruby"],
  rails: ["rails", "ruby on rails"],
  graphql: ["graphql"],
  "rest apis": ["rest apis", "rest api", "rest", "api design"],
  docker: ["docker"],
  kubernetes: ["kubernetes", "k8s"],
  terraform: ["terraform"],
  aws: ["aws", "amazon web services"],
  azure: ["azure", "microsoft azure"],
  gcp: ["gcp", "google cloud"],
  linux: ["linux"],
  git: ["git"],
  "github actions": ["github actions"],
  "ci/cd": ["ci/cd", "cicd", "ci cd", "continuous integration"],
  jest: ["jest"],
  vitest: ["vitest"],
  playwright: ["playwright"],
  cypress: ["cypress"],
  "testing library": ["testing library", "@testing-library"],
  accessibility: ["accessibility", "a11y", "wcag", "screen reader"],
  figma: ["figma"],
  storybook: ["storybook"],
  vite: ["vite"],
  webpack: ["webpack"],
  redux: ["redux"],
  zustand: ["zustand"],
  d3: ["d3", "d3.js"],
  recharts: ["recharts"],
  "machine learning": ["machine learning", "ml"],
  pytorch: ["pytorch"],
  tensorflow: ["tensorflow"],
  nlp: ["nlp", "natural language processing"],
  "data structures": ["data structures", "algorithms and data structures"],
  algorithms: ["algorithms", "algorithm"],
  excel: ["excel"],
  "power bi": ["power bi"],
  tableau: ["tableau"],
  kafka: ["kafka"],
  prometheus: ["prometheus"],
  agile: ["agile", "scrum", "kanban"],
  jira: ["jira"],
  "system design": ["system design", "distributed systems"],
  microservices: ["microservices", "micro-service"],
  oauth: ["oauth", "oauth2"],
  jwt: ["jwt", "json web token"],
  security: ["security", "appsec", "application security"],
  bash: ["bash", "shell scripting"],
  nginx: ["nginx"],
  firebase: ["firebase"],
  supabase: ["supabase"],
  prisma: ["prisma"],
  trpc: ["trpc"],
  eslint: ["eslint"],
  prettier: ["prettier"],
  npm: ["npm"],
  pnpm: ["pnpm"],
  yarn: ["yarn"],
  "testing": ["testing", "test automation", "unit testing", "e2e", "end-to-end"],
};

/** Everything checked against CV text, keyed by canonical name. */
export const ALL_SKILLS = Object.keys(SKILL_CANONICALS);

/** Reduce a skill to its canonical name (exact alias match), or null. */
export function canonicalSkill(skill: string): string | null {
  const normalized = skill.trim().toLowerCase();
  for (const [canonical, aliases] of Object.entries(SKILL_CANONICALS)) {
    if (canonical === normalized || aliases.includes(normalized)) {
      return canonical;
    }
  }
  return null;
}