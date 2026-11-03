
let transactions = [];

const incomeCategories = [
    "Salary",
    "Freelance",
    "Other Income"
];

const expenseCategories = [
    "Food",
    "Transportation",
    "Bills",
    "Entertainment",
    "Shopping",
    "Education",
    "Health",
    "Other"
];

document.addEventListener("DOMContentLoaded", () => {
    const typeSelect = document.getElementById("type");
    const transactionForm = document.getElementById("transaction-form");

    typeSelect.addEventListener("change", updateCategoryOptions);
    transactionForm.addEventListener("submit", handleTransactionSubmit);

    document.getElementById("cancel-button")
        .addEventListener("click", cancelEdit);

    document.getElementById("apply-filters")
        .addEventListener("click", applyTransactionFilters);

    document.getElementById("clear-filters")
        .addEventListener("click", clearTransactionFilters);

    document.getElementById("refresh-transactions")
        .addEventListener("click", loadTransactions);

    updateCategoryOptions();

    document.getElementById("date").value = localDateString();

    loadTransactions();
});

function localDateString() {
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");

    return `${today.getFullYear()}-${month}-${day}`;
}

function updateCategoryOptions() {
    const type = document.getElementById("type").value;
    const categorySelect = document.getElementById("category");

    const categories = type === "income"
        ? incomeCategories
        : expenseCategories;

    categorySelect.replaceChildren();

    categories.forEach(category => {
        const option = document.createElement("option");
        option.value = category;
        option.textContent = category;
        categorySelect.appendChild(option);
    });
}

async function loadTransactions() {
    const table = document.getElementById("transaction-table");
    table.innerHTML = '<tr><td colspan="6">Loading transactions...</td></tr>';

    try {
        const response = await fetch("/api/transactions");
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || "Could not load transactions.");
        }

        transactions = result;
        displayTransactions();

    } catch (error) {
        table.innerHTML = "";
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = 6;
        cell.textContent = error.message;
        row.appendChild(cell);
        table.appendChild(row);
    }
}

function displayTransactions(list = transactions) {
    const table = document.getElementById("transaction-table");
    table.replaceChildren();

    if (list.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 6;
        cell.textContent = "No transactions found.";

        row.appendChild(cell);
        table.appendChild(row);
        return;
    }

    list.forEach(transaction => {
        const row = document.createElement("tr");

        const values = [
            transaction.date,
            transaction.description || "-",
            transaction.category,
            capitalize(transaction.type)
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

        const actionsCell = document.createElement("td");

        const editButton = document.createElement("button");
        editButton.textContent = "Edit";
        editButton.className = "edit-button";
        editButton.addEventListener("click", () => editTransaction(transaction.id));

        const deleteButton = document.createElement("button");
        deleteButton.textContent = "Delete";
        deleteButton.className = "delete-button";
        deleteButton.addEventListener("click", () => deleteTransaction(transaction.id));

        actionsCell.append(editButton, deleteButton);
        row.appendChild(actionsCell);

        table.appendChild(row);
    });
}

function applyTransactionFilters() {
    const category = document.getElementById("filter-category").value;
    const startDate = document.getElementById("filter-start-date").value;
    const endDate = document.getElementById("filter-end-date").value;

    if (startDate && endDate && startDate > endDate) {
        showMessage("Start date cannot be after end date.");
        return;
    }

    const filtered = transactions.filter(transaction => {
        const matchesCategory = !category || transaction.category === category;
        const matchesStart = !startDate || transaction.date >= startDate;
        const matchesEnd = !endDate || transaction.date <= endDate;

        return matchesCategory && matchesStart && matchesEnd;
    });

    displayTransactions(filtered);
}

function clearTransactionFilters() {
    document.getElementById("filter-category").value = "";
    document.getElementById("filter-start-date").value = "";
    document.getElementById("filter-end-date").value = "";

    displayTransactions();
    showMessage("");
}

async function handleTransactionSubmit(event) {
    event.preventDefault();

    const transactionId = document.getElementById("transaction-id").value;

    const data = {
        type: document.getElementById("type").value,
        amount: document.getElementById("amount").value,
        category: document.getElementById("category").value,
        description: document.getElementById("description").value,
        date: document.getElementById("date").value
    };

    const submitButton = document.getElementById("submit-button");
    submitButton.disabled = true;

    try {
        const response = await fetch(
            transactionId
                ? `/api/transactions/${transactionId}`
                : "/api/transactions",
            {
                method: transactionId ? "PUT" : "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(data)
            }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || "Could not save transaction.");
        }

        showMessage(result.message);
        resetForm();
        await loadTransactions();

    } catch (error) {
        showMessage(error.message);
    } finally {
        submitButton.disabled = false;
    }
}

function editTransaction(id) {
    const transaction = transactions.find(item => item.id === id);

    if (!transaction) return;

    document.getElementById("transaction-id").value = transaction.id;
    document.getElementById("type").value = transaction.type;

    updateCategoryOptions();

    document.getElementById("amount").value = transaction.amount;
    document.getElementById("category").value = transaction.category;
    document.getElementById("description").value = transaction.description || "";
    document.getElementById("date").value = transaction.date;

    document.getElementById("form-title").textContent = "Edit Transaction";
    document.getElementById("submit-button").textContent = "Update Transaction";
    document.getElementById("cancel-button").hidden = false;

    window.scrollTo({ top: 0, behavior: "smooth" });
}

async function deleteTransaction(id) {
    if (!confirm("Are you sure you want to delete this transaction?")) {
        return;
    }

    try {
        const response = await fetch(`/api/transactions/${id}`, {
            method: "DELETE"
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || "Could not delete transaction.");
        }

        showMessage(result.message);
        await loadTransactions();

    } catch (error) {
        showMessage(error.message);
    }
}

function cancelEdit() {
    resetForm();
    showMessage("");
}

function resetForm() {
    document.getElementById("transaction-form").reset();
    document.getElementById("transaction-id").value = "";

    document.getElementById("form-title").textContent = "Add Transaction";
    document.getElementById("submit-button").textContent = "Add Transaction";
    document.getElementById("cancel-button").hidden = true;

    document.getElementById("date").value = localDateString();

    updateCategoryOptions();
}

function showMessage(message) {
    document.getElementById("transaction-message").textContent = message;
}

function formatMoney(value) {
    return new Intl.NumberFormat("en-CA", {
        style: "currency",
        currency: "CAD"
    }).format(Number(value) || 0);
}

function capitalize(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
}
