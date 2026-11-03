let spendingChart = null;

document.addEventListener("DOMContentLoaded", function () {
    const monthInput = document.getElementById("dashboard-month");

    const today = new Date();
    const currentMonth =
        today.getFullYear() + "-" +
        String(today.getMonth() + 1).padStart(2, "0");

    monthInput.value = currentMonth;

    loadDashboard();

    monthInput.addEventListener("change", loadDashboard);
});


async function loadDashboard() {
    const month = document.getElementById("dashboard-month").value;

    if (!month) {
        return;
    }

    try {
        const response = await fetch(
            `/api/dashboard?month=${encodeURIComponent(month)}`
        );

        if (!response.ok) {
            throw new Error("Unable to load dashboard information.");
        }

        const data = await response.json();

        updateSummaryCards(data);
        updateSpendingChart(data.category_spending || []);
        displayBudgetAlerts(data.budget_alerts || []);
        displayRecentTransactions(data.recent_transactions || []);
        updateBudgetStatus(month);

    } catch (error) {
        console.error("Dashboard error:", error);

        document.getElementById("budget-alerts").innerHTML =
            '<p class="error-message">Unable to load dashboard information.</p>';

        document.getElementById("recent-transactions").innerHTML =
            '<tr><td colspan="5">Unable to load transactions.</td></tr>';
    }
}


async function updateBudgetStatus(month) {
    const container = document.getElementById("budget-status");

    try {
        const [budgetResponse, transactionResponse] = await Promise.all([
            fetch(`/api/budgets?month=${encodeURIComponent(month)}`),
            fetch("/api/transactions")
        ]);

        if (!budgetResponse.ok || !transactionResponse.ok) {
            throw new Error("Unable to load budget status.");
        }

        const budgets = await budgetResponse.json();
        const transactions = await transactionResponse.json();

        // Ignore stale responses if the month changed meanwhile.
        if (document.getElementById("dashboard-month").value !== month) return;

        SpendingInsights.renderBudget(
            container,
            SpendingInsights.calculate(transactions, budgets, month)
        );
    } catch (error) {
        container.textContent = "Budget status unavailable.";
    }
}


function formatCurrency(amount) {
    return Number(amount || 0).toLocaleString("en-CA", {
        style: "currency",
        currency: "CAD"
    });
}


function updateSummaryCards(data) {
    document.getElementById("total-income").textContent =
        formatCurrency(data.monthly_income);

    document.getElementById("total-expenses").textContent =
        formatCurrency(data.monthly_expenses);

    document.getElementById("balance").textContent =
        formatCurrency(data.monthly_balance);

    document.getElementById("monthly-spending").textContent =
        formatCurrency(data.monthly_expenses);
}


function updateSpendingChart(categorySpending) {
    const canvas = document.getElementById("spending-chart");
    const emptyMessage = document.getElementById("chart-empty-message");

    if (spendingChart) {
        spendingChart.destroy();
        spendingChart = null;
    }

    if (!categorySpending || categorySpending.length === 0) {
        canvas.hidden = true;
        emptyMessage.hidden = false;
        return;
    }

    canvas.hidden = false;
    emptyMessage.hidden = true;

    const labels = categorySpending.map(item => item.category);
    const amounts = categorySpending.map(item => item.amount);

    spendingChart = new Chart(canvas, {
        type: "doughnut",

        data: {
            labels: labels,

            datasets: [{
                label: "Expenses",
                data: amounts,
                borderWidth: 1
            }]
        },

        options: {
            responsive: true,
            maintainAspectRatio: false,

            plugins: {
                legend: {
                    position: "bottom"
                },

                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return context.label + ": " +
                                formatCurrency(context.raw);
                        }
                    }
                }
            }
        }
    });
}


function displayBudgetAlerts(alerts) {
    const container = document.getElementById("budget-alerts");

    if (!alerts || alerts.length === 0) {
        container.innerHTML =
            '<p class="budget-safe">All budgets are within their limits.</p>';
        return;
    }

    container.innerHTML = "";

    alerts.forEach(alert => {
        const alertElement = document.createElement("div");

        alertElement.className =
            alert.status === "over"
                ? "budget-alert budget-alert-over"
                : "budget-alert budget-alert-warning";

        const heading = document.createElement("strong");
        heading.textContent =
            alert.status === "over" ? "Over budget" : "Budget warning";

        const message = document.createElement("p");
        message.textContent = alert.message;

        const details = document.createElement("p");
        details.textContent =
            "Spent: " + formatCurrency(alert.spent) +
            " / Budget: " + formatCurrency(alert.budget) +
            " (" + alert.percentage + "%)";

        alertElement.appendChild(heading);
        alertElement.appendChild(message);
        alertElement.appendChild(details);

        container.appendChild(alertElement);
    });
}


function displayRecentTransactions(transactions) {
    const tableBody = document.getElementById("recent-transactions");

    tableBody.innerHTML = "";

    if (!transactions || transactions.length === 0) {
        tableBody.innerHTML =
            '<tr><td colspan="5">No transactions found.</td></tr>';
        return;
    }

    transactions.forEach(transaction => {
        const row = document.createElement("tr");

        const dateCell = document.createElement("td");
        dateCell.textContent = transaction.date;

        const typeCell = document.createElement("td");
        typeCell.textContent = transaction.type;

        const categoryCell = document.createElement("td");
        categoryCell.textContent = transaction.category;

        const descriptionCell = document.createElement("td");
        descriptionCell.textContent = transaction.description || "-";

        const amountCell = document.createElement("td");
        amountCell.textContent = formatCurrency(transaction.amount);

        amountCell.className =
            transaction.type === "income" ? "income" : "expense";

        row.appendChild(dateCell);
        row.appendChild(typeCell);
        row.appendChild(categoryCell);
        row.appendChild(descriptionCell);
        row.appendChild(amountCell);

        tableBody.appendChild(row);
    });
}