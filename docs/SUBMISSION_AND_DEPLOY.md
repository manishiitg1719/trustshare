# TrustShare: form answers, GitHub and deploy

Every team member submits the form **separately**. The project answers in Part 2 can be the same for everyone. Part 1 must be different for each person.

---

## Part 1. Your own fields (fill these in yourself)

- **Hackathon:** pick the one you registered for on Unstop.
- **Full name:** exactly as you want it on the certificate.
- **Email:** the same email you used on Unstop.
- **Team name:** CAPITAL LETTERS, exactly as on Unstop.
- **Leader or member:** your choice.
- **Roles:** tick only what that person really did. Suggested ticks are below.

**What did YOU personally build?** Use the template that matches the person. Change it if they did something else.

**Mamba (team lead; suggested roles: Product / Research, Backend, Design / UI-UX, Presentation / Demo)**
> Designed the TrustShare architecture and the shared data model (Prisma schema with 15+ tables, booking state machine, append-only audit log, database overlap constraint). Split the work into three parts with written handouts and merged them. Redesigned the whole UI (the "Blueprint Trust" design system, navigation, resource catalog and detail pages). Added the Before/After photo check (photo alignment plus SSIM change detection with a human review step), the resource photos and the demo data, and prepared the demo and submission.

**Part A friend (suggested roles: Frontend, Backend)**
> Built the discovery and admin side: the layout and role switcher, the Judge Start Here guide, the resource catalog with search and filters, the eligibility display ("what you are missing and how to fix it"), owner listing and editing, the credential passport (upload and manager verification), notifications, the admin dashboard (users, audit log, simulated emails) and the owner utilisation dashboard.

**Part B friend (suggested roles: Backend)**
> Built the booking rule engine (10 explainable rules: credentials, opening hours, duration, active cap, monthly quota, cooldown, clash, risk tier, supervisor), the priority score for fair access, auto-approval for low-risk items, the manager review queue with reasons, the waitlist with automatic promotion, cancellations, appeals and extensions.

**Part C friend (suggested roles: Backend, Frontend)**
> Built the usage lifecycle: QR or code check-in, condition checklists with photos at pickup and return, incident reporting and handling, penalties with manager confirmation and appeals, disputes, the booking history timeline, the demo clock and the scheduler (reminders, no-shows, overdue returns, credential expiry).

---

## Part 2. Project answers (copy and paste)

**Project name**
> TrustShare

**What problem are you solving? (one line)**
> Expensive college lab equipment and rooms sit unused most of the week because there is no safe, fair and trusted way to share them.

**Explain the problem in detail**
> In a typical engineering department, laser cutters, 3D printers, oscilloscopes, camera kits and seminar rooms are idle most of the time, while students and nearby startups who need them cannot get access. Today booking happens through WhatsApp messages, paper sign-up sheets and personal favours. Staff cannot tell who is trained to use a high-risk machine, so they say no by default. A few people take most of the slots, no-shows waste the rest, and when something breaks nobody can prove its condition before and after use. The cost: wasted equipment budgets, students who cannot finish projects, staff spending hours on manual approvals, and damage disputes with no evidence.

**What is your solution?**
> TrustShare is a web platform where verified owners list equipment and spaces, and eligible people book them. Every booking passes 10 published rules (training credentials, opening hours, length, active-booking cap, monthly quota, cooldown, clashes, risk level, supervisor), and the user sees exactly which rule failed and how to fix it. Low-risk items are approved instantly; high-risk items go to a manager with the reasons shown. A priority score gives people with less access a fair chance, and a waitlist promotes the next eligible person automatically when a slot frees up. At pickup and return, users check in with a QR code and record a condition checklist with photos. A photo check lines up the before and after photos and highlights possible changes for a human to review. Incidents, penalties and appeals are handled in the app, and every decision is written to an append-only audit history. Owners see a utilisation dashboard showing how much their equipment is actually used.

**Who are your target users?**
> Students and researchers who need equipment, local startups and external makers (with stricter rules), lab owners and department staff who list resources, lab managers who approve requests and handle incidents, and admins who verify users.

**What makes it distinctive or original?**
> Trust and fairness are built in, not added later. Every decision is explainable (each rule's result and fix is shown), access depends on verified training (a credential passport), and risk tiers decide what is automatic and what needs a human. Fairness is enforced with quotas, cooldowns and a published priority formula. Condition is proven with before/after photos and an image-comparison check that never claims to prove damage on its own: a person always decides. The database itself blocks double bookings, and the audit log cannot be edited. A demo clock lets judges fast-forward time to see reminders, no-shows and overdue returns happen.

**Tech stack, models and APIs used**
> Next.js 15 (App Router, React Server Components, server actions), React 19, TypeScript, Tailwind CSS 4, Prisma 6 ORM, PostgreSQL on Neon (with an exclusion constraint against overlapping bookings and an append-only audit trigger), deployed on Vercel. Photo check: our own TypeScript implementation of image alignment and SSIM (structural similarity, Wang et al. 2004) running in the browser on HTML canvas. No external AI APIs or ML models are called at runtime. We used AI coding assistants (Claude) to help write and review code.

**Prompt architecture and AI workflow**
> TrustShare does not send prompts to any language model at runtime. The "intelligence" is deterministic and explainable: (1) the booking rule engine takes a request (user, resource, time), runs 10 rules against the database and returns a result for each rule plus an outcome (auto-approve, manager review, waitlist or reject) and a priority score, all of which is stored with the booking and shown to the user; (2) the photo check loads the check-in and return photos into the browser, estimates the shift, rotation and zoom between them, warps the return photo to line up, evens out lighting, computes an SSIM map, groups changed areas into boxes, and shows them to a manager, who records "real damage" or "not damage" in the audit log; (3) the incident summary is a rule-based template that lists failed checklist items and suggests a severity, clearly labelled as a suggestion. Data flow: browser form → Next.js server action → rule engine / Prisma → PostgreSQL → audit log and notifications → pages re-render. During development we used Claude as a coding assistant.

**Agents, chains or evaluation methods**
> None.

**GitHub repository link**
> (after Part 3) https://github.com/YOUR-USERNAME/trustshare

**Drive link containing the PDF**
> Upload your presentation PDF to Google Drive → right-click → Share → General access: "Anyone with the link" → Viewer → Copy link.

**Live deployed project link**
> (after Part 4) https://trustshare-XXXX.vercel.app

---

## Part 3. Put the code on GitHub (Windows cmd)

1. On github.com, click **New repository**. Name: `trustshare`. Choose **Public**. Do **not** add a README, .gitignore or licence. Click Create.
2. In cmd (replace `YOUR-USERNAME`):

```
cd C:\Users\my060\TrustShare\trustshare
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
git status
```
Check that `.env` and `node_modules` are **not** in the list (the `.gitignore` already hides them). Then:
```
git add .
git status
git commit -m "TrustShare: merge parts A, B, C, new UI, photo check"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/trustshare.git
git push -u origin main
```
If the push asks you to sign in, a browser window opens: log in to GitHub there.

**Before you push:** `git status` must not show `.env`. If it does, stop and tell me.

Later changes:
```
git add .
git commit -m "describe what changed"
git push
```

## Part 4. Deploy on Vercel (live link)

1. Go to vercel.com → **Sign up with GitHub**.
2. **Add New → Project** → import `trustshare`.
3. Framework: Next.js (detected automatically). Leave the build settings as they are.
4. Open **Environment Variables** and add `DATABASE_URL`, with the same value as in your `.env` file (your Neon connection string). Copy it from the file yourself; never paste it into chat or into the form.
5. Click **Deploy**. Wait about 2 minutes, then open the link it gives you.
6. Open `/start` on the live site and press **Reset demo data** once.

The live site uses the same Neon database you already set up, so you don't need to run `db:setup` again. If the build fails, copy the red error text and send it to me.
