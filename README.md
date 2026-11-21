# Task App Test

Sign up, make projects, and add tasks to each project.

- **Auth:** Supabase Auth — sign up (email + password + display name), log in,
  log out, session kept in sync with `onAuthStateChange`.
- **Data:** Supabase Postgres — `profiles`, `projects`, `tasks`. Every row is
  owned by its user and protected by row-level security, so each user only
  ever sees their own projects and tasks.
- **Stack:** React + Vite, `@supabase/supabase-js` (single shared client in
  `src/supabaseClient.js`).

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

Deployed on Vercel from this repo.
