# TrustShare starter kit

A trusted sharing platform for one college engineering department: verified owners list labs and equipment, eligible users book them, and every decision is explained and recorded.

Stack: Next.js 15 (App Router, server actions) · TypeScript · Tailwind CSS 4 · Prisma 6 · PostgreSQL.

## Setup (10 minutes)

1. Get a Postgres database. Either a free Supabase or Neon project (copy the connection string), or local Docker:
   `docker run -d --name ts-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=trustshare -p 5432:5432 postgres:16`
2. `cp .env.example .env` and set `DATABASE_URL`.
3. `npm install`
4. `npm run db:setup` creates the tables, adds the overlap constraint and append-only audit trigger, and loads demo data.
5. `npm run dev` and open http://localhost:3000. Pick a persona on the Start page.

Use the **Reset demo data** button on `/start` (or `npm run db:seed`) whenever you want the seeded states back.

Each builder uses their **own** database while building, so nobody breaks anyone else's data.

## Rules for the three builders

- Read your handout in `docs/handouts/`. Then read `OWNERS.md`.
- Work on your own git branch: `part-a`, `part-b` or `part-c`.
- Edit only the files you own. Do not edit `prisma/schema.prisma` or anything in `src/lib/shared/`. If you think a shared file must change, tell Mamba first.
- Always use `now()` from `src/lib/shared/clock.ts` instead of `new Date()` for business logic.
- Every booking status change goes through `transitionBooking()`. Every other important action calls `logAudit()`. Every message to a user goes through `notify()`.
- Run `npm run typecheck` and `npm run lint` before you hand over.
- Commit often with clear messages. Judges may ask for development history.
