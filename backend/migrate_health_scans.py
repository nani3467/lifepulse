import sqlite3
import os

db_path = r'c:\Users\lnaga\OneDrive\Desktop\.gemini\antigravity\scratch\LifePulse\backend\lifepulse_dev.db'

print(f"Connecting to database at {db_path}...")
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    print("Creating health_scans table...")
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS health_scans (
        scan_id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id INTEGER NOT NULL,
        heart_rate INTEGER,
        hrv INTEGER,
        spo2 INTEGER,
        respiratory_rate INTEGER,
        stress_score INTEGER,
        recovery_score INTEGER,
        health_score INTEGER,
        recommendations TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(patient_id) REFERENCES patients(id) ON DELETE CASCADE
    );
    """)
    conn.commit()
    print("Table health_scans created successfully!")
except Exception as e:
    print("Error creating table health_scans:", e)

# Double check table columns
cursor.execute("PRAGMA table_info(health_scans)")
columns = cursor.fetchall()
print("\nhealth_scans columns:")
for col in columns:
    print(col)

conn.close()
