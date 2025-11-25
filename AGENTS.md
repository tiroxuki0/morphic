# Repository Guidelines

## Project Structure & Module Organization
Darin is a Next.js App Router workspace. `app/` holds routes, layouts, and API handlers, `components/` plus `components/ui` provide design primitives, and `lib/` stores streaming helpers, Supabase clients, and AI actions. Provider presets live in `config/`, Drizzle schemas and migrations in `drizzle/`, long-form docs in `docs/`, and static assets under `public/`. Tests stay near each feature inside `__tests__` folders (for example `lib/actions/__tests__/chat.test.ts`), while automation lives in `scripts/` alongside infra manifests such as `docker-compose.yaml` and `proxy.ts`.

## Build, Test, and Development Commands
`bun dev` starts the local server; `bun run build && bun start` serves production output. Run `bun run migrate` whenever database schema changes, then `bun run lint`, `bun run typecheck`, and `bun run format:check` before committing. Execute `bun run test` or `bun run test:watch` for Vitest suites, and use `docker compose up -d` when you need Postgres, Redis, and SearXNG locally.

## Coding Style & Naming Conventions
Code is TypeScript-first. React components use PascalCase, functions use camelCase, and file names describe the feature (`research-process-section.tsx`). Prettier (configured in `prettier.config.js`) controls whitespace and quotes; ESLint extends `next/core-web-vitals` with `simple-import-sort`, so keep imports grouped as framework → third-party → `@/` aliases. Tailwind utilities stay inline, and shared tokens belong in `components.json` or CSS modules.

## Testing Guidelines
Vitest with Testing Library is configured through `vitest.config.mts` and `vitest.setup.ts`. Add specs named `*.test.ts` or `*.test.tsx` beside the code they cover, mirroring the existing `lib/db/__tests__` and `components/__tests__` suites. Cover happy, failure, and integration paths before filing a PR, then run `bun run test && bun run lint && bun run typecheck` to match CI expectations.

## Commit & Pull Request Guidelines
Use Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`) and branch names like `feat/improved-citations`. Each PR must summarize the change, link issues, list verification steps, and provide screenshots for UI shifts. Call out required `.env.local` updates and migrations so reviewers can reproduce with `bun run migrate` or Docker.

## Environment & Security Tips
Copy `.env.local.example` to `.env.local`, fill `DATABASE_URL`, AI/search keys, and toggle `ENABLE_AUTH` for production. Never commit secrets; rely on Vercel encrypted variables or Docker secrets. Model presets in `config/models/*.json` are bundled at build time, so rebuild when they change and rerun migrations after editing `drizzle/` schemas.
