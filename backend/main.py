"""
Zenith ERP (Nawwat OS) — Launcher.
Uses the modular app in app/main.py.
"""
from app.main import app

if __name__ == "__main__":
    import uvicorn
    print("Starting Nawwat OS SaaS Engine...")
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
