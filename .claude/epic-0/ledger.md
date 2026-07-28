# Epic E-0 — Foundation & platform scaffolding — ledger

| story | scope | files | tests | commit | status | risks |
|-------|-------|-------|-------|--------|--------|-------|
| S-01 | Next.js 16 App Router scaffold, TanStack Query + Zod, env contract, Vercel git-linked deploy | app/, public/, package.json, tsconfig.json, eslint.config.mjs, next.config.ts, .env.example | `npm run build` -> pass; deployed URL -> 200 | a01e522 (merged to main via PR #9, e85187c) | done | Bumped Next.js 15->16 (ADR-0005 updated) since create-next-app's latest resolved to 16; merged to main ahead of the rest of the epic so Vercel's production branch had buildable code — S-02/S-03 still land via the epic branch as normal |
