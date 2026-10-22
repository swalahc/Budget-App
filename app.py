from flask import Flask, render_template, request, redirect, url_for, session, jsonify
import sqlite3
import math
import re
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
app.secret_key = "finance-app-secret-key"

DATABASE = "database.db"

EXPENSE_CATEGORIES = [
    "Food",
    "Transportation",
    "Bills",
    "Entertainment",
    "Shopping",
    "Education",
    "Health",
    "Other"
]

INCOME_CATEGORIES = [
    "Salary",
    "Freelance",
    "Other Income"
]

ALL_CATEGORIES = INCOME_CATEGORIES + EXPENSE_CATEGORIES


# -----------------------------
# DATABASE
# -----------------------------

def get_db():
    connection = sqlite3.connect(DATABASE)
    connection.row_factory = sqlite3.Row
    return connection


def initialize_database():
    connection = get_db()
    cursor = connection.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            type TEXT NOT NULL,
            amount REAL NOT NULL,
            category TEXT NOT NULL,
            description TEXT,
            date TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS budgets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            category TEXT NOT NULL,
            month TEXT NOT NULL,
            amount REAL NOT NULL CHECK (amount > 0),
            FOREIGN KEY (user_id) REFERENCES users(id),
            UNIQUE (user_id, category, month)
        )
    """)

    connection.commit()
    connection.close()


def valid_month(month):
    return (
        isinstance(month, str)
        and re.fullmatch(r"\d{4}-(0[1-9]|1[0-2])", month) is not None
    )


def valid_amount(value):
    try:
        amount = float(value)
        if not math.isfinite(amount) or amount <= 0:
            return None
        return amount
    except (ValueError, TypeError, OverflowError):
        return None


def logged_in():
    return "user_id" in session


# -----------------------------
# LOGIN / REGISTER
# -----------------------------

@app.route("/")
def home():
    if logged_in():
        return redirect(url_for("dashboard"))
    return redirect(url_for("login"))


@app.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "")

        if not username or not password:
            return render_template(
                "register.html",
                error="Username and password are required."
            )

        connection = get_db()

        existing_user = connection.execute(
            "SELECT id FROM users WHERE username = ?",
            (username,)
        ).fetchone()

        if existing_user:
            connection.close()
            return render_template(
                "register.html",
                error="Username already exists."
            )

        hashed_password = generate_password_hash(password)

        try:
            connection.execute(
                "INSERT INTO users (username, password) VALUES (?, ?)",
                (username, hashed_password)
            )
            connection.commit()
        except sqlite3.IntegrityError:
            connection.close()
            return render_template(
                "register.html",
                error="Username already exists."
            )

        connection.close()
        return redirect(url_for("login"))

    return render_template("register.html")


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "")

        connection = get_db()
        user = connection.execute(
            "SELECT * FROM users WHERE username = ?",
            (username,)
        ).fetchone()
        connection.close()

        if user and check_password_hash(user["password"], password):
            session["user_id"] = user["id"]
            session["username"] = user["username"]
            return redirect(url_for("dashboard"))

        return render_template(
            "login.html",
            error="Invalid username or password."
        )

    return render_template("login.html")


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))


# -----------------------------
# DASHBOARD / BUDGET PAGE
# -----------------------------

@app.route("/dashboard")
def dashboard():
    if not logged_in():
        return redirect(url_for("login"))

    return render_template(
        "dashboard.html",
        username=session["username"]
    )


@app.route("/budgets")
def budgets_page():
    if not logged_in():
        return redirect(url_for("login"))

    return render_template(
        "budgets.html",
        username=session["username"]
    )


# -----------------------------
# GET TRANSACTIONS
# -----------------------------

@app.route("/api/transactions", methods=["GET"])
def get_transactions():
    if not logged_in():
        return jsonify({"error": "Not logged in"}), 401

    connection = get_db()

    transactions = connection.execute("""
        SELECT id, type, amount, category, description, date
        FROM transactions
        WHERE user_id = ?
        ORDER BY date DESC, id DESC
    """, (session["user_id"],)).fetchall()

    connection.close()

    return jsonify([
        {
            "id": item["id"],
            "type": item["type"],
            "amount": item["amount"],
            "category": item["category"],
            "description": item["description"],
            "date": item["date"]
        }
        for item in transactions
    ])


# -----------------------------
# ADD TRANSACTION
# -----------------------------

@app.route("/api/transactions", methods=["POST"])
def add_transaction():
    if not logged_in():
        return jsonify({"error": "Not logged in"}), 401

    data = request.get_json(silent=True) or {}

    transaction_type = data.get("type")
    amount = valid_amount(data.get("amount"))
    category = data.get("category")
    description = data.get("description", "")
    date = data.get("date")

    if transaction_type not in ("income", "expense"):
        return jsonify({"error": "Invalid transaction type"}), 400

    if amount is None:
        return jsonify({"error": "Amount must be greater than zero"}), 400

    allowed_categories = (
        INCOME_CATEGORIES if transaction_type == "income"
        else EXPENSE_CATEGORIES
    )

    if category not in allowed_categories:
        return jsonify({"error": "Invalid category for this transaction type"}), 400

    if not isinstance(date, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", date):
        return jsonify({"error": "A valid transaction date is required"}), 400

    connection = get_db()
    connection.execute("""
        INSERT INTO transactions
            (user_id, type, amount, category, description, date)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (
        session["user_id"],
        transaction_type,
        amount,
        category,
        description,
        date
    ))
    connection.commit()
    connection.close()

    return jsonify({"message": "Transaction added successfully"}), 201


# -----------------------------
# EDIT TRANSACTION
# -----------------------------

@app.route("/api/transactions/<int:transaction_id>", methods=["PUT"])
def edit_transaction(transaction_id):
    if not logged_in():
        return jsonify({"error": "Not logged in"}), 401

    data = request.get_json(silent=True) or {}

    transaction_type = data.get("type")
    amount = valid_amount(data.get("amount"))
    category = data.get("category")
    description = data.get("description", "")
    date = data.get("date")

    if transaction_type not in ("income", "expense"):
        return jsonify({"error": "Invalid transaction type"}), 400

    if amount is None:
        return jsonify({"error": "Amount must be greater than zero"}), 400

    allowed_categories = (
        INCOME_CATEGORIES if transaction_type == "income"
        else EXPENSE_CATEGORIES
    )

    if category not in allowed_categories:
        return jsonify({"error": "Invalid category for this transaction type"}), 400

    if not isinstance(date, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", date):
        return jsonify({"error": "A valid transaction date is required"}), 400

    connection = get_db()

    transaction = connection.execute("""
        SELECT id FROM transactions
        WHERE id = ? AND user_id = ?
    """, (transaction_id, session["user_id"])).fetchone()

    if not transaction:
        connection.close()
        return jsonify({"error": "Transaction not found"}), 404

    connection.execute("""
        UPDATE transactions
        SET type = ?, amount = ?, category = ?, description = ?, date = ?
        WHERE id = ? AND user_id = ?
    """, (
        transaction_type,
        amount,
        category,
        description,
        date,
        transaction_id,
        session["user_id"]
    ))

    connection.commit()
    connection.close()

    return jsonify({"message": "Transaction updated successfully"})


# -----------------------------
# DELETE TRANSACTION
# -----------------------------

@app.route("/api/transactions/<int:transaction_id>", methods=["DELETE"])
def delete_transaction(transaction_id):
    if not logged_in():
        return jsonify({"error": "Not logged in"}), 401

    connection = get_db()

    cursor = connection.execute("""
        DELETE FROM transactions
        WHERE id = ? AND user_id = ?
    """, (transaction_id, session["user_id"]))

    connection.commit()
    deleted = cursor.rowcount
    connection.close()

    if deleted == 0:
        return jsonify({"error": "Transaction not found"}), 404

    return jsonify({"message": "Transaction deleted successfully"})


# -----------------------------
# GET MONTHLY BUDGETS
# -----------------------------

@app.route("/api/budgets", methods=["GET"])
def get_budgets():
    if not logged_in():
        return jsonify({"error": "Not logged in"}), 401

    month = request.args.get("month", "")

    if not valid_month(month):
        return jsonify({"error": "Select a valid month in YYYY-MM format"}), 400

    connection = get_db()

    budgets = connection.execute("""
        SELECT
            b.id,
            b.category,
            b.month,
            b.amount,
            COALESCE(SUM(t.amount), 0) AS spent
        FROM budgets b
        LEFT JOIN transactions t
            ON t.user_id = b.user_id
            AND t.category = b.category
            AND t.type = 'expense'
            AND substr(t.date, 1, 7) = b.month
        WHERE b.user_id = ?
            AND b.month = ?
        GROUP BY b.id, b.category, b.month, b.amount
        ORDER BY b.category
    """, (session["user_id"], month)).fetchall()

    connection.close()

    result = []

    for budget in budgets:
        amount = float(budget["amount"])
        spent = float(budget["spent"])

        result.append({
            "id": budget["id"],
            "category": budget["category"],
            "month": budget["month"],
            "amount": amount,
            "spent": spent,
            "remaining": amount - spent,
            "percentage": round((spent / amount) * 100, 1)
        })

    return jsonify(result)


# -----------------------------
# CREATE / UPDATE MONTHLY BUDGET
# -----------------------------

@app.route("/api/budgets", methods=["POST"])
def save_budget():
    if not logged_in():
        return jsonify({"error": "Not logged in"}), 401

    data = request.get_json(silent=True) or {}

    category = data.get("category")
    month = data.get("month")
    amount = valid_amount(data.get("amount"))

    if category not in EXPENSE_CATEGORIES:
        return jsonify({"error": "Select a valid expense category"}), 400

    if not valid_month(month):
        return jsonify({"error": "Select a valid month"}), 400

    if amount is None:
        return jsonify({"error": "Budget must be a positive number"}), 400

    connection = get_db()

    connection.execute("""
        INSERT INTO budgets (user_id, category, month, amount)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id, category, month)
        DO UPDATE SET amount = excluded.amount
    """, (
        session["user_id"],
        category,
        month,
        amount
    ))

    connection.commit()
    connection.close()

    return jsonify({
        "message": f"{category} budget saved for {month}."
    })


# -----------------------------
# START APPLICATION
# -----------------------------

if __name__ == "__main__":
    initialize_database()
    app.run(debug=True)
