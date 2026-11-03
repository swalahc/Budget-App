let transactions = [];

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

const incomeCategories = [
    "Salary",
    "Freelance",
    "Other Income"
];


document.addEventListener("DOMContentLoaded", function () {

    const form = document.getElementById("transaction-form");
    const typeInput = document.getElementById("type");
    const categoryInput = document.getElementById("category");

    const today = new Date();
    const localDate =
        today.getFullYear() + "-" +
        String(today.getMonth() + 1).padStart(2, "0") + "-" +
        String(today.getDate()).padStart(2, "0");

    document.getElementById("date").value = localDate;

    updateCategoryOptions();
    loadTransactions();

    typeInput.addEventListener("change", updateCategoryOptions);

    form.addEventListener("submit", saveTransaction);

    document.getElementById("cancel-button")
        .addEventListener("click", resetForm);

    document.getElementById("apply-filters")
        .addEventListener("click", applyFilters);

    document.getElementById("clear-filters")
        .addEventListener("click", clearFilters);
});


function updateCategoryOptions(selectedCategory = "") {
    const type = document.getElementById("type").value;

    const categories =
        type === "income" ? incomeCategories : expenseCategories;

    const categoryInput = document.getElementById("category");

    categoryInput.innerHTML = "";

    categories.forEach(category => {
        const option = document.createElement("option");

        option.value = category;
        option.textContent = category;

        categoryInput.appendChild(option);
    });

    if (categories.includes(selectedCategory)) {
        categoryInput.value = selectedCategory;
    }
}


function formatCurrency(amount) {
    return Number(amount || 0).toLocaleString("en-CA", {
        style: "currency",
        currency: "CAD"
    });
}


async function loadTransactions() {
    try {
        const response = await fetch("/api/transactions");

        if (!response.ok) {
            throw new Error("Unable to load transactions.");
        }

        transactions = await response.json();

        displayTransactions(transactions);

    } catch (error) {
        console.error(error);

        document.getElementById("transaction-table").innerHTML =
            '<tr><td colspan="6">Unable to load transactions.</td></tr>';
    }
}


function displayTransactions(items) {
    const tableBody = document.getElementById("transaction-table");

    tableBody.innerHTML = "";

    if (!items || items.length === 0) {
        tableBody.innerHTML =
            '<tr><td colspan="6">No transactions found.</td></tr>';
        return;
    }

    items.forEach(transaction => {
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

        const actionsCell = document.createElement("td");

        const editButton = document.createElement("button");
        editButton.textContent = "Edit";
        editButton.type = "button";
        editButton.className = "edit-button";

        editButton.addEventListener("click", function () {
            editTransaction(transaction.id);
        });

        const deleteButton = document.createElement("button");
        deleteButton.textContent = "Delete";
        deleteButton.type = "button";
        deleteButton.className = "delete-button";

        deleteButton.addEventListener("click", function () {
            deleteTransaction(transaction.id);
        });

        actionsCell.appendChild(editButton);
        actionsCell.appendChild(deleteButton);

        row.appendChild(dateCell);
        row.appendChild(typeCell);
        row.appendChild(categoryCell);
        row.appendChild(descriptionCell);
        row.appendChild(amountCell);
        row.appendChild(actionsCell);

        tableBody.appendChild(row);
    });
}


async function saveTransaction(event) {
    event.preventDefault();

    const transactionId =
        document.getElementById("transaction-id").value;

    const transaction = {
        type: document.getElementById("type").value,
        amount: document.getElementById("amount").value,
        category: document.getElementById("category").value,
        date: document.getElementById("date").value,
        description: document.getElementById("description").value
    };

    const url = transactionId
        ? `/api/transactions/${transactionId}`
        : "/api/transactions";

    const method = transactionId ? "PUT" : "POST";

    try {
        const response = await fetch(url, {
            method: method,

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify(transaction)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || "Unable to save transaction.");
        }

        showMessage(result.message, "success");

        resetForm();
        await loadTransactions();

    } catch (error) {
        showMessage(error.message, "error");
    }
}


function editTransaction(id) {
    const transaction = transactions.find(item => item.id === id);

    if (!transaction) {
        return;
    }

    document.getElementById("transaction-id").value = transaction.id;
    document.getElementById("type").value = transaction.type;

    updateCategoryOptions(transaction.category);

    document.getElementById("amount").value = transaction.amount;
    document.getElementById("date").value = transaction.date;
    document.getElementById("description").value =
        transaction.description || "";

    document.getElementById("form-title").textContent =
        "Edit Transaction";

    document.getElementById("submit-button").textContent =
        "Update Transaction";

    document.getElementById("cancel-button").hidden = false;

    document.getElementById("transaction-form")
        .scrollIntoView({ behavior: "smooth" });
}


async function deleteTransaction(id) {
    const confirmed = confirm(
        "Are you sure you want to delete this transaction?"
    );

    if (!confirmed) {
        return;
    }

    try {
        const response = await fetch(`/api/transactions/${id}`, {
            method: "DELETE"
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || "Unable to delete transaction.");
        }

        showMessage(result.message, "success");

        await loadTransactions();

    } catch (error) {
        showMessage(error.message, "error");
    }
}


function resetForm() {
    document.getElementById("transaction-form").reset();

    document.getElementById("transaction-id").value = "";

    const today = new Date();
    const localDate =
        today.getFullYear() + "-" +
        String(today.getMonth() + 1).padStart(2, "0") + "-" +
        String(today.getDate()).padStart(2, "0");

    document.getElementById("date").value = localDate;

    document.getElementById("type").value = "expense";

    updateCategoryOptions();

    document.getElementById("form-title").textContent =
        "Add Transaction";

    document.getElementById("submit-button").textContent =
        "Add Transaction";

    document.getElementById("cancel-button").hidden = true;
}


function applyFilters() {
    const category =
        document.getElementById("filter-category").value;

    const startDate =
        document.getElementById("filter-start-date").value;

    const endDate =
        document.getElementById("filter-end-date").value;

    const filtered = transactions.filter(transaction => {

        const matchesCategory =
            !category || transaction.category === category;

        const matchesStartDate =
            !startDate || transaction.date >= startDate;

        const matchesEndDate =
            !endDate || transaction.date <= endDate;

        return matchesCategory && matchesStartDate && matchesEndDate;
    });

    displayTransactions(filtered);
}


function clearFilters() {
    document.getElementById("filter-category").value = "";
    document.getElementById("filter-start-date").value = "";
    document.getElementById("filter-end-date").value = "";

    displayTransactions(transactions);
}


function showMessage(message, type) {
    const messageElement =
        document.getElementById("transaction-message");

    messageElement.textContent = message;
    messageElement.className =
        type === "success" ? "success-message" : "error-message";
}