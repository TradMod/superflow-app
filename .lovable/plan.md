# SuperFlow Money — budget & cash-flow module

Adds a full money-management side to SuperFlow without touching any existing habits, tasks, goals, events, or review functionality.

## Navigation: Life mode / Money mode

The app shell gets a mode switch at the top of the sidebar (and in the mobile header):

```text
[ Life ]  [ Money ]
```

- Life mode keeps today's nav exactly as it is: Today, Plan, Calendar, Goals, Review, Insights, Settings.
- Money mode swaps the nav for: Overview, Transactions, Budget, Accounts, Debts, Subscriptions, Money Review.
- Mobile bottom bar mirrors this: Money mode shows Overview, Transactions, Budget, Debts + "More" (Accounts, Subscriptions, Money Review, Settings).
- The chosen mode is remembered, so reopening the app lands where you left off. Settings stays shared between modes.

## Screens

**Overview** — total net worth converted to your base currency, per-account balances, this month's inflow vs outflow, budget progress ring, upcoming subscription charges, outstanding loans, and a spend-by-category donut.

**Accounts** — create accounts (e.g. "USD Wise", "PKR Bank", "Cash PKR") with name, type (bank / cash / wallet / card), currency, opening balance, and colour. Balance is always derived from opening balance + transactions, so it can't drift. Archive instead of delete when transactions exist.

**Transactions** — the workhorse list, filterable by month, account, category, and type. Add income, expense, or transfer (transfer moves between two accounts, with cross-currency support). Each entry has amount, currency, account, category, date, note, and optional link to a subscription or debt. Inline edit and delete. Quick-add button available from every money screen.

**Budget** — one overall monthly cap plus optional per-category limits. Progress bars turn amber near the limit and red past it. Budgets carry forward month to month unless you change them; you can edit any past or future month.

**Debts** — track money you lent out and money you borrowed: counterparty, amount, currency, date, expected return date, notes. Record partial repayments; each repayment can optionally create a matching transaction so account balances stay accurate. Shows totals owed to you and by you.

**Subscriptions** — name, amount, currency, cycle (monthly / quarterly / yearly), next charge date, account, category, active toggle. Shows normalised monthly cost, annual total, and the next 30 days of charges. Marking one as paid logs an expense and rolls the next date forward.

**Money Review** — its own AI review with day / week / month switcher, separate from the habits Review tab. The coach keeps the same brutally-honest accountability voice, reading your actual numbers: budget adherence, category overspend, income vs spend, subscription creep, unpaid loans, and your transaction notes. Summaries are saved per period so you can revisit them.

## Currencies

You pick a base currency in Settings (e.g. PKR). Exchange rates are fetched daily from a free public rates API through the server and cached in the database, with the last fetched rate reused if the service is unavailable. Every transaction stores both its original amount/currency and the converted base-currency amount at the time it was recorded, so historical reports don't shift when rates move. A manual rate override is available per currency as a fallback.

## Technical notes

- New tables (all user-scoped with RLS + grants): `money_accounts`, `money_categories`, `transactions`, `budgets`, `budget_categories`, `debts`, `debt_payments`, `subscriptions`, `money_reviews`, `fx_rates`.
- Amounts stored as `numeric(18,2)` with currency code, plus `base_amount` and `fx_rate` captured on write.
- New routes under `src/routes/_authenticated/money/*` — existing route files are untouched.
- Balances and rollups computed in a new `src/lib/money.ts`, mirroring how `dayflow.ts` works; query options added to `src/lib/queries.ts` alongside the existing ones.
- AI review via a new `src/lib/money-review.functions.ts` server function using the same Lovable AI gateway and coach persona as `review.functions.ts`; the existing review function is left as-is.
- Rate fetching happens in a server function that writes into `fx_rates`; no keys required for the chosen public rates source.
- `AppShell` gains a `mode` prop and a nav map per mode; all current pages continue passing the same props they do today.

## Build order

1. Database migration for all money tables.
2. Mode switch in `AppShell` + money route scaffolding.
3. Accounts, then Transactions (with transfers and FX capture).
4. Budget, Debts, Subscriptions.
5. Overview dashboard.
6. Money AI review.
7. Theme polish so both Midnight and Mauve Ink look right in Money mode.
