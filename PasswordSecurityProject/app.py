from flask import Flask, render_template, request, jsonify
import re
import sqlite3
import math

app = Flask(__name__)


@app.route('/')
def home():
    return render_template('index.html')


@app.route('/check_password', methods=['POST'])
def check_password():

    data = request.get_json()

    password = data['password']

    score = 0

    messages = []

    suggestions = []

    # Length Check
    if len(password) >= 12:
        score += 20
    else:
        messages.append(
            "Password should be at least 12 characters."
        )

        suggestions.append(
            "Use at least 12 characters."
        )

    # Uppercase Check
    if re.search(r"[A-Z]", password):
        score += 10
    else:
        messages.append("Add uppercase letters.")

        suggestions.append(
            "Include uppercase letters."
        )

    # Lowercase Check
    if re.search(r"[a-z]", password):
        score += 10
    else:
        messages.append("Add lowercase letters.")

        suggestions.append(
            "Include lowercase letters."
        )

    # Number Check
    if re.search(r"\d", password):
        score += 10
    else:
        messages.append("Add numbers.")

        suggestions.append(
            "Include numeric values."
        )

    # Special Character Check
    if re.search(r"[!@#$%^&*]", password):
        score += 20
    else:
        messages.append("Add special characters.")

        suggestions.append(
            "Use symbols like !@#$%^&*"
        )

    # Common Password Detection
    with open(
        r'database/common_passwords.txt',
        'r'
    ) as file:

        common_passwords = file.read().splitlines()

    if password.lower() in common_passwords:

        score -= 20

        messages.append(
            "Common password detected."
        )

        suggestions.append(
            "Avoid commonly used passwords."
        )

    # Repeated Character Detection
    if re.search(r'(.)\1\1', password):

        score -= 10

        messages.append(
            "Repeated characters detected."
        )

    # Sequential Pattern Detection
    sequential_patterns = [
        "1234",
        "abcd",
        "qwerty",
        "password"
    ]

    for pattern in sequential_patterns:

        if pattern in password.lower():

            score -= 10

            messages.append(
                "Sequential pattern detected."
            )

            break

    # Ensure Score Does Not Go Below 0
    if score < 0:
        score = 0

    # Strength Classification
    if score < 40:
        strength = "Weak"

    elif score < 70:
        strength = "Medium"

    else:
        strength = "Strong"

    # Crack Time Estimation
    if score < 30:
        crack_time = "Few seconds"

    elif score < 50:
        crack_time = "Few hours"

    elif score < 70:
        crack_time = "Few days"

    elif score < 90:
        crack_time = "Few months"

    else:
        crack_time = "Several years"

    # Entropy Calculation
    charset_size = 0

    if re.search(r"[a-z]", password):
        charset_size += 26

    if re.search(r"[A-Z]", password):
        charset_size += 26

    if re.search(r"\d", password):
        charset_size += 10

    if re.search(r"[!@#$%^&*]", password):
        charset_size += 8

    if charset_size > 0:

        entropy = round(
            len(password) *
            math.log2(charset_size),
            2
        )

    else:

        entropy = 0

    # Save to SQLite Database
    conn = sqlite3.connect('passwords.db')

    cursor = conn.cursor()

    cursor.execute('''

    CREATE TABLE IF NOT EXISTS password_logs (

        id INTEGER PRIMARY KEY AUTOINCREMENT,

        password TEXT,

        score INTEGER,

        strength TEXT,

        crack_time TEXT,

        entropy REAL
    )

    ''')

    cursor.execute('''

    INSERT INTO password_logs(
        password,
        score,
        strength,
        crack_time,
        entropy
    )

    VALUES (?, ?, ?, ?, ?)

    ''', (
        password,
        score,
        strength,
        crack_time,
        entropy
    ))

    conn.commit()

    conn.close()

    # Return Results
    return jsonify({

        "score": score,

        "strength": strength,

        "crack_time": crack_time,

        "entropy": entropy,

        "messages": messages,

        "suggestions": suggestions
    })

@app.route('/dashboard')
def dashboard():

    conn = sqlite3.connect('passwords.db')

    cursor = conn.cursor()

    # Total Passwords Checked
    cursor.execute(
        "SELECT COUNT(*) FROM password_logs"
    )

    total = cursor.fetchone()[0]

    # Average Password Score
    cursor.execute(
        "SELECT AVG(score) FROM password_logs"
    )

    average_score = cursor.fetchone()[0]

    conn.close()

    return render_template(

        'dashboard.html',

        total=total,

        average_score=round(average_score, 2)
    )

if __name__ == '__main__':
    app.run(debug=True)