from flask import Flask, render_template, request, redirect, url_for, session, jsonify
import sqlite3
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
app.secret_key = "finance-app-secret-key"

DATABASE = "database.db"


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

    # Users table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        )
    """)

    # Transactions table
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

    # Monthly budgets table
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


# -----------------------------
# LOGIN / REGISTER
# -----------------------------

@app.route("/")
def home():
    if "user_id" in session:
        return redirect(url_for("dashboard"))

    return redirect(url_for("login"))


@app.route("/register", methods=["GET", "POST"])
def register():

    if request.method == "POST":

        username = request.form["username"].strip()
        password = request.form["password"]

        if not username or not password:
            return render_template(
                "register.html",
                error="Username and password are required."
            )

        connection = get_db()
        cursor = connection.cursor()

        # Check if username already exists
        existing_user = cursor.execute(
            "SELECT * FROM users WHERE username = ?",
            (username,)
        ).fetchone()

        if existing_user:
            connection.close()

            return render_template(
                "register.html",
                error="Username already exists."
            )

        hashed_password = generate_password_hash(password)

        cursor.execute(
            "INSERT INTO users (username, password) VALUES (?, ?)",
            (username, hashed_password)
        )

        connection.commit()
        connection.close()

        return redirect(url_for("login"))

    return render_template("register.html")


@app.route("/login", methods=["GET", "POST"])
def login():

    if request.method == "POST":

        username = request.form["username"]
        password = request.form["password"]

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
# DASHBOARD
# -----------------------------

@app.route("/dashboard")
def dashboard():

    if "user_id" not in session:
        return redirect(url_for("login"))

    return render_template(
        "dashboard.html",
        username=session["username"]
    )


# -----------------------------
# GET TRANSACTIONS
# -----------------------------

@app.route("/api/transactions", methods=["GET"])
def get_transactions():

    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401

    connection = get_db()

    transactions = connection.execute("""
        SELECT *
        FROM transactions
        WHERE user_id = ?
        ORDER BY date DESC, id DESC
    """, (session["user_id"],)).fetchall()

    connection.close()

    transaction_list = []

    for transaction in transactions:

        transaction_list.append({
            "id": transaction["id"],
            "type": transaction["type"],
            "amount": transaction["amount"],
            "category": transaction["category"],
            "description": transaction["description"],
            "date": transaction["date"]
        })

    return jsonify(transaction_list)


# -----------------------------
# ADD TRANSACTION
# -----------------------------

@app.route("/api/transactions", methods=["POST"])
def add_transaction():

    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401

    data = request.get_json()

    transaction_type = data.get("type")
    amount = data.get("amount")
    category = data.get("category")
    description = data.get("description")
    date = data.get("date")

    if not transaction_type or not amount or not category or not date:
        return jsonify({
            "error": "Missing required fields"
        }), 400

    try:
        amount = float(amount)

        if amount <= 0:
            return jsonify({
                "error": "Amount must be greater than zero"
            }), 400

    except ValueError:
        return jsonify({
            "error": "Invalid amount"
        }), 400

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

    return jsonify({
        "message": "Transaction added successfully"
    })


# -----------------------------
# EDIT TRANSACTION
# -----------------------------

@app.route("/api/transactions/<int:transaction_id>", methods=["PUT"])
def edit_transaction(transaction_id):

    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401

    data = request.get_json()

    transaction_type = data.get("type")
    amount = data.get("amount")
    category = data.get("category")
    description = data.get("description")
    date = data.get("date")

    if not transaction_type or not amount or not category or not date:
        return jsonify({
            "error": "Missing required fields"
        }), 400

    try:
        amount = float(amount)

        if amount <= 0:
            return jsonify({
                "error": "Amount must be greater than zero"
            }), 400

    except ValueError:
        return jsonify({
            "error": "Invalid amount"
        }), 400

    connection = get_db()

    # Make sure the transaction belongs to this user
    transaction = connection.execute("""
        SELECT *
        FROM transactions
        WHERE id = ? AND user_id = ?
    """, (
        transaction_id,
        session["user_id"]
    )).fetchone()

    if not transaction:
        connection.close()

        return jsonify({
            "error": "Transaction not found"
        }), 404

    connection.execute("""
        UPDATE transactions
        SET type = ?,
            amount = ?,
            category = ?,
            description = ?,
            date = ?
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

    return jsonify({
        "message": "Transaction updated successfully"
    })


# -----------------------------
# DELETE TRANSACTION
# -----------------------------

@app.route("/api/transactions/<int:transaction_id>", methods=["DELETE"])
def delete_transaction(transaction_id):

    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401

    connection = get_db()

    transaction = connection.execute("""
        SELECT *
        FROM transactions
        WHERE id = ? AND user_id = ?
    """, (
        transaction_id,
        session["user_id"]
    )).fetchone()

    if not transaction:
        connection.close()

        return jsonify({
            "error": "Transaction not found"
        }), 404

    connection.execute("""
        DELETE FROM transactions
        WHERE id = ? AND user_id = ?
    """, (
        transaction_id,
        session["user_id"]
    ))

    connection.commit()
    connection.close()

    return jsonify({
        "message": "Transaction deleted successfully"
    })


# -----------------------------
# MONTHLY BUDGETS
# -----------------------------

@app.route("/api/budgets", methods=["GET"])
def get_budgets():

    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401

    month = request.args.get("month", "")

    # Validate YYYY-MM format
    import re
    if not re.fullmatch(r"\d{4}-(0[1-9]|1[0-2])", month):
        return jsonify({"error": "Invalid month"}), 400

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
        GROUP BY b.id
        ORDER BY b.category
    """, (session["user_id"], month)).fetchall()

    connection.close()

    result = []

    for budget in budgets:
        amount = budget["amount"]
        spent = budget["spent"]

        result.append({
            "id": budget["id"],
            "category": budget["category"],
            "month": budget["month"],
            "amount": amount,
            "spent": spent,
            "remaining": amount - spent,
            "percentage": round(spent / amount * 100, 1)
        })

    return jsonify(result)


@app.route("/api/budgets", methods=["POST"])
def save_budget():

    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401

    data = request.get_json() or {}

    category = data.get("category")
    month = data.get("month")
    amount = data.get("amount")

    allowed_categories = [
        "Food",
        "Transportation",
        "Bills",
        "Entertainment",
        "Shopping",
        "Education",
        "Health",
        "Other"
    ]

    if category not in allowed_categories:
        return jsonify({"error": "Invalid expense category"}), 400

    import re
    if not isinstance(month, str) or not re.fullmatch(
        r"\d{4}-(0[1-9]|1[0-2])", month
    ):
        return jsonify({"error": "Invalid month"}), 400

    try:
        amount = float(amount)

        if not (0 < amount < float("inf")):
            raise ValueError

    except (ValueError, TypeError, OverflowError):
        return jsonify({
            "error": "Budget must be a positive number"
        }), 400

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
        "message": "Monthly budget saved successfully"
    }), 200


# -----------------------------
# START APPLICATION
# -----------------------------

if __name__ == "__main__":

    initialize_database()

    app.run(debug=True)