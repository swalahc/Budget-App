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
# START APPLICATION
# -----------------------------

if __name__ == "__main__":

    initialize_database()

    app.run(debug=True)