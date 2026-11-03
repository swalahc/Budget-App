// Sprint 3 PB12/PB13 — Ahmad Kanaan / Member 3.
// Existing category budgets sum to the overall monthly budget. No new budget store.
const SpendingInsights = (() => {
    const NEAR_BUDGET_PERCENT = 80;
    const cents = value => Math.round(Number(value) * 100);
    const money = value => new Intl.NumberFormat("en-CA", {
        style: "currency", currency: "CAD"
    }).format(value);

    function status(spent, limit) {
        if (spent > limit) return "over";
        if (spent === limit) return "at-limit";
        if (spent * 100 >= limit * NEAR_BUDGET_PERCENT) return "near";
        return "safe";
    }

    function calculate(transactions, budgets, month) {
        const totals = new Map();
        for (const transaction of transactions) {
            if (transaction.type !== "expense" || !transaction.date.startsWith(month + "-")) continue;
            totals.set(transaction.category,
                (totals.get(transaction.category) || 0) + cents(transaction.amount));
        }
        const categories = [...totals].map(([category, spent]) => ({category, spent}))
            .sort((a, b) => b.spent - a.spent || a.category.localeCompare(b.category));
        const spent = categories.reduce((sum, item) => sum + item.spent, 0);
        const limits = budgets.filter(budget => budget.month === month).map(budget => {
            const limit = cents(budget.amount);
            const used = totals.get(budget.category) || 0;
            return {category: budget.category, limit, spent: used,
                remaining: limit - used, status: status(used, limit)};
        });
        const limit = limits.reduce((sum, item) => sum + item.limit, 0);
        return {month, categories, spent, limits, limit,
            remaining: limit ? limit - spent : null,
            status: limit ? status(spent, limit) : "unset"};
    }

    function statusText(item) {
        const used = money(item.spent / 100);
        const limit = money(item.limit / 100);
        const percentage = (item.spent / item.limit * 100).toFixed(1);
        const detail = `${used} of ${limit} used (${percentage}%).`;
        if (item.status === "over") return `Over budget by ${money(-item.remaining / 100)}. ${detail}`;
        if (item.status === "at-limit") return `Budget limit reached. ${detail}`;
        if (item.status === "near") return `Approaching budget limit. ${detail}`;
        return `Within budget. ${detail}`;
    }

    function renderBudget(container, summary) {
        container.replaceChildren();
        const month = document.createElement("p");
        month.className = "muted-text";
        month.textContent = `Budget month: ${summary.month}. Monthly budget is the sum of your category limits; spending includes all expense categories.`;
        container.append(month);
        if (summary.status === "unset") {
            const empty = document.createElement("p");
            empty.textContent = "No budget set for this month. Set category limits on Monthly Budgets to see warnings and remaining budget.";
            container.append(empty);
            return;
        }
        const remaining = document.createElement("p");
        remaining.className = "remaining-budget";
        remaining.textContent = `Remaining Budget: ${money(summary.remaining / 100)}`;
        container.append(remaining);
        for (const item of [{...summary, category: "Overall monthly budget"}, ...summary.limits]) {
            const message = document.createElement("p");
            message.className = `budget-notice budget-notice-${item.status}`;
            message.textContent = `${item.category}: ${statusText(item)}`;
            container.append(message);
        }
    }

    function renderChart(container, summary) {
        container.replaceChildren();
        if (!summary.categories.length) {
            container.textContent = "No expense transactions for this month yet.";
            return;
        }
        const list = document.createElement("ul");
        list.className = "spending-bars";
        for (const item of summary.categories) {
            const row = document.createElement("li");
            const label = document.createElement("div");
            const percentage = item.spent / summary.spent * 100;
            label.textContent = `${item.category}: ${money(item.spent / 100)} (${percentage.toFixed(1)}%)`;
            const track = document.createElement("div");
            track.className = "spending-track";
            track.setAttribute("aria-hidden", "true");
            const bar = document.createElement("div");
            bar.className = "spending-bar";
            bar.style.width = `${percentage}%`;
            track.append(bar);
            row.append(label, track);
            list.append(row);
        }
        container.append(list);
    }

    return {NEAR_BUDGET_PERCENT, calculate, statusText, renderBudget, renderChart};
})();

// Dependency-free regression tests can import the same calculations used by the UI.
if (typeof module !== "undefined") module.exports = SpendingInsights;
