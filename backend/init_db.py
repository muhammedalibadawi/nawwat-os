import os
from database import engine, Base
import models # Ensure all models are loaded

print("🛠️ Initiating Database Sync...")

db_file = "nawwat.db"

# SQLite does not support ALTER TABLE for most operations.
# To ensure all new columns (like barcode, tax, branch_id) are created,
# we need to drop the old DB file and let SQLAlchemy rebuild it from scratch.

if os.path.exists(db_file):
    print(f"🗑️ Found existing {db_file}. Deleting to prevent schema conflicts...")
    
    # We must close any active connections to drop it on Windows
    engine.dispose()
    
    try:
        os.remove(db_file)
        print("✅ Old database deleted.")
    except Exception as e:
        print(f"❌ Failed to delete old database. Please stop the uvicorn server first! Error: {e}")
        exit(1)
else:
    print("✨ No existing database found.")

print("🔨 Generating fresh schema from models.py...")
# This reads all classes inheriting from Base in models.py and creates tables
Base.metadata.create_all(bind=engine)
print("✅ Database Sync Complete! All new columns are now active.")
print("🚀 Please restart your FastAPI uvicorn server.")
