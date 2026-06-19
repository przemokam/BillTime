# BillTime

A simple, fast, keyboard-first personal time-tracking app for hourly billing. Log a workday in seconds, clone previous days as templates, get suggestions from your Claude Code sessions, and export a monthly per-project hours report to PDF for invoicing.

Local-first (runs on your machine), with a path to a server-hosted version later.

## Status

Pre-build. Environment + agent config are set up. The product proposal (`PROPOSAL.md`) is in review. Build starts after approval.

## Stack (planned)

- Next.js 16 (App Router) + TypeScript strict
- Prisma ORM + SQLite (local file; swappable to PostgreSQL for a server version)
- Tailwind CSS + shadcn/ui
- Vitest + Playwright

## Scripts (after the project is scaffolded)

```bash
npm install
npm run dev          # local dev server
npm run db:migrate   # apply Prisma migrations
npm run test         # unit tests (Vitest)
```

## For AI coding agents

See `AGENTS.md` (single source of truth) and `CLAUDE.md`. Run `/start` at the beginning of a session and `/save` at the end.
