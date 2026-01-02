# Excel/Minitab Web Application

Complete web application with Excel-like spreadsheets and statistical analysis.

## Quick Start

### 1. Database Setup
```sql
CREATE DATABASE minitab;
```

### 2. Backend
```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

### 3. Frontend (new terminal)
```powershell
cd frontend
npm install
npm run dev
```

### 4. Access
- Frontend: http://localhost:3000
- Backend: http://localhost:8000
- Admin: http://localhost:8000/admin

## Database
- Name: `minitab`
- User: `postgres`
- Password: `root`

## Quick Start Script
```powershell
.\start.ps1
```

This starts both backend and frontend in separate windows.
