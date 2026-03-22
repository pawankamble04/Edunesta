# EduNesta

EduNesta is a full-stack smart education platform built with a React frontend and a Node.js/Express backend. It supports dedicated flows for admins, teachers, students, and parents, with AI-assisted learning, online tests, lecture tracking, materials, analytics, and stronger session security.

## Highlights

- Role-based experiences for admin, teacher, student, and parent users
- Email/password auth, Google sign-in, refresh-token sessions, CSRF protection, and account session management
- Teacher tools for test creation, question authoring, AI test generation, lecture publishing, materials, and exam-prep tracking
- Student tools for tests, results, teacher linking, lecture access, AI roadmaps, exam auto-prep, and PYQ practice
- Parent dashboards for linked-child progress, results, and exam-prep summaries
- Admin modules for users, teachers, moderation, logs, and platform oversight
- Security workflow in GitHub Actions for dependency audit and secret scanning

## USP

- `Auto Attendance + Parent Daily Alert + AI Study Coach`
- Opening a lecture can auto-mark attendance, combine it with test performance in daily status, notify parents, and generate AI next-step guidance.

## Tech Stack

- Frontend: React 18, Vite, React Router, Axios, Framer Motion
- Backend: Node.js, Express, MongoDB/Mongoose, JWT, Google OAuth, Zod
- AI: Google Gemini integrations for study and assessment workflows

## Repository Structure

```text
Edunesta/
|- frontend/   React + Vite client
|- backend/    Express + MongoDB API
|- .github/    GitHub Actions workflows
```

## Local Setup

### 1. Install dependencies

```bash
cd backend
npm install

cd ../frontend
npm install
```

### 2. Configure environment variables

Create the local env files from the examples:

- `backend/.env.example` -> `backend/.env`
- `frontend/.env.example` -> `frontend/.env`

Important backend variables:

- `MONGO_URI`
- `JWT_SECRET`
- `CORS_ORIGIN`
- `GOOGLE_CLIENT_ID`
- `GEMINI_API_KEY`

Important frontend variables:

- `VITE_API_BASE_URL`
- `VITE_GOOGLE_CLIENT_ID`
- `VITE_CSRF_COOKIE_NAME`
- `VITE_CSRF_HEADER_NAME`

### 3. Run the app

Start the backend:

```bash
cd backend
npm run dev
```

Start the frontend in a second terminal:

```bash
cd frontend
npm run dev
```

Default local URLs:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8080`

## Scripts

Backend:

- `npm run dev`
- `npm start`
- `npm test`

Frontend:

- `npm run dev`
- `npm run build`
- `npm run preview`

## Verification

Useful local checks:

- `cd backend && npm test`
- `cd frontend && npm run build`

GitHub Actions also runs security checks from [`.github/workflows/security.yml`](./.github/workflows/security.yml), including `npm audit` and `gitleaks`.

## More Detail

- `backend/README.md` documents backend routes, environment variables, and backend-specific features.
- `frontend/README.md` documents frontend setup and required client environment variables.
