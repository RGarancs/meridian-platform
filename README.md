# Meridian platform

One AI-native platform of business modules, in one design system, sold directly or under a partner's brand.
Plan and module map: https://claude.ai/artifact/MrCqjPqpTbbhomFzQ8XPCY · Brand strategy: https://claude.ai/artifact/RzYWRJRsoQLXXoUfni6qH5

## What is here (v0.4)

Design v2, "Apple × Revolut": dark navy with an ultramarine accent, or black and white with blue as the duotone; accent options Ultramarine, Blue, Mono or a partner colour.

| Part | State |
|---|---|
| Platform shell, NordStreet navigation: module sidebar, page tabs with a More dropdown, Settings with a secondary sidebar; right-click menus on every row, keyboard shortcuts (? lists them), counts, Cmd+K search across people, deals, companies and pages, light and dark, white-label name and accent, activity log, toasts with Undo after every change, Escape closes the top layer | Built |
| **Sales (CRM)**: Today (what needs you, pipeline, forecast by month), Deals (board with drag, list), Companies, Contacts (lawful basis filter, CSV import that creates and links companies), Tasks, Reports (stages, lead sources, lost reasons), record panel with timeline, tasks, stage, GDPR export and delete forever | Built, example data |
| **Sales AI layer (VG / Daniels)**: Customers (automatic health score with reasons, automatic segments by k-means, custom properties), Service inbox (automatic topic, priority and tone, reply targets, drafted replies you approve), Newsletters (segment audience with consent check, personalisation, approve then send), Autopilot (suggested next actions with reasons), 5B insight cards in Reports | Built, example data |
| **People (HR)**: Overview, Directory with org chart and person profile, Time off (approvals with team clashes, 4-week calendar, balances, LV holidays), Documents (versions, signatures, expiry), Hiring (board, scores, reasons, salary ranges, hire starts onboarding, GDPR clean-up), Joiners and leavers (checklists by owner, vacation owed on leaving), Goals (company → team → person, roll-up, check-ins, status vs time), Reviews and feedback (weighted goals, spread, praise and growth), Bonuses (score → payout, budget cap), Skills and training (matrix vs role, renewals), Pay bands (compa-ratio), Pulse (anonymous eNPS) | Built, example data |
| **Languages**: English and Latvian for every screen (`src/platform/i18n.ts`, `lang-lv.ts`); dates, numbers and euro amounts follow the language; switch in the top bar, Settings › Language and region, or Cmd+K. A test fails if a string has no Latvian text | Built |
| **Plans and pricing** (Settings): three pricing models compared on any customer size, with a suggestion | Draft prices to decide on |
| Other modules (Marketing, Work, Insights, Strategy, Academy, Studio, Ledger, Harness) | Listed with what each builds on; Marketing is next |
| Hosted database: `supabase/migrations/0001`–`0004` (partners, tenants, memberships, row-level security per tenant, append-only audit log, People, and the Sales AI tables: properties, tickets, newsletters, dismissed suggestions, language per person) | Written and checked on a local Postgres, not yet applied to Supabase |

The demo keeps data in the browser (`LocalRepository`). Hosting swaps in a Supabase repository behind the same interface; the pages don't change.

## Rules every module follows

1. Business rules live in pure functions (`src/<module>/domain.ts`) with unit tests. Pages only call them.
2. One schema per object drives its list, record panel and form.
3. Contacts carry where they came from and the lawful basis for keeping them; consent needs a date. Export and delete forever are built in, and the log names no personal data.
4. A lost deal needs a reason; numbers come from code, never from a model.
5. Nothing is sent, published or spent without a named person's approval (arrives with the email and AI drafting features).
6. Meridian tokens (`src/platform/theme.css`); a partner overrides only name, accent and logo.
7. No NordStreet code or data.

## Run

```sh
npm install
npm run dev      # http://localhost:5173
npm test         # domain, language and pricing tests
npm run build    # also writes dist/meridian-demo.html, the whole app in one file
```

## Adding a language string

Write English in the code as `tr('Your text')` (or `tr('{0} deals', { 0: n })`), then add the Latvian to `src/platform/lang-lv.ts`. `npm test` lists any string still missing.

## Next

- Sales: email sync and drafting with approval, owners and permissions, support inbox.
- People: employee self-service view, HPT Index as the team assessment, role-based access to pay, reviews and candidates, Easter-based holidays, e-signature.
- Hosting: apply the migration to a Supabase project in Frankfurt, add sign-in, deploy on Vercel.
