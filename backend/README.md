# EduNesta Backend (Node + Express + MongoDB)

## Setup
1. `cd backend`
2. `npm install`
3. Copy `.env.example` to `.env` and fill values
4. Start MongoDB (local or Atlas URI)
5. `npm run dev` (or `npm start`)

## Core Auth
- `POST /api/auth/register` `{name,email,password,role}`
- `POST /api/auth/login` `{email,password}`
- `POST /api/auth/google` `{credential}`
- `GET /api/auth/me`

## Test and Question Flow
- `POST /api/tests` (teacher/admin)
- `GET /api/tests` (teacher/student/admin)
- `GET /api/tests/:id` (teacher/student/admin)
- `PUT /api/tests/:id/publish` (teacher/admin)
- `POST /api/questions/test/:testId` (teacher)
- `GET /api/questions/test/:testId` (teacher/student/admin)
- `PUT /api/questions/:id` (teacher)
- `DELETE /api/questions/:id` (teacher)

## Submission Flow
- `POST /api/submissions/submit` (student)
- `GET /api/submissions/my` (student)
- `GET /api/submissions/daily-status` (student, today-only status)
- `GET /api/submissions/test/:testId` (teacher)
- `GET /api/submissions/export/:testId` (teacher)

## Materials
- `POST /api/materials` (teacher, PDF upload)
- `GET /api/materials/student` (student)
- `GET /api/materials/teacher` (teacher)
- `GET /api/materials/:id/file` (student/teacher/admin with access checks)

## Lectures (YouTube)
- `POST /api/lectures` (teacher)
- `GET /api/lectures/teacher` (teacher)
- `PUT /api/lectures/:id` (teacher, own lecture)
- `PATCH /api/lectures/:id/publish` (teacher, own lecture)
- `DELETE /api/lectures/:id` (teacher, own lecture)
- `GET /api/lectures/student` (student, only published lectures from connected teachers, supports `?subject=...`)
- `POST /api/lectures/:id/view` (student, auto-mark attendance as present)
- `GET /api/lectures/:id/attendance` (teacher, only own lecture, returns connected students with Present/Absent)

## Admin
- `GET /api/admin/dashboard`
- `GET /api/admin/logs`
- `GET /api/admin/users`
- `PATCH /api/admin/users/:id/role`
- `PATCH /api/admin/users/:id/status`
- `DELETE /api/admin/users/:id`
- `GET /api/admin/teachers`
- `GET /api/admin/materials`
- `PATCH /api/admin/materials/:id/status`
- `DELETE /api/admin/materials/:id`
- `DELETE /api/admin/test-attempts/stale?graceHours=24&limit=500` (cleanup stale attempts)

## Required Environment Variables
- `PORT` (default `8080`)
- `MONGO_URI`
- `JWT_SECRET`
- `JWT_EXP` (default `7d`)
- `CORS_ORIGIN` (comma-separated origins)
- `GOOGLE_CLIENT_ID`
- `GEMINI_API_KEY` (required for AI endpoints)

## Test Attempt Cleanup (stale timer sessions)
- `TEST_ATTEMPT_AUTO_CLEAN_ENABLED`:
  - `true` to force enable
  - `false` to force disable
  - if omitted, enabled automatically when `NODE_ENV=production`
- `TEST_ATTEMPT_AUTO_CLEAN_INTERVAL_MINUTES` (default `60`)
- `TEST_ATTEMPT_CLEANUP_GRACE_HOURS` (default `24`)

The cleanup job logs every startup/interval run with deleted counts.

## Parent
- `GET /api/parents/dashboard`
- `GET /api/parents/children`
- `GET /api/parents/results/:studentId`
- `GET /api/parents/ai-summary/:studentId`
- `GET /api/parents/notifications/daily` (daily student summary for linked children)
- `POST /api/parents/link`
