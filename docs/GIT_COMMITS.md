# Push TrustShare to GitHub in clear commits (Windows cmd)

Paste one block at a time into cmd. Each block stages one part of the project and commits it with its own message. The commits get today's real time. Don't fake older dates: judges can tell, and it looks worse than a short history.

## 0. Once: go to the folder and set your name

```
cd C:\Users\my060\TrustShare\trustshare
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
git status
```
`.env` and `node_modules` must **not** appear in the list. If `.env` appears, stop and tell me.

## 1. Starter kit and shared contracts

```
git add package.json package-lock.json .gitignore .env.example README.md OWNERS.md eslint.config.mjs next.config.ts postcss.config.mjs tsconfig.json prisma scripts src/lib/shared docs/handouts/HANDOUT_A.md docs/handouts/HANDOUT_B.md docs/handouts/HANDOUT_C.md
git commit -m "Starter kit: Prisma schema, shared contracts (auth, audit, notify, booking states, demo clock), seed data and part handouts"
```

## 2. Part A: discovery, credentials, admin

```
git add src/features/a src/app/page.tsx src/app/start src/app/resources/page.tsx "src/app/resources/[id]/page.tsx" src/app/credentials src/app/notifications src/app/owner src/app/privacy src/app/manager/credentials src/app/admin/page.tsx src/app/admin/users src/app/admin/audit src/app/admin/emails
git commit -m "Part A: start guide, resource catalog and search, eligibility display, credential passport, owner listings and dashboard, notifications, admin pages"
```

## 3. Part B: rule engine, approvals, waitlist

```
git add src/features/b src/app/manager/queue src/app/bookings "src/app/resources/[id]/book"
git commit -m "Part B: 10-rule booking engine, priority score, auto-approval, manager review queue, waitlist promotion, cancellations, appeals, extensions"
```

## 4. Part C: check-in, incidents, penalties, history, demo clock

```
git add src/features/c src/app/checkin src/app/incidents src/app/history src/app/penalties src/app/manager/incidents src/app/manager/penalties src/app/admin/clock
git reset src/features/c/photoDiff.ts src/features/c/components/PhotoDiff.tsx
git commit -m "Part C: check-in and return with condition reports, incidents, penalties and appeals, history timeline, demo clock and scheduler"
```
(The `git reset` line only unstages the photo check files so they get their own commit in step 7. It doesn't delete anything.)

## 5. New UI design

```
git add src/app/layout.tsx src/app/globals.css src/components src/app/favicon.ico
git commit -m "New Blueprint Trust UI: design tokens, navigation, role switcher, shared UI components"
```

## 6. Resource photos

```
git add public/resources public/*.svg
git commit -m "Add resource photos and illustrations to the catalog and seed data"
```

## 7. Before/After photo check

```
git add src/features/c/photoDiff.ts src/features/c/components/PhotoDiff.tsx public/demo
git commit -m "Before/After photo check: align return photo to check-in photo, SSIM change map, manager review recorded in audit log"
```

## 8. Docs and anything left

```
git add docs
git commit -m "Docs: submission notes and fairness simulator handout"
git add .
git status
git commit -m "Remaining fixes after merge"
```
If the last commit says "nothing to commit", that's fine.

## 9. Check, then push

```
git log --oneline
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/trustshare.git
git push -u origin main
```
`git log --oneline` should list about 8 commits, plus the first "Initial commit from Create Next App".

**If a step says `pathspec ... did not match any files`:** that folder doesn't exist on your laptop. Remove that one name from the line and run it again.

**From now on:** commit after each small change, so the history keeps growing during the hackathon:
```
git add .
git commit -m "Fix: short description of what changed"
git push
```
