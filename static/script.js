let transactions = [];

// PB5 Transaction Categories enhancement by Ahmad Kanaan
const incomeCategories = [
    "Salary",
    "Freelance",
    "Other Income"
];

// PB5 Transaction Categories enhancement by Ahmad Kanaan
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
// PB5 Transaction Categories enhancement by Ahmad Kanaan
function updateCategoryOptions() {

    const typeSelect =
        document.getElementById("type");

    const categorySelect =
        document.getElementById("category");

    const selectedType =
        typeSelect.value;

    const categories =
        selectedType === "income"
            ? incomeCategories
            : expenseCategories;

    categorySelect.innerHTML = "";

    categories.forEach(category => {

        const option =
            document.createElement("option");

        option.value = category;
        option.textContent = category;

        categorySelect.appendChild(option);

    });

}

// ----------------------------------
// PAGE LOAD
// ----------------------------------

document.addEventListener("DOMContentLoaded", function () {

    // PB5 Transaction Categories enhancement by Ahmad Kanaan
    document
        .getElementById("type")
        .addEventListener(
            "change",
            updateCategoryOptions
        );

    // PB5 Transaction Categories enhancement by Ahmad Kanaan
    updateCategoryOptions();

    loadTransactions();

    // Set today's date automatically
    document.getElementById("date").value =
        localDateString();


    document
        .getElementById("transaction-form")
        .addEventListener("submit", handleTransactionSubmit);


    document
        .getElementById("cancel-button")
        .addEventListener("click", cancelEdit);

    // Sprint 2 transaction filtering by Ahmad Kanaan
    document
        .getElementById("apply-filters")
        .addEventListener("click", applyTransactionFilters);

    // Sprint 2 transaction filtering by Ahmad Kanaan
    document
        .getElementById("clear-filters")
        .addEventListener("click", clearTransactionFilters);

});


// ----------------------------------
// LOAD TRANSACTIONS
// ----------------------------------

async function loadTransactions() {

    try {

        const response =
            await fetch("/api/transactions");

        if (!response.ok) {
            return;
        }

        transactions =
            await response.json();

        applyTransactionFilters();

        updateSummary();

    } catch (error) {

        console.error(
            "Error loading transactions:",
            error
        );

    }
}


// ----------------------------------
// DISPLAY TRANSACTIONS
// ----------------------------------

function displayTransactions(visibleTransactions = transactions) {

    const table =
        document.getElementById(
            "transaction-table"
        );

    table.innerHTML = "";


    if (visibleTransactions.length === 0) {

        table.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center;">
                    No transactions yet.
                </td>
            </tr>
        `;

        return;
    }


    visibleTransactions.forEach(transaction => {

        const row =
            document.createElement("tr");


        const amount =
            Number(transaction.amount).toFixed(2);


        const amountDisplay =
            transaction.type === "income"
                ? `+$${amount}`
                : `-$${amount}`;


        const typeClass =
            transaction.type === "income"
                ? "income"
                : "expense";


        row.innerHTML = `

            <td>
                ${transaction.date}
            </td>

            <td>
                ${transaction.description || "-"}
            </td>

            <td>
                ${transaction.category}
            </td>

            <td class="${typeClass}">
                ${capitalize(transaction.type)}
            </td>

            <td class="${typeClass}">
                ${amountDisplay}
            </td>

            <td>

                <button
                    class="edit-button"
                    onclick="editTransaction(${transaction.id})"
                >
                    Edit
                </button>

                <button
                    class="delete-button"
                    onclick="deleteTransaction(${transaction.id})"
                >
                    Delete
                </button>

            </td>

        `;


        table.appendChild(row);

    });

}


// ----------------------------------
// UPDATE SUMMARY
// ----------------------------------

function updateSummary() {

    let totalIncome = 0;

    let totalExpenses = 0;
    // Sprint 2 spending calculation by Ahmad Kanaan
    let monthlySpending = 0;

    // Use the browser's local month, matching the date input.
    const currentMonth = localDateString().slice(0, 7);

    transactions.forEach(transaction => {
        const amount = Number(transaction.amount);

        if (transaction.type === "income") {
            totalIncome += amount;
        } else {
            totalExpenses += amount;

            // Sprint 2 spending calculation by Ahmad Kanaan
            if (transaction.date.startsWith(currentMonth)) {
                monthlySpending += amount;
            }
        }
    });

    const balance =
        totalIncome - totalExpenses;


    document.getElementById(
        "total-income"
    ).textContent =
        `$${totalIncome.toFixed(2)}`;


    document.getElementById(
        "total-expenses"
    ).textContent =
        `$${totalExpenses.toFixed(2)}`;


    document.getElementById(
        "balance"
    ).textContent =
        `$${balance.toFixed(2)}`;
    // Sprint 2 spending calculation by Ahmad Kanaan
    document.getElementById(
        "monthly-spending"
    ).textContent =
        `$${monthlySpending.toFixed(2)}`;

}


// ----------------------------------
// ADD / EDIT TRANSACTION
// ----------------------------------

async function handleTransactionSubmit(event) {

    event.preventDefault();


    const transactionId =
        document.getElementById(
            "transaction-id"
        ).value;


    const transactionData = {

        type:
            document.getElementById(
                "type"
            ).value,

        amount:
            document.getElementById(
                "amount"
            ).value,

        category:
            document.getElementById(
                "category"
            ).value,

        description:
            document.getElementById(
                "description"
            ).value,

        date:
            document.getElementById(
                "date"
            ).value

    };


    try {

        let response;


        if (transactionId) {

            // EDIT

            response =
                await fetch(
                    `/api/transactions/${transactionId}`,
                    {
                        method: "PUT",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body:
                            JSON.stringify(
                                transactionData
                            )
                    }
                );

        } else {

            // ADD

            response =
                await fetch(
                    "/api/transactions",
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body:
                            JSON.stringify(
                                transactionData
                            )
                    }
                );

        }


        const result =
            await response.json();


        if (!response.ok) {

            alert(
                result.error ||
                "Something went wrong."
            );

            return;
        }


        resetForm();

        await loadTransactions();


    } catch (error) {

        console.error(error);

        alert(
            "Could not connect to the server."
        );

    }

}


// ----------------------------------
// EDIT TRANSACTION
// ----------------------------------

function editTransaction(id) {

    const transaction =
        transactions.find(
            item => item.id === id
        );


    if (!transaction) {
        return;
    }


    document.getElementById(
        "transaction-id"
    ).value =
        transaction.id;


    document.getElementById(
        "type"
    ).value =
        transaction.type;
    // PB5 Transaction Categories enhancement by Ahmad Kanaan
    updateCategoryOptions();

    document.getElementById(
        "amount"
    ).value =
        transaction.amount;


    document.getElementById(
        "category"
    ).value =
        transaction.category;


    document.getElementById(
        "description"
    ).value =
        transaction.description || "";


    document.getElementById(
        "date"
    ).value =
        transaction.date;


    document.getElementById(
        "form-title"
    ).textContent =
        "Edit Transaction";


    document.getElementById(
        "submit-button"
    ).textContent =
        "Update Transaction";


    document.getElementById(
        "cancel-button"
    ).style.display =
        "inline-block";


    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

}


// ----------------------------------
// DELETE TRANSACTION
// ----------------------------------

async function deleteTransaction(id) {

    const confirmed =
        confirm(
            "Are you sure you want to delete this transaction?"
        );


    if (!confirmed) {
        return;
    }


    try {

        const response =
            await fetch(
                `/api/transactions/${id}`,
                {
                    method: "DELETE"
                }
            );


        const result =
            await response.json();


        if (!response.ok) {

            alert(
                result.error ||
                "Could not delete transaction."
            );

            return;
        }


        await loadTransactions();


    } catch (error) {

        console.error(error);

        alert(
            "Could not connect to the server."
        );

    }

}
// ----------------------------------
// SPRINT 2 TRANSACTION FILTERS
// Ahmad Kanaan
// ----------------------------------

function applyTransactionFilters() {

    const selectedCategory =
        document.getElementById(
            "filter-category"
        ).value;

    const startDate =
        document.getElementById(
            "filter-start-date"
        ).value;

    const endDate =
        document.getElementById(
            "filter-end-date"
        ).value;


    const filteredTransactions =
        transactions.filter(transaction => {

            const matchesCategory =
                selectedCategory === "" ||
                transaction.category === selectedCategory;

            const matchesStartDate =
                startDate === "" ||
                transaction.date >= startDate;

            const matchesEndDate =
                endDate === "" ||
                transaction.date <= endDate;


            return (
                matchesCategory &&
                matchesStartDate &&
                matchesEndDate
            );

        });


    displayTransactions(filteredTransactions);

}


function clearTransactionFilters() {

    document.getElementById(
        "filter-category"
    ).value = "";

    document.getElementById(
        "filter-start-date"
    ).value = "";

    document.getElementById(
        "filter-end-date"
    ).value = "";


    displayTransactions();

}

// ----------------------------------
// CANCEL EDIT
// ----------------------------------

function cancelEdit() {

    resetForm();

}


// ----------------------------------
// RESET FORM
// ----------------------------------

function resetForm() {

    document
        .getElementById(
            "transaction-form"
        )
        .reset();


    document.getElementById(
        "transaction-id"
    ).value = "";


    document.getElementById(
        "form-title"
    ).textContent =
        "Add Transaction";


    document.getElementById(
        "submit-button"
    ).textContent =
        "Add Transaction";


    document.getElementById(
        "cancel-button"
    ).style.display =
        "none";


    document.getElementById(
        "date"
    ).value =
        localDateString();
    // PB5 Transaction Categories enhancement by Ahmad Kanaan
    updateCategoryOptions();
}


// ----------------------------------
// CAPITALIZE TEXT
// ----------------------------------

function capitalize(text) {

    return text.charAt(0).toUpperCase()
        + text.slice(1);

}

// Keep dates and monthly spending in the user's local calendar day.
function localDateString() {
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${today.getFullYear()}-${month}-${day}`;
}


/* -----------------------------
   MONTHLY BUDGETS
----------------------------- */

function getCurrentMonth() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");

    return `${year}-${month}`;
}


document.addEventListener("DOMContentLoaded", function () {
    const budgetMonth = document.getElementById("budget-month");
    const budgetForm = document.getElementById("budget-form");

    if (!budgetMonth || !budgetForm) return;

    budgetMonth.value = getCurrentMonth();

    loadBudgets();

    budgetMonth.addEventListener("change", loadBudgets);

    budgetForm.addEventListener("submit", saveBudget);
});


async function loadBudgets() {
    const month = document.getElementById("budget-month").value;
    const budgetList = document.getElementById("budget-list");

    if (!month) {
        budgetList.textContent = "Please select a month.";
        return;
    }

    budgetList.textContent = "Loading budgets...";

    try {
        const response = await fetch(
            `/api/budgets?month=${encodeURIComponent(month)}`
        );

        const budgets = await response.json();

        if (!response.ok) {
            throw new Error(budgets.error || "Could not load budgets.");
        }

        renderBudgets(budgets);

    } catch (error) {
        budgetList.textContent = error.message;
    }
}


function renderBudgets(budgets) {
    const budgetList = document.getElementById("budget-list");
    budgetList.replaceChildren();

    if (budgets.length === 0) {
        const message = document.createElement("p");
        message.textContent = "No budgets created for this month yet.";
        budgetList.appendChild(message);
        return;
    }

    budgets.forEach(budget => {
        const card = document.createElement("div");
        card.className = "budget-card";

        const title = document.createElement("h3");
        title.textContent = budget.category;

        const details = document.createElement("p");
        details.textContent =
            `$${Number(budget.spent).toFixed(2)} spent of ` +
            `$${Number(budget.amount).toFixed(2)}`;

        const remaining = document.createElement("p");
        remaining.textContent =
            `Remaining: $${Number(budget.remaining).toFixed(2)}`;

        const progress = document.createElement("progress");
        progress.max = 100;
        progress.value = Math.min(
            100,
            Math.max(0, Number(budget.percentage))
        );
        progress.setAttribute(
            "aria-label",
            `${budget.category} budget used`
        );

        const percentage = document.createElement("p");
        percentage.textContent =
            `${Number(budget.percentage).toFixed(1)}% used`;

        if (budget.percentage >= 100) {
            percentage.className = "budget-over";
        } else if (budget.percentage >= 80) {
            percentage.className = "budget-warning";
        } else {
            percentage.className = "budget-safe";
        }

        card.append(
            title,
            details,
            progress,
            percentage,
            remaining
        );

        budgetList.appendChild(card);
    });
}


async function saveBudget(event) {
    event.preventDefault();

    const category = document.getElementById("budget-category").value;
    const month = document.getElementById("budget-month").value;
    const amount = document.getElementById("budget-amount").value;
    const message = document.getElementById("budget-message");
    const submitButton = document.getElementById("budget-submit");

    if (!month || !amount || Number(amount) <= 0) {
        message.textContent = "Enter a month and a valid positive budget.";
        return;
    }

    submitButton.disabled = true;
    message.textContent = "Saving budget...";

    try {
        const response = await fetch("/api/budgets", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                category: category,
                month: month,
                amount: amount
            })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || "Could not save budget.");
        }

        message.textContent = result.message;
        document.getElementById("budget-amount").value = "";

        await loadBudgets();

    } catch (error) {
        message.textContent = error.message;
    } finally {
        submitButton.disabled = false;
    }
}

