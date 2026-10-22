
document.addEventListener("DOMContentLoaded", () => {
    const budgetForm = document.getElementById("budget-form");
    const budgetMonth = document.getElementById("budget-month");
    const viewMonth = document.getElementById("view-month");
    const budgetCategory = document.getElementById("budget-category");
    const budgetAmount = document.getElementById("budget-amount");
    const budgetTable = document.getElementById("budget-table");
    const budgetMessage = document.getElementById("budget-message");
    const submitButton = document.getElementById("budget-submit");

    function currentMonth() {
        const now = new Date();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        return `${now.getFullYear()}-${month}`;
    }

    const thisMonth = currentMonth();

    budgetMonth.value = thisMonth;
    viewMonth.value = thisMonth;

    // Load budgets when the page opens.
    loadBudgets();

    // Changing the view month reloads the table.
    viewMonth.addEventListener("change", loadBudgets);

    // Changing the budget month also changes the table month.
    budgetMonth.addEventListener("change", () => {
        if (budgetMonth.value) {
            viewMonth.value = budgetMonth.value;
            loadBudgets();
        }
    });

    // Save or update a budget.
    budgetForm.addEventListener("submit", saveBudget);

    async function loadBudgets() {
        const month = viewMonth.value;

        if (!month) {
            showTableMessage("Please select a month.");
            return;
        }

        showTableMessage("Loading budgets...");

        try {
            const response = await fetch(
                `/api/budgets?month=${encodeURIComponent(month)}`
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Could not load budgets.");
            }

            renderBudgets(result);
        } catch (error) {
            showTableMessage(error.message || "Could not load budgets.");
        }
    }

    function showTableMessage(message) {
        budgetTable.replaceChildren();

        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 5;
        cell.textContent = message;

        row.appendChild(cell);
        budgetTable.appendChild(row);
    }

    function renderBudgets(budgets) {
        budgetTable.replaceChildren();

        if (budgets.length === 0) {
            showTableMessage("No budgets created for this month yet.");
            return;
        }

        budgets.forEach((budget) => {
            const row = document.createElement("tr");

            const categoryCell = document.createElement("td");
            categoryCell.textContent = budget.category;

            const amountCell = document.createElement("td");
            amountCell.textContent = formatMoney(budget.amount);

            const spentCell = document.createElement("td");
            spentCell.textContent = formatMoney(budget.spent);

            const remainingCell = document.createElement("td");
            remainingCell.textContent = formatMoney(budget.remaining);

            if (Number(budget.remaining) < 0) {
                remainingCell.className = "budget-over";
            } else {
                remainingCell.className = "budget-safe";
            }

            const usedCell = document.createElement("td");
            const percentage = Number(budget.percentage);

            const percentageText = document.createElement("span");
            percentageText.textContent = `${percentage.toFixed(1)}%`;

            if (percentage >= 100) {
                percentageText.className = "budget-over";
            } else if (percentage >= 80) {
                percentageText.className = "budget-warning";
            } else {
                percentageText.className = "budget-safe";
            }

            const progress = document.createElement("progress");
            progress.max = 100;
            progress.value = Math.min(100, Math.max(0, percentage));
            progress.setAttribute(
                "aria-label",
                `${budget.category}: ${percentage.toFixed(1)} percent of budget used`
            );

            usedCell.append(percentageText, progress);

            row.append(
                categoryCell,
                amountCell,
                spentCell,
                remainingCell,
                usedCell
            );

            budgetTable.appendChild(row);
        });
    }

    function formatMoney(value) {
        const amount = Number(value);

        return new Intl.NumberFormat("en-CA", {
            style: "currency",
            currency: "CAD"
        }).format(Number.isFinite(amount) ? amount : 0);
    }

    async function saveBudget(event) {
        event.preventDefault();

        const category = budgetCategory.value;
        const month = budgetMonth.value;
        const amount = Number(budgetAmount.value);

        if (!month) {
            budgetMessage.textContent = "Please select a budget month.";
            return;
        }

        if (!Number.isFinite(amount) || amount <= 0) {
            budgetMessage.textContent = "Enter a budget amount greater than zero.";
            return;
        }

        submitButton.disabled = true;
        budgetMessage.textContent = "Saving budget...";

        try {
            const response = await fetch("/api/budgets", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    category,
                    month,
                    amount
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Could not save budget.");
            }

            budgetMessage.textContent = result.message || "Budget saved successfully.";
            budgetAmount.value = "";

            // Show the month that was just saved.
            viewMonth.value = month;
            await loadBudgets();
        } catch (error) {
            budgetMessage.textContent =
                error.message || "Could not connect to the server.";
        } finally {
            submitButton.disabled = false;
        }
    }
});
