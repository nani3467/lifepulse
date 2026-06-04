# LifePulse – Hospital Management Analytics System

> Production-ready AI-powered HMS with React + Flask + MySQL

## Quick Start

### Backend
```bash
cd backend
python -m venv venv
# Windows
venv\Scripts\activate
pip install -r requirements.txt
python run.py
# API runs on http://localhost:5000
# Default admin: admin@lifepulse.com / Admin@123
```

### Frontend
```bash
cd frontend
npm install
npm run dev
# UI runs on http://localhost:3000
```

## Architecture

```
LifePulse/
├── backend/          # Flask REST API
│   ├── app/
│   │   ├── __init__.py          # App factory
│   │   ├── config.py            # Env configs (dev/prod)
│   │   ├── models/
│   │   │   ├── user.py          # User + RBAC
│   │   │   └── patient.py       # Patient, History, Admission, Disease, Report
│   │   ├── routes/
│   │   │   ├── auth_routes.py   # /api/auth/*
│   │   │   ├── admin_routes.py  # /api/admin/*
│   │   │   ├── patient_routes.py# /api/patients/*
│   │   │   └── upload_routes.py # /api/uploads/*
│   │   └── utils/
│   │       └── auth_middleware.py # RBAC decorators
│   └── run.py
│
└── frontend/         # React + Vite + Tailwind
    └── src/
        ├── contexts/AuthContext.jsx
        ├── services/api.js + patientApi.js
        ├── components/
        │   ├── Sidebar.jsx
        │   ├── Topbar.jsx
        │   ├── DashboardLayout.jsx
        │   └── patients/ (6 modal components)
        └── pages/
            ├── Login.jsx
            ├── admin/Dashboard.jsx
            └── patients/
                ├── PatientsPage.jsx
                ├── PatientDetailPage.jsx
                └── PatientAnalytics.jsx
```

## API Endpoints

### Auth (`/api/auth`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /login | Get JWT tokens |
| POST | /register | Create account |
| POST | /refresh | Refresh access token |
| GET  | /me | Current user |

### Patients (`/api/patients`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | / | List (search, filter, paginate) |
| POST | / | Create patient |
| GET | /:id | Get patient detail |
| PUT | /:id | Update patient |
| DELETE | /:id | Delete patient |
| GET/POST | /:id/history | Medical history |
| POST | /:id/admit | Admit patient |
| POST | /admissions/:id/discharge | Discharge |
| GET/POST | /:id/diseases | Disease records |
| GET | /analytics/overview | Charts data |

### Uploads (`/api/uploads`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /patients/:id/reports | Upload report file |
| GET | /:id/download | Download report |
| DELETE | /:id | Delete report |

## Roles & Access
| Feature | Admin | Doctor | Receptionist | Patient |
|---------|-------|--------|--------------|---------|
| View Patients | ✅ | ✅ | ✅ | ❌ |
| Add/Edit Patient | ✅ | ✅ | ✅ | ❌ |
| Delete Patient | ✅ | ✅ | ❌ | ❌ |
| Medical History | ✅ | ✅ | ❌ | ❌ |
| Admit/Discharge | ✅ | ✅ | ✅ | ❌ |
| Analytics | ✅ | ✅ | ❌ | ❌ |
| Admin Dashboard | ✅ | ❌ | ❌ | ❌ |

## MySQL Setup (Production)
```sql
CREATE DATABASE lifepulse_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'lifepulse'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL ON lifepulse_db.* TO 'lifepulse'@'localhost';
```
Then update `backend/.env`:
```env
DATABASE_URL=mysql+pymysql://lifepulse:your_password@localhost:3306/lifepulse_db
```
