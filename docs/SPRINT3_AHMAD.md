# Sprint 3 — Ahmad Kanaan / Member 3

## Base and team integration

Started from fetched `origin/main` at `6b52134` (`budget has its own tab`), after fast-forwarding local main. Ahmad's Sprint 2 work is merged through PR #2. The remote exposes no separate Derek category-limit branch; the implementation preserves the category budgets/limits already on main. Unavailable/unmerged work cannot be verified.

The existing `budgets` table stores one amount per user, expense category, and month. The existing `/api/budgets` API and budget form remain unchanged. No database migration, alternative budget system, backend route, library, or CDN was added.

## PB12 — Spending by category

- Native HTML/CSS horizontal bars on the dashboard, labelled with category, amount, and percentage of monthly expense spending.
- Uses actual authenticated `/api/transactions` data, expense transactions only, in the browser's current local calendar month.
- Aggregates repeated categories and sorts largest spending first; a readable empty state appears when there are no expenses.
- Uses the full current month, independently of transaction-history filters (stated beside the chart).
- Updates after add, edit, delete, Refresh, page load, and returning focus to the dashboard.
- Text labels expose the same information without relying on color or visual bars.

## PB13 — Budget alerts and remaining budget

The merged team implementation has category budgets, not a separately stored overall monthly budget. **Overall monthly budget is defined here as the sum of that month's existing category limits.** The UI explicitly explains this interpretation.

`Remaining Budget = sum(month's category limits) - all month expense spending`

All monthly expenses count toward the overall budget, even when their category has no limit. Category warnings use only the corresponding category's spending and existing limit. Without any budget, the UI displays “No budget set,” rather than inventing a zero budget or remaining amount.

Status decisions use integer cents:

| Used | State |
|---|---|
| Below 80% | Within budget |
| 80% to below 100% | Approaching budget limit |
| Exactly 100% | Budget limit reached |
| Above 100% | Over budget, including the amount exceeded |

80% is an implementation choice, consistent with the team's existing budget progress colors. No supplied course specification defines another threshold. Percentage labels round to one decimal; status decisions use exact cents, not rounded percentages.

Shared calculations and rendering in `static/spending-insights.js` support both the dashboard and existing Monthly Budgets page. The budget page follows its existing selected month and reloads after budget saves. Page focus and restored browser history refresh values changed elsewhere. Older overlapping requests cannot overwrite a newer selected month/result. These are in-page messages, not emails, operating-system notifications, or a live push service.

## Files

- `static/spending-insights.js`: shared expense grouping, cents arithmetic, budget statuses, chart and alert rendering.
- `static/script.js`: hooks into existing transaction reloads; current-month budget retrieval and refresh/error handling.
- `static/budgets.js`: selected-month status integration after the existing budget load/save flow.
- `static/style.css`: chart bars and textual status styles.
- `templates/dashboard.html`: chart and budget-status sections; shared script.
- `templates/budgets.html`: budget-status area; shared script.
- `tests/spending-insights.test.cjs`: dependency-free calculation regression tests.
- `tests/test_budget_integration.py`: existing Flask API regression tests using temporary databases.
- `docs/SPRINT3_AHMAD.md`: implementation choices and verification instructions.

## Automated verification

From the repository root:

```sh
node --test tests/spending-insights.test.cjs
venv/bin/python -B -m unittest discover -s tests -p 'test_*.py'
node --check static/spending-insights.js
node --check static/script.js
node --check static/budgets.js
git diff --cached --check
```

On November 2, 2026: 10 JavaScript tests and 2 Flask integration tests passed. Coverage includes category aggregation, income/other-month exclusion, exact 79.99%/80%/99.99%/100%/100.01% thresholds, unbudgeted-category spending, expense/type/date edits and deletion, budget changes, no-budget/empty states, decimals, registration/login/logout, transaction CRUD, budget upsert/month isolation, validation, and user isolation.

## Local browser verification

Flask ran on `127.0.0.1:5056` with a separate test database outside this repository. The repository's original local database was preserved byte-for-byte. All listed checks passed:

1. Register, log in, and log out with a disposable test account.
2. Add $1,000 Salary income: no expense chart contribution.
3. Add $30 Food and $20 Bills in November; add $400 Food in October. Monthly spending = $50; chart = Food 60%, Bills 40%; total expenses = $450.
4. Verify dynamic income categories, expense categories, and form reset after saving.
5. Category-only, start-only, end-only, combined inclusive date/category filters, and Clear Filters. Chart stays scoped to the full month. Filter survives editing.
6. Create Food $60 and Bills $40 budgets using the existing form. Overall budget = $100; remaining = $50; existing table/progress values still work. With only Food's limit set, Bills spending still counts toward the overall warning.
7. Edit Food spending to $60: chart changes; monthly spending = $80; overall warning at exactly 80%; Food at its limit.
8. Add $20 Bills: overall spending exactly $100, limit reached.
9. Add $1 Bills: overall and Bills over-budget messages; remaining = -$1.
10. Delete the $1 transaction: chart changes to Food 60% / Bills 40%; overall returns to limit reached. The user confirmed the browser dialog after automation could not safely address it.
11. Update Food budget to $80: overall budget = $120, remaining = $20, status = near (83.3%). Update it to $75: Food category warning appears at exactly 80%.
12. Change viewed budget month to October: no-budget state clears November alerts; switching back restores November values.
13. Edit Food expense into Freelance income: its bar disappears and monthly spending becomes $40; change it back to expense: bar and totals return.
14. Reload: saved transactions/budgets and chart persist. Inspect narrow-layout screenshot: readable bars and notices.
15. Browser console: no JavaScript warnings/errors. Flask: no exceptions or failing application requests; only the pre-existing missing `/favicon.ico` request returned 404.

## Git safety

`database.db` was already modified before work began and is tracked by the repository. It remains unstaged and byte-identical to its original local contents. A named database-only Git stash is retained as an additional backup. No venv files or test database are included. Only the nine source, test, and documentation files above should be staged. Avoid `git add .` and `git commit -a`.
