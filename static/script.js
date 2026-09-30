let transactions = [];


// ----------------------------------
// PAGE LOAD
// ----------------------------------

document.addEventListener("DOMContentLoaded", function () {

    loadTransactions();

    // Set today's date automatically
    document.getElementById("date").value =
        new Date().toISOString().split("T")[0];


    document
        .getElementById("transaction-form")
        .addEventListener("submit", handleTransactionSubmit);


    document
        .getElementById("cancel-button")
        .addEventListener("click", cancelEdit);

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

        displayTransactions();

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

function displayTransactions() {

    const table =
        document.getElementById(
            "transaction-table"
        );

    table.innerHTML = "";


    if (transactions.length === 0) {

        table.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center;">
                    No transactions yet.
                </td>
            </tr>
        `;

        return;
    }


    transactions.forEach(transaction => {

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


    transactions.forEach(transaction => {

        const amount =
            Number(transaction.amount);


        if (transaction.type === "income") {

            totalIncome += amount;

        } else {

            totalExpenses += amount;

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
        new Date()
            .toISOString()
            .split("T")[0];

}


// ----------------------------------
// CAPITALIZE TEXT
// ----------------------------------

function capitalize(text) {

    return text.charAt(0).toUpperCase()
        + text.slice(1);

}