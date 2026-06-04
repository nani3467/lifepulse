import sqlite3

db_path = r'c:\Users\lnaga\OneDrive\Desktop\.gemini\antigravity\scratch\LifePulse\backend\lifepulse_dev.db'

print(f"Connecting to database at {db_path}...")
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

new_columns = [
    ("systolic_bp", "INTEGER"),
    ("diastolic_bp", "INTEGER"),
    ("bp_category", "VARCHAR(50)"),
    ("fatigue_level", "VARCHAR(50)"),
    ("alertness_score", "INTEGER"),
    ("height", "FLOAT"),
    ("weight", "FLOAT"),
    ("bmi", "FLOAT"),
    ("weight_category", "VARCHAR(50)"),
    ("stress_level", "VARCHAR(50)")
]

for col_name, col_type in new_columns:
    try:
        print(f"Adding column {col_name} ({col_type})...")
        cursor.execute(f"ALTER TABLE health_scans ADD COLUMN {col_name} {col_type}")
        conn.commit()
        print(f"Column {col_name} added successfully.")
    except Exception as e:
        print(f"Column {col_name} already exists or error: {e}")

# Double check table info
cursor.execute("PRAGMA table_info(health_scans)")
columns = cursor.fetchall()
print("\nUpdated health_scans columns:")
for col in columns:
    print(col)

conn.close()
