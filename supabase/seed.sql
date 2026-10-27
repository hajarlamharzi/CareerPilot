-- =============================================================================
-- CareerPilot — optional seed data
-- =============================================================================
-- NOT applied by `supabase db push`. Run it explicitly:
--   supabase db execute --file supabase/seed.sql
-- or paste it into the SQL Editor.
--
-- Two clearly separated parts:
--
--   1. Reference data (skills catalogue, job sources) — legitimate in any
--      environment, including production.
--
--   2. DEMO LISTINGS — every row is inserted with `is_sample = true` and
--      `source_type = 'sample'`. The interface renders an explicit
--      "Données d'exemple" badge for them and never presents them as current
--      vacancies. Skip part 2 entirely for a clean production catalogue.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Reference data
-- -----------------------------------------------------------------------------

insert into public.skills (name, slug, category) values
  ('JavaScript',        'javascript',        'Langages'),
  ('TypeScript',        'typescript',        'Langages'),
  ('Python',            'python',            'Langages'),
  ('Java',              'java',              'Langages'),
  ('PHP',               'php',               'Langages'),
  ('C#',                'csharp',            'Langages'),
  ('C++',               'cpp',               'Langages'),
  ('Go',                'go',                'Langages'),
  ('SQL',               'sql',               'Bases de données'),
  ('PostgreSQL',        'postgresql',        'Bases de données'),
  ('MySQL',             'mysql',             'Bases de données'),
  ('MongoDB',           'mongodb',           'Bases de données'),
  ('Redis',             'redis',             'Bases de données'),
  ('React',             'react',             'Front-end'),
  ('Next.js',           'nextjs',            'Front-end'),
  ('Vue.js',            'vuejs',             'Front-end'),
  ('Angular',           'angular',           'Front-end'),
  ('Tailwind CSS',      'tailwind-css',      'Front-end'),
  ('HTML',              'html',              'Front-end'),
  ('CSS',               'css',               'Front-end'),
  ('Node.js',           'nodejs',            'Back-end'),
  ('Express',           'express',           'Back-end'),
  ('NestJS',            'nestjs',            'Back-end'),
  ('Laravel',           'laravel',           'Back-end'),
  ('Django',            'django',            'Back-end'),
  ('FastAPI',           'fastapi',           'Back-end'),
  ('Spring Boot',       'spring-boot',       'Back-end'),
  ('REST API',          'rest-api',          'Back-end'),
  ('GraphQL',           'graphql',           'Back-end'),
  ('Docker',            'docker',            'DevOps'),
  ('Kubernetes',        'kubernetes',        'DevOps'),
  ('CI/CD',             'ci-cd',             'DevOps'),
  ('Terraform',         'terraform',         'DevOps'),
  ('AWS',               'aws',               'Cloud'),
  ('Azure',             'azure',             'Cloud'),
  ('Google Cloud',      'google-cloud',      'Cloud'),
  ('Machine Learning',  'machine-learning',  'Data & IA'),
  ('Deep Learning',     'deep-learning',     'Data & IA'),
  ('TensorFlow',        'tensorflow',        'Data & IA'),
  ('PyTorch',           'pytorch',           'Data & IA'),
  ('Pandas',            'pandas',            'Data & IA'),
  ('NLP',               'nlp',               'Data & IA'),
  ('Data Engineering',  'data-engineering',  'Data & IA'),
  ('Power BI',          'power-bi',          'Data & IA'),
  ('Apache Spark',      'apache-spark',      'Data & IA'),
  ('Git',               'git',               'Outils'),
  ('Linux',             'linux',             'Outils'),
  ('Jest',              'jest',              'Tests'),
  ('Playwright',        'playwright',        'Tests'),
  ('Agile Scrum',       'agile-scrum',       'Méthodes'),
  ('UML',               'uml',               'Méthodes')
on conflict (name) do nothing;

insert into public.job_sources (name, base_url, source_type, enabled, configuration) values
  ('Catalogue CareerPilot', null, 'manual', true,
   '{"description": "Offres créées directement dans l''administration."}'::jsonb),
  ('Import CSV / JSON', null, 'csv', true, '{}'::jsonb),
  ('Offres proposées par les utilisateurs', null, 'user-submitted', true, '{}'::jsonb)
on conflict (name) do nothing;

-- -----------------------------------------------------------------------------
-- 2. DEMO LISTINGS — clearly labelled sample data. Delete this block, or run
--      delete from public.jobs where is_sample;
--    before opening the platform to real users.
-- -----------------------------------------------------------------------------

insert into public.jobs (
  title, company_name, description, location, work_mode, employment_type,
  seniority, salary_min, salary_max, currency, required_skills,
  preferred_skills, source_name, source_url, source_type, is_sample,
  published_at, status
) values
  (
    'Stage PFE — Ingénieur Machine Learning',
    'Atlas Data Lab',
    'Stage de fin d''études de 6 mois au sein de l''équipe Data & IA. Vous participerez à la conception de modèles de recommandation et à leur mise en production. Encadrement par un ingénieur senior et revue de code hebdomadaire.',
    'Casablanca, Maroc', 'hybrid', 'internship', 'intern',
    4000, 6000, 'MAD',
    array['Python', 'Machine Learning', 'SQL'],
    array['PyTorch', 'Docker', 'Data Engineering'],
    'CareerPilot démo', null, 'sample', true, now() - interval '6 days', 'published'
  ),
  (
    'Développeur Full-Stack React / Node.js (junior)',
    'MedTech Solutions',
    'Vous rejoignez une équipe produit de 8 personnes pour faire évoluer une plateforme SaaS de gestion médicale. Stack TypeScript, Next.js, PostgreSQL. Possibilité de télétravail deux jours par semaine.',
    'Rabat, Maroc', 'hybrid', 'full-time', 'junior',
    9000, 13000, 'MAD',
    array['React', 'Node.js', 'TypeScript', 'PostgreSQL'],
    array['Next.js', 'Docker', 'REST API'],
    'CareerPilot démo', null, 'sample', true, now() - interval '3 days', 'published'
  ),
  (
    'Data Engineer',
    'Orient Analytics',
    'Construction de pipelines de données batch et streaming, modélisation dimensionnelle et industrialisation des traitements. Vous travaillez en binôme avec les data scientists.',
    'Casablanca, Maroc', 'onsite', 'full-time', 'mid',
    15000, 22000, 'MAD',
    array['SQL', 'Data Engineering', 'Python'],
    array['Apache Spark', 'Airflow', 'AWS'],
    'CareerPilot démo', null, 'sample', true, now() - interval '11 days', 'published'
  ),
  (
    'Développeur Laravel',
    'Sahara Web Agency',
    'Développement et maintenance d''applications web métier pour des clients PME. Environnement PHP 8 / Laravel, MySQL, déploiement continu.',
    'Marrakech, Maroc', 'onsite', 'full-time', 'junior',
    8000, 11000, 'MAD',
    array['PHP', 'Laravel', 'MySQL'],
    array['Vue.js', 'Git', 'CI/CD'],
    'CareerPilot démo', null, 'sample', true, now() - interval '18 days', 'published'
  ),
  (
    'Frontend Engineer (remote, Europe)',
    'Northwind Fintech',
    'Poste 100 % télétravail pour une fintech européenne. Vous développez des interfaces de gestion de portefeuille, avec un fort accent sur l''accessibilité et la performance.',
    'Télétravail', 'remote', 'full-time', 'mid',
    3500, 4600, 'EUR',
    array['React', 'TypeScript', 'Tailwind CSS'],
    array['GraphQL', 'Playwright', 'Next.js'],
    'CareerPilot démo', null, 'sample', true, now() - interval '2 days', 'published'
  ),
  (
    'Stagiaire Data Analyst',
    'Cap Ville',
    'Stage de 4 à 6 mois : construction de tableaux de bord, nettoyage de données et automatisation des reportings mensuels.',
    'Rabat, Maroc', 'hybrid', 'internship', 'intern',
    3500, 5000, 'MAD',
    array['SQL', 'Power BI', 'Pandas'],
    array['Python', 'Machine Learning'],
    'CareerPilot démo', null, 'sample', true, now() - interval '9 days', 'published'
  )
on conflict (fingerprint) do nothing;
