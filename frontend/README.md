# EduNesta Frontend (React + Vite)

## Setup
1. `cd frontend`
2. `npm install`
3. Add environment variables in `.env`
4. `npm run dev`

## Unique Feature (USP)
- `Auto Attendance + Parent Daily Alert + AI Study Coach`
- Opening a lecture can auto-mark attendance, combine it with test performance in daily status, notify parents, and generate AI next-step guidance.

## Other Key Features
- `AI Quality Gate for Test Publishing`: Tests can be published only when question AI review is valid and clarity score meets the minimum threshold.
- `Secure Parent Linking`: Students generate a 6-digit expiring code (10 minutes) that parents use to link accounts.

## Required environment variables
- `VITE_API_BASE_URL` Backend API base URL (example: `http://localhost:8080/api`)
- `VITE_GOOGLE_CLIENT_ID` Google OAuth Web client ID (required for "Continue with Google")
- `VITE_CSRF_COOKIE_NAME` CSRF cookie name (default `XSRF-TOKEN`)
- `VITE_CSRF_HEADER_NAME` CSRF request header name (default `X-CSRF-Token`)
