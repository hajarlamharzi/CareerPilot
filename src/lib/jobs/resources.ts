/**
 * Learning resources keyed by canonical skill.
 *
 * Only free, first-party or long-standing community references are listed, and
 * only where the URL is stable. A skill with no entry gets **no** resources —
 * the UI says so rather than inventing a link, which is the whole point of
 * having a curated map instead of asking a model to recall URLs.
 */

export interface LearningResource {
  label: string;
  url: string;
  /** `docs` = reference, `course` = guided, `practice` = exercises. */
  kind: "docs" | "course" | "practice";
}

const MDN = "https://developer.mozilla.org";
const FREECODECAMP = "https://www.freecodecamp.org/learn";
const ROADMAP = "https://roadmap.sh";

export const LEARNING_RESOURCES: Record<string, LearningResource[]> = {
  javascript: [
    { label: "MDN — Guide JavaScript", url: `${MDN}/fr/docs/Web/JavaScript/Guide`, kind: "docs" },
    { label: "freeCodeCamp — JavaScript Algorithms and Data Structures", url: `${FREECODECAMP}/javascript-algorithms-and-data-structures`, kind: "course" },
  ],
  typescript: [
    { label: "TypeScript Handbook", url: "https://www.typescriptlang.org/docs/handbook/intro.html", kind: "docs" },
    { label: "TypeScript — Exercices de types", url: "https://www.typescriptlang.org/play", kind: "practice" },
    { label: "Roadmap TypeScript", url: `${ROADMAP}/typescript`, kind: "course" },
  ],
  python: [
    { label: "Python — Documentation officielle", url: "https://docs.python.org/fr/3/tutorial/", kind: "docs" },
    { label: "freeCodeCamp — Scientific Computing with Python", url: `${FREECODECAMP}/scientific-computing-with-python`, kind: "course" },
  ],
  react: [
    { label: "React — Apprendre", url: "https://fr.react.dev/learn", kind: "docs" },
    { label: "Roadmap React", url: `${ROADMAP}/react`, kind: "course" },
  ],
  "next.js": [
    { label: "Next.js — Documentation", url: "https://nextjs.org/docs", kind: "docs" },
    { label: "Next.js — Tutoriel officiel", url: "https://nextjs.org/learn", kind: "course" },
  ],
  "node.js": [
    { label: "Node.js — Documentation", url: "https://nodejs.org/fr/docs/guides", kind: "docs" },
    { label: "Roadmap Node.js", url: `${ROADMAP}/nodejs`, kind: "course" },
  ],
  express: [
    { label: "Express — Guide", url: "https://expressjs.com/fr/guide/routing.html", kind: "docs" },
  ],
  sql: [
    { label: "SQLBolt — Exercices interactifs", url: "https://sqlbolt.com/", kind: "practice" },
    { label: "PostgreSQL — Tutoriel", url: "https://www.postgresql.org/docs/current/tutorial.html", kind: "docs" },
  ],
  postgresql: [
    { label: "PostgreSQL — Documentation", url: "https://www.postgresql.org/docs/current/index.html", kind: "docs" },
    { label: "Supabase — Guide PostgreSQL", url: "https://supabase.com/docs/guides/database/overview", kind: "docs" },
  ],
  mysql: [
    { label: "MySQL — Manuel de référence", url: "https://dev.mysql.com/doc/refman/8.4/en/", kind: "docs" },
  ],
  mongodb: [
    { label: "MongoDB University — Cours gratuits", url: "https://learn.mongodb.com/", kind: "course" },
  ],
  laravel: [
    { label: "Laravel — Documentation", url: "https://laravel.com/docs", kind: "docs" },
    { label: "Laracasts — Débuter (partie gratuite)", url: "https://laracasts.com/series/laravel-8-from-scratch", kind: "course" },
  ],
  php: [
    { label: "PHP — Manuel", url: "https://www.php.net/manual/fr/", kind: "docs" },
  ],
  docker: [
    { label: "Docker — Prise en main", url: "https://docs.docker.com/get-started/", kind: "docs" },
    { label: "Roadmap Docker", url: `${ROADMAP}/docker`, kind: "course" },
  ],
  kubernetes: [
    { label: "Kubernetes — Tutoriels", url: "https://kubernetes.io/fr/docs/tutorials/", kind: "docs" },
  ],
  "ci-cd": [
    { label: "GitHub Actions — Documentation", url: "https://docs.github.com/fr/actions", kind: "docs" },
  ],
  git: [
    { label: "Git — Livre Pro Git (fr)", url: "https://git-scm.com/book/fr/v2", kind: "docs" },
  ],
  "machine-learning": [
    { label: "Google — Machine Learning Crash Course", url: "https://developers.google.com/machine-learning/crash-course", kind: "course" },
    { label: "scikit-learn — Guide utilisateur", url: "https://scikit-learn.org/stable/user_guide.html", kind: "docs" },
    { label: "Roadmap AI & Data Scientist", url: `${ROADMAP}/ai-data-scientist`, kind: "course" },
  ],
  "deep-learning": [
    { label: "PyTorch — Tutoriels", url: "https://pytorch.org/tutorials/", kind: "course" },
    { label: "TensorFlow — Tutoriels", url: "https://www.tensorflow.org/tutorials", kind: "course" },
  ],
  pytorch: [
    { label: "PyTorch — Tutoriels officiels", url: "https://pytorch.org/tutorials/", kind: "course" },
  ],
  tensorflow: [
    { label: "TensorFlow — Tutoriels officiels", url: "https://www.tensorflow.org/tutorials", kind: "course" },
  ],
  pandas: [
    { label: "pandas — Guide de démarrage", url: "https://pandas.pydata.org/docs/getting_started/index.html", kind: "docs" },
  ],
  nlp: [
    { label: "Hugging Face — Cours NLP", url: "https://huggingface.co/learn/nlp-course", kind: "course" },
  ],
  "data-engineering": [
    { label: "Data Engineering Zoomcamp (gratuit)", url: "https://github.com/DataTalksClub/data-engineering-zoomcamp", kind: "course" },
    { label: "Roadmap Data Engineer", url: `${ROADMAP}/data-engineer`, kind: "course" },
  ],
  "apache-spark": [
    { label: "Apache Spark — Documentation", url: "https://spark.apache.org/docs/latest/", kind: "docs" },
  ],
  "power-bi": [
    { label: "Microsoft Learn — Power BI", url: "https://learn.microsoft.com/fr-fr/training/powerplatform/power-bi", kind: "course" },
  ],
  aws: [
    { label: "AWS Skill Builder — Cours gratuits", url: "https://skillbuilder.aws/", kind: "course" },
  ],
  "tailwind-css": [
    { label: "Tailwind CSS — Documentation", url: "https://tailwindcss.com/docs", kind: "docs" },
  ],
  html: [
    { label: "MDN — HTML", url: `${MDN}/fr/docs/Web/HTML`, kind: "docs" },
  ],
  css: [
    { label: "MDN — CSS", url: `${MDN}/fr/docs/Web/CSS`, kind: "docs" },
    { label: "Flexbox Froggy (exercices)", url: "https://flexboxfroggy.com/#fr", kind: "practice" },
  ],
  "rest-api": [
    { label: "MDN — Introduction aux API web", url: `${MDN}/fr/docs/Learn/JavaScript/Client-side_web_APIs/Introduction`, kind: "docs" },
    { label: "Roadmap API Design", url: `${ROADMAP}/api-design`, kind: "course" },
  ],
  graphql: [
    { label: "GraphQL — Apprendre", url: "https://graphql.org/learn/", kind: "docs" },
  ],
  jest: [
    { label: "Jest — Documentation", url: "https://jestjs.io/fr/docs/getting-started", kind: "docs" },
  ],
  playwright: [
    { label: "Playwright — Documentation", url: "https://playwright.dev/docs/intro", kind: "docs" },
  ],
  linux: [
    { label: "Linux Journey (fr)", url: "https://fr.linuxjourney.com/", kind: "course" },
  ],
  "agile-scrum": [
    { label: "Scrum Guide officiel (fr)", url: "https://scrumguides.org/scrum-guide.html", kind: "docs" },
  ],
  uml: [
    { label: "uml-diagrams.org", url: "https://www.uml-diagrams.org/", kind: "docs" },
  ],
};

/** Look resources up by canonical slug or by a free-form skill name. */
export function resourcesForSkill(skill: string): LearningResource[] {
  const key = skill.trim().toLowerCase().replace(/[^a-z0-9+#.]+/g, "-").replace(/^-|-$/g, "");
  if (LEARNING_RESOURCES[key]) return LEARNING_RESOURCES[key];

  const aliasMap: Record<string, string> = {
    js: "javascript",
    ts: "typescript",
    nodejs: "node.js",
    "node": "node.js",
    nextjs: "next.js",
    postgres: "postgresql",
    mongo: "mongodb",
    tailwind: "tailwind-css",
    "tailwindcss": "tailwind-css",
    "ml": "machine-learning",
    "sklearn": "machine-learning",
    dataengineering: "data-engineering",
    spark: "apache-spark",
    powerbi: "power-bi",
    "scrum": "agile-scrum",
    rest: "rest-api",
    "api": "rest-api",
  };

  const resolved = aliasMap[key];
  return resolved ? (LEARNING_RESOURCES[resolved] ?? []) : [];
}

/** `true` when we have at least one trustworthy reference for the skill. */
export function hasCuratedResources(skill: string): boolean {
  return resourcesForSkill(skill).length > 0;
}
