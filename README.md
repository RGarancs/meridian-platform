# Meridian platform

One AI-native platform of business modules, in one design system, sold directly or under a partner's brand.
Plan and module map: https://claude.ai/artifact/MrCqjPqpTbbhomFzQ8XPCY · Brand strategy: https://claude.ai/artifact/RzYWRJRsoQLXXoUfni6qH5

## What is here (v0.1)

| Part | State |
|---|---|
| Platform shell: module sidebar, search (Cmd+K), light and dark, white-label name and accent (Settings › Brand), activity log | Built |
| **Sales (CRM)**: Today (what needs you, pipeline, win rate), Deals (board with drag to change stage, list), Companies, Contacts, a record panel with timeline, next step, stage change, GDPR export and delete-forever | Built, example data |
| Other modules (People, Marketing, Work, Insights, Strategy, Academy, Studio, Ledger, Harness) | Listed with what each builds on; People is next |
| Hosted database: `supabase/migrations/0001_sales.sql` (partners, tenants, memberships, row-level security per tenant, append-only audit log) | Written, not yet applied |

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
npm test         # domain tests
npm run build    # also writes dist/meridian-demo.html, the whole app in one file
```

## Next

- Sales: email sync and drafting with approval, import from CSV, owners and permissions, support inbox.
- People module v1: directory, onboarding checklists, leave, recruitment pipeline, reviews (HPT Index as the assessment).
- Hosting: apply the migration to a Supabase project in Frankfurt, add sign-in, deploy on Vercel.
