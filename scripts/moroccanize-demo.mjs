// One-off local migration script (not shipped): rewrites the demo dataset from a
// UK/EU context to a Moroccan one so salaries read in MAD (DH) at realistic
// Moroccan levels. Idempotent: it derives values from each record's *seniority*
// and index, never from whatever currency happens to be there now, so running it
// twice produces the same file.
//
// Run with: node scripts/moroccanize-demo.mjs
import { readFileSync, writeFileSync } from "node:fs";

const JOBS = "src/data/demo/jobs.json";
const APPS = "src/data/demo/applications.json";
const PROFILE = "src/data/demo/profile.json";
const CV = "src/data/demo/cv.json";

/** Realistic monthly MAD bands per seniority. */
const BANDS = {
  intern: [3000, 5000],
  junior: [7000, 11000],
  mid: [13000, 22000],
  senior: [25000, 40000],
};

/** Cities assigned round-robin so every job gets a varied, real location. */
const CITIES = [
  "Casablanca, Maroc",
  "Rabat, Maroc",
  "Salé, Maroc",
  "Marrakech, Maroc",
  "Tanger, Maroc",
  "Fès, Maroc",
  "Agadir, Maroc",
  "Kénitra, Maroc",
];

const COMPANIES = {
  "Northwind Labs": { name: "Atlas Digital", website: "https://atlasdigital.example.ma", slug: "atlasdigital" },
  "Bright Harbor": { name: "Medina Pay", website: "https://medinapay.example.ma", slug: "medinapay" },
  "Kite & Compass": { name: "Souk Commerce", website: "https://soukcommerce.example.ma", slug: "soukcommerce" },
  "Meridian Health": { name: "Chifa Santé", website: "https://chifasante.example.ma", slug: "chifasante" },
  "Volta Energy": { name: "Nour Énergie", website: "https://nourenergie.example.ma", slug: "nourenergie" },
  "Cobalt Systems": { name: "Kasbah Cloud", website: "https://kasbahcloud.example.ma", slug: "kasbahcloud" },
  "Lumen Analytics": { name: "Zellige Data", website: "https://zelligedata.example.ma", slug: "zelligedata" },
  "Orchard Union": { name: "Darija Logistics", website: "https://darijalogistics.example.ma", slug: "darijalogistics" },
};

/**
 * Salary for a job, derived only from seniority + index. The `day` contract
 * keeps a day rate; everything else is a monthly Moroccan salary. Values are
 * chosen so a listing never depends on its previous currency.
 */
function salaryFor(job, index) {
  if (job.salary?.period === "day" || job.employmentType === "contract") {
    return { min: 1800, max: 2500, currency: "MAD", period: "day" };
  }
  const [min, max] = BANDS[job.seniority] ?? BANDS.mid;
  const spread = (index % 4) * 500;
  return { min: min + spread, max: max + spread, currency: "MAD", period: "month" };
}

const jobs = JSON.parse(readFileSync(JOBS, "utf8"));
const apps = JSON.parse(readFileSync(APPS, "utf8"));

const companySlug = new Map();

jobs.forEach((job, index) => {
  const company = COMPANIES[job.company];
  if (company) {
    job.company = company.name;
    job.companyWebsite = company.website;
    companySlug.set(company.name, company.slug);
  }

  if (job.workMode === "remote") {
    job.location = /global/i.test(job.location)
      ? "Télétravail (international)"
      : "Télétravail (Maroc)";
  } else {
    job.location = CITIES[index % CITIES.length];
  }

  job.salary = salaryFor(job, index);
  job.sourceName = "Portail Emploi Maroc (démo)";
  const slug = companySlug.get(job.company) ?? "demo";
  job.sourceUrl = `https://emploi.example.ma/${slug}/${job.id}`;

  job.notes = `Annonce d'exemple. ${
    job.workMode === "remote"
      ? "Poste en télétravail depuis le Maroc."
      : `Poste basé à ${job.location}.`
  }`;
});

// Applications must mirror their job exactly (company, salary, source).
const jobById = new Map(jobs.map((job) => [job.id, job]));

for (const app of apps) {
  const job = jobById.get(app.jobId);
  if (job) {
    app.company = job.company;
    app.position = job.title;
    app.salary = job.salary;
    app.sourceUrl = job.sourceUrl;
  }
  app.sourceName = "Portail Emploi Maroc (démo)";
  for (const note of app.notes ?? []) {
    note.body = note.body.replace(
      /£48,000[^.]*/,
      "15 000 MAD par mois",
    );
  }
}

writeFileSync(JOBS, JSON.stringify(jobs, null, 2) + "\n");
writeFileSync(APPS, JSON.stringify(apps, null, 2) + "\n");

const profile = JSON.parse(readFileSync(PROFILE, "utf8"));
profile.location = "Salé, Maroc";
profile.phone = "+212 6 61 23 45 67";
writeFileSync(PROFILE, JSON.stringify(profile, null, 2) + "\n");

const cv = JSON.parse(readFileSync(CV, "utf8"));
for (const doc of cv.documents ?? []) {
  if (doc.contact) {
    if (doc.contact.location) doc.contact.location = "Salé, Maroc";
    if (doc.contact.phone) doc.contact.phone = "+212 6 61 23 45 67";
  }
  for (const entry of doc.sections?.experience ?? []) {
    if (!entry.location) continue;
    entry.location = /remote/i.test(entry.location)
      ? "Télétravail"
      : "Casablanca, Maroc";
  }
  for (const entry of doc.sections?.education ?? []) {
    if (typeof entry.institution === "string" && /university of leeds/i.test(entry.institution)) {
      entry.degree = "Licence Informatique";
      entry.institution = "Université Mohammed V";
    }
    if (entry.location) entry.location = "Rabat, Maroc";
  }
}
writeFileSync(CV, JSON.stringify(cv, null, 2) + "\n");

console.log(
  `Rewrote ${jobs.length} jobs, ${apps.length} applications, 1 profile and ${(cv.documents ?? []).length} CV.`,
);
