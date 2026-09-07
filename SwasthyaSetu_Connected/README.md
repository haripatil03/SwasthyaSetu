# SwasthyaSetu — Frontend + Backend CONNECTED

## One-command startup

Windows:
```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

Then open:
http://127.0.0.1:8000

The FastAPI backend serves the frontend itself. This removes the previous `file://` / `localhost:8000` mismatch and makes browser → API → database work through one origin.

## Demo login
Email: worker@swasthyasetu.in
Password: demo123

## Connected live APIs
- GET /api/health
- POST /api/login
- GET /api/dashboard
- GET/POST /api/patients
- POST /api/triage
- GET/PATCH /api/referrals
- GET /api/medicines
- POST /api/consultations

## Data
SQLite database is created automatically at:
backend/swasthyasetu.db

## Production next steps
Replace demo token authentication with JWT/OAuth2, PostgreSQL, HTTPS, encryption, audit logging, consent management, approved interoperability standards, secure offline sync and real telemedicine/notification integrations.
