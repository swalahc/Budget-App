
document.addEventListener("DOMContentLoaded", loadDashboard);

async function loadDashboard() {
    try {
        const response = await fetch("/api/transactions");
        const transactions = await response.json();

        if (!response.ok) {
            throw new Error(transactions.error || "Could not load dashboard.");
        }

        let totalIncome = 0;
        let totalExpenses = 0;
        let monthlySpending = 0;

        const today = new Date();
        const currentMonth =
            `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

        transactions.forEach(transaction => {
            const amount = Number(transaction.amount);

            if (transaction.type === "income") {
                totalIncome += amount;
            } else {
                totalExpenses += amount;

                if (transaction.date.startsWith(currentMonth)) {
                    monthlySpending += amount;
                }
            }
        });

        document.getElementById("total-income").textContent = formatMoney(totalIncome);
        document.getElementById("total-expenses").textContent = formatMoney(totalExpenses);
        document.getElementById("balance").textContent =
            formatMoney(totalIncome - totalExpenses);
        document.getElementById("monthly-spending").textContent =
            formatMoney(monthlySpending);

        displayRecentTransactions(transactions.slice(0, 5));

    } catch (error) {
        console.error("Dashboard error:", error);

        document.getElementById("recent-transactions").innerHTML =
            '<tr><td colspan="5">Could not load dashboard information.</td></tr>';
    }
}

function displayRecentTransactions(transactions) {
    const table = document.getElementById("recent-transactions");
    table.replaceChildren();

    if (transactions.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 5;
        cell.textContent = "No transactions yet.";

        row.appendChild(cell);
        table.appendChild(row);
        return;
    }

    transactions.forEach(transaction => {
        const row = document.createElement("tr");

        const values = [
            transaction.date,
            transaction.description || "-",
            transaction.category,
            transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)
        ];

        values.forEach(value => {
            const cell = document.createElement("td");
            cell.textContent = value;
            row.appendChild(cell);
        });

        const amountCell = document.createElement("td");
        amountCell.textContent =
            `${transaction.type === "income" ? "+" : "-"}${formatMoney(transaction.amount)}`;
        amountCell.className = transaction.type;

        row.appendChild(amountCell);
        table.appendChild(row);
    });
}

function formatMoney(value) {
    return new Intl.NumberFormat("en-CA", {
        style: "currency",
        currency: "CAD"
    }).format(Number(value) || 0);
}
