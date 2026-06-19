# BillTime

A fast, keyboard-first, **local-first** time tracker for hourly billing. Log a workday in seconds, clone previous days, get suggestions from your Claude Code sessions, and export a monthly per-project report to PDF for invoicing. Distinctive cyberpunk "Night City" UI with two switchable skins.

> Your data stays on your machine (SQLite). No accounts, no cloud, no telemetry.

---

## Features

- **Month log timesheet** with gaps highlighting and live totals (hours + amount).
- **Smart time parsing** (Clockify rules): `13` -> 13:00, `2330` -> 23:30, `9.45` -> 09:45, `1pm` -> 13:00; durations `1.5` -> 1h 30m.
- **Keyboard-first composer**: `N` new day, `D` clone last day, `Enter` save, `Shift+Enter` save + next day, `Esc` close.
- **Weekday default descriptions** (e.g. weekdays prefilled with "Consulting").
- **Always-on timer** (start / pause / stop). Stop opens the composer pre-filled with project + from/to so you describe the work - nothing is logged silently.
- **Projects & companies** CRUD, per-project hourly rate + currency (EUR / PLN / USD / GBP).
- **Reports**: a Summary view (per-day bar chart + by-project breakdown + totals) and a Detailed table; date presets + custom range + project filter; **CSV** and **print-to-PDF** export (invoice-style header, correct Polish diacritics).
- **Invoice issuer profile** (name, company, VAT, address, IBAN, email) stamped on the report + PDF.
- **Claude Code suggestions**: reads your local Claude Code transcripts to suggest a day's hours and topics (suggestion only - you always confirm/edit).
- **Two skins**: *Slab* (yellow) and *Terminal* (dark), switch in Settings.

---

## Run it - two ways

### 1. Local (npm) - your dev machine, full features

Requirements: Node >= 20.

```bash
npm install
cp .env.example .env          # DATABASE_URL="file:./dev.db"
npm run db:migrate            # create the SQLite schema
npm run db:seed               # optional: sample data
npm run dev                   # http://localhost:3000  (use `next dev -p 3001` to change the port)
```

This mode has the **full** Claude Code integration: the suggestion chip (hours + topics) **and** the on-demand AI "sum" button (uses your local `claude` CLI / subscription).

### 2. Docker (self-host) - always-on

Requirements: Docker.

```bash
docker compose up -d --build  # http://localhost:3939
```

- **Data** lives in the named volume `billtime-data` (SQLite at `/data/billtime.db`), so it survives rebuilds. Backup: `docker compose cp billtime:/data/billtime.db ./backup.db`.
- **Port**: host `3939` -> container `3000` (chosen to avoid clashing with other containers). Change the mapping in `docker-compose.yml`.
- **Migrations** run automatically on container start.
- **Update**: `git pull && docker compose up -d --build`. **Stop**: `docker compose down` (add `-v` to also wipe the data volume).

---

## Claude Code billing suggestions - how it works

BillTime reads your local Claude Code session transcripts (`~/.claude/projects/<slug>/<uuid>.jsonl`), matches each session to a project by its working directory (the `cwd` in the transcript vs. the repo paths you set on the project), estimates active hours from the timestamp spans (with an idle-gap cap), and lists the session topics. It only **suggests** - you confirm/edit before anything is saved. Transcript reading is purely local file access.

**In each run mode:**

| | Suggestion chip (hours + topics) | On-demand AI "sum" (one-line outcome) |
|---|---|---|
| **npm (dev machine)** | ✅ reads `~/.claude/projects` | ✅ via your local `claude` CLI |
| **Docker** | ✅ *if* you mount transcripts (below) | ⚠️ needs the local `claude` CLI (not in the image) |

To enable the suggestion chip inside Docker, run the container **on the same machine** you use Claude Code on and uncomment these in `docker-compose.yml`:

```yaml
environment:
  - BILLTIME_CC_DIR=/cc
volumes:
  - ${HOME}/.claude/projects:/cc:ro
```

A container can't reach your host filesystem otherwise, and a Docker instance on a *remote* server fundamentally can't see your laptop's transcripts - that part is local-first by design. (For full AI summaries in Docker, the planned path is an `ANTHROPIC_API_KEY` fallback - not wired yet.)

---

## Tech stack

Next.js 16 (App Router, Server Components + Server Actions) · TypeScript (strict) · Prisma ORM + SQLite (schema written to swap to PostgreSQL via a datasource change) · Tailwind CSS 3 · Zod at I/O boundaries · `date-fns`.

**Data model:** `Company -> Project (rate, currency, color, repo paths) -> TimeEntry`; `Setting` (key/value: currency, skin, issuer profile, ...), `WeekdayDefault`, `ActiveTimer`. Money is stored as integer cents; dates as `YYYY-MM-DD`; times as minutes-from-midnight (no timezone bugs).

## Scripts

```bash
npm run dev          # local dev server
npm run build        # production build
npm run start        # serve the production build
npm run typecheck    # tsc --noEmit
npm run db:migrate   # apply Prisma migrations (dev)
npm run db:seed      # seed sample data
```

---

## License

See [LICENSE](LICENSE).

Built by **przemokam** (TryHard3r).
