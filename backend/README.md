# EduNesta Backend (Node + Express + MongoDB)

## Setup
1. clone repo
2. `cd edunesta-backend`
3. `npm install`
4. create `.env` (use example in repo)
5. start local MongoDB (or set MONGO_URI to Atlas)
6. `npm run dev` (requires nodemon) or `npm start`

## Endpoints (high-level)
- `POST /api/auth/register` {name,email,password,role}
- `POST /api/auth/login` {email,password}
- `POST /api/tests` (teacher) create test
- `GET /api/tests` list tests
- `GET /api/tests/:id` get test details
- `POST /api/questions` add question (teacher)
- `POST /api/submissions/autosave` autosave partial answers (student)
- `POST /api/submissions/submit` submit + auto-grade (student)
- `POST /api/materials` upload materials (teacher)
- `GET /api/materials` list materials

## File uploads
Uploaded files are saved under `uploads/` and served statically at `/uploads/<filename>`.
