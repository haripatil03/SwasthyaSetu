from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
import sqlite3, hashlib, os

BASE = os.path.dirname(__file__)
DB = os.path.join(BASE, "swasthyasetu.db")
FRONTEND = os.path.abspath(os.path.join(BASE, "..", "frontend"))

app = FastAPI(title="SwasthyaSetu API", version="1.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def db():
    c = sqlite3.connect(DB)
    c.row_factory = sqlite3.Row
    return c

def init_db():
    c = db()
    c.executescript("""
    CREATE TABLE IF NOT EXISTS users(
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT UNIQUE,
      password_hash TEXT, role TEXT, facility TEXT
    );
    CREATE TABLE IF NOT EXISTS patients(
      id INTEGER PRIMARY KEY AUTOINCREMENT, patient_code TEXT UNIQUE,
      name TEXT, age INTEGER, gender TEXT, phone TEXT, village TEXT,
      condition TEXT, risk TEXT, facility TEXT, created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS referrals(
      id INTEGER PRIMARY KEY AUTOINCREMENT, referral_code TEXT UNIQUE,
      patient_id INTEGER, source_facility TEXT, destination_facility TEXT,
      department TEXT, referral_date TEXT, status TEXT
    );
    CREATE TABLE IF NOT EXISTS medicines(
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, stock INTEGER,
      minimum_stock INTEGER, facility TEXT
    );
    CREATE TABLE IF NOT EXISTS consultations(
      id INTEGER PRIMARY KEY AUTOINCREMENT, patient_id INTEGER,
      specialty TEXT, priority TEXT, notes TEXT, status TEXT, created_at TEXT
    );
    """)
    if c.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0:
        pw = hashlib.sha256("demo123".encode()).hexdigest()
        c.execute("""INSERT INTO users(name,email,password_hash,role,facility)
                     VALUES(?,?,?,?,?)""",
                  ("Demo Health Worker","worker@swasthyasetu.in",pw,
                   "Health Worker","PHC Amalner"))
    if c.execute("SELECT COUNT(*) FROM patients").fetchone()[0] == 0:
        patients = [
            ("P-1001","Sita Patil",29,"Female","9876543210","Amalner",
             "Pregnancy - 28 weeks","High","PHC Amalner"),
            ("P-1002","Ramesh More",58,"Male","9876543211","Nimkhedi",
             "Diabetes + Hypertension","Medium","Sub-centre Nimkhedi"),
            ("P-1003","Asha Pawar",7,"Female","9876543212","Chalisgaon",
             "Fever","Low","PHC Chalisgaon"),
            ("P-1004","Ganesh Shinde",67,"Male","9876543213","Bhusawal",
             "Breathlessness","High","Rural Hospital Bhusawal"),
            ("P-1005","Meena Chaudhari",34,"Female","9876543214","Pachora",
             "Postnatal follow-up","Medium","PHC Pachora"),
        ]
        c.executemany("""INSERT INTO patients
          (patient_code,name,age,gender,phone,village,condition,risk,facility,created_at)
          VALUES(?,?,?,?,?,?,?,?,?,?)""",
          [p + (datetime.now().isoformat(),) for p in patients])
    if c.execute("SELECT COUNT(*) FROM medicines").fetchone()[0] == 0:
        c.executemany("""INSERT INTO medicines(name,stock,minimum_stock,facility)
                         VALUES(?,?,?,?)""", [
            ("Paracetamol 500mg",1240,300,"PHC Amalner"),
            ("ORS",760,200,"PHC Amalner"),
            ("Metformin 500mg",140,250,"PHC Amalner"),
            ("Insulin",22,50,"PHC Amalner"),
            ("Amoxicillin 500mg",410,150,"PHC Amalner"),
            ("Iron + Folic Acid",680,250,"PHC Amalner"),
        ])
    if c.execute("SELECT COUNT(*) FROM referrals").fetchone()[0] == 0:
        c.executemany("""INSERT INTO referrals
          (referral_code,patient_id,source_facility,destination_facility,department,referral_date,status)
          VALUES(?,?,?,?,?,?,?)""", [
            ("R-501",1,"PHC Amalner","District Hospital Jalgaon","Gynaecology","2026-09-07","Completed"),
            ("R-502",2,"Sub-centre Nimkhedi","PHC Jalgaon","Medicine","2026-09-08","Pending"),
            ("R-503",4,"Rural Hospital Bhusawal","District Hospital Jalgaon","Cardiology","2026-09-07","Urgent"),
            ("R-504",5,"PHC Pachora","Rural Hospital Chalisgaon","Obstetrics","2026-09-10","Scheduled"),
        ])
    c.commit()
    c.close()

init_db()

class Login(BaseModel):
    email: str
    password: str

class PatientIn(BaseModel):
    name: str
    age: int = Field(ge=0, le=120)
    gender: str
    phone: str = ""
    village: str = ""
    condition: str = ""
    risk: str = "Low"
    facility: str = "PHC Amalner"

class TriageIn(BaseModel):
    patient_name: str
    age: int
    symptoms: list[str]
    pregnancy: bool = False
    chronic: bool = False

class ConsultationIn(BaseModel):
    patient_id: int
    specialty: str
    priority: str
    notes: str = ""

def auth(authorization: Optional[str] = Header(None)):
    if authorization != "Bearer demo-token":
        raise HTTPException(401, "Authentication required")
    return True

@app.get("/api/health")
def health():
    return {"status": "ok", "message": "SwasthyaSetu backend connected"}

@app.post("/api/login")
def login(x: Login):
    pw = hashlib.sha256(x.password.encode()).hexdigest()
    c = db()
    u = c.execute("""SELECT id,name,email,role,facility FROM users
                     WHERE email=? AND password_hash=?""", (x.email,pw)).fetchone()
    c.close()
    if not u:
        raise HTTPException(401, "Invalid email or password")
    return {"token":"demo-token", "user":dict(u)}

@app.get("/api/dashboard")
def dashboard(_: bool=Depends(auth)):
    c=db()
    data = {
        "patients": c.execute("SELECT COUNT(*) n FROM patients").fetchone()["n"],
        "high_risk": c.execute("SELECT COUNT(*) n FROM patients WHERE risk='High'").fetchone()["n"],
        "pending_referrals": c.execute(
            "SELECT COUNT(*) n FROM referrals WHERE status IN ('Pending','Urgent')").fetchone()["n"],
        "medicine_alerts": c.execute(
            "SELECT COUNT(*) n FROM medicines WHERE stock < minimum_stock").fetchone()["n"],
        "teleconsultations": c.execute("SELECT COUNT(*) n FROM consultations").fetchone()["n"],
    }
    c.close()
    return data

@app.get("/api/patients")
def get_patients(q: str="", _: bool=Depends(auth)):
    c=db()
    rows=c.execute("""SELECT * FROM patients
        WHERE name LIKE ? OR patient_code LIKE ? OR condition LIKE ?
        ORDER BY id DESC""", (f"%{q}%",f"%{q}%",f"%{q}%")).fetchall()
    c.close()
    return [dict(r) for r in rows]

@app.post("/api/patients")
def add_patient(x: PatientIn, _: bool=Depends(auth)):
    c=db()
    next_num = 1001 + c.execute("SELECT COUNT(*) FROM patients").fetchone()[0]
    code=f"P-{next_num}"
    c.execute("""INSERT INTO patients
      (patient_code,name,age,gender,phone,village,condition,risk,facility,created_at)
      VALUES(?,?,?,?,?,?,?,?,?,?)""",
      (code,x.name,x.age,x.gender,x.phone,x.village,x.condition,x.risk,x.facility,
       datetime.now().isoformat()))
    c.commit()
    c.close()
    return {"patient_code":code, "message":"Patient added successfully"}

@app.post("/api/triage")
def triage(x:TriageIn, _:bool=Depends(auth)):
    emergency=any(s in x.symptoms for s in
                  ["Breathing difficulty","Chest pain","Severe bleeding","Unconsciousness"])
    urgent=emergency or "Severe abdominal pain" in x.symptoms or (x.pregnancy and "Fever" in x.symptoms)
    return {
        "priority":"EMERGENCY" if emergency else "URGENT" if urgent else "ROUTINE",
        "action":"Immediate emergency escalation" if emergency else
                 "Same-day clinical assessment" if urgent else
                 "Primary-care consultation and follow-up"
    }

@app.get("/api/referrals")
def get_referrals(_:bool=Depends(auth)):
    c=db()
    rows=c.execute("""SELECT r.*,p.name patient_name
                      FROM referrals r LEFT JOIN patients p ON p.id=r.patient_id
                      ORDER BY r.id DESC""").fetchall()
    c.close()
    return [dict(r) for r in rows]

@app.patch("/api/referrals/{rid}")
def update_referral(rid:int, status:str, _:bool=Depends(auth)):
    c=db()
    cur=c.execute("UPDATE referrals SET status=? WHERE id=?", (status,rid))
    c.commit()
    c.close()
    if cur.rowcount == 0:
        raise HTTPException(404,"Referral not found")
    return {"message":"Referral updated"}

@app.get("/api/medicines")
def get_medicines(_:bool=Depends(auth)):
    c=db()
    rows=c.execute("""SELECT *, CASE WHEN stock < minimum_stock
                      THEN 'Low Stock' ELSE 'Available' END status FROM medicines""").fetchall()
    c.close()
    return [dict(r) for r in rows]

@app.post("/api/consultations")
def create_consultation(x:ConsultationIn, _:bool=Depends(auth)):
    c=db()
    c.execute("""INSERT INTO consultations
      (patient_id,specialty,priority,notes,status,created_at)
      VALUES(?,?,?,?,?,?)""",
      (x.patient_id,x.specialty,x.priority,x.notes,"Requested",datetime.now().isoformat()))
    c.commit()
    c.close()
    return {"message":"Teleconsultation request created"}

# Serve the connected frontend from the same FastAPI server.
if os.path.isdir(FRONTEND):
    app.mount("/", StaticFiles(directory=FRONTEND, html=True), name="frontend")
