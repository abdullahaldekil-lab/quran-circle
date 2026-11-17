# Quran Circle — مجمع حلق جامع حويلان

Arabic RTL application for circle and student administration, attendance, daily recitation, Madarij, guardian follow-up, and Quran narration days.

- Live application: https://quran-circle.enter.com.sa
- Repository: https://github.com/abdullahaldekil-lab/quran-circle
- Stack: React 18, TypeScript, Vite, Tailwind/shadcn, Supabase Auth/Postgres/Edge Functions.

## Local development

Use Node.js 22 and npm. `package-lock.json` is the lockfile used by CI.

```sh
npm ci
npm run dev
```

The browser uses the public `VITE_SUPABASE_*` configuration. Never add service-role keys, database passwords, cron secrets, or user credentials to browser configuration or version control.

## Verification

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

SQL regression scenarios are under `supabase/tests`; run them against an isolated, migrated database with suitable test fixtures. Frontend tests do not replace database permission checks or browser tests with each role.

## Deployment

The checked-in GitHub workflow verifies code; it does not deploy the live application. The existing project is published through Lovable. Edge Functions and database migrations have separate release requirements. See [deployment instructions](docs/deployment.md) before publishing.

The current Himmah duration is a **minimum** active recitation time: the timer continues after it and preserves the actual duration. Approved scores use the attempt's saved grading settings. See [AGENTS.md](AGENTS.md) for additional project invariants.

## Review status

See [the system audit dated 17 November 2026](docs/system-audit-2026-11-17.md) for verified fixes, remaining risks, and the limits of the review.
