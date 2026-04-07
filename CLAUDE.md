# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project Overview

Employee Task Tracking Web App - a SaaS-style application with role-based task management features.

## Strict Execution Rules

### Mandatory Reading
- Always read `docs/memory.md` before starting
- Always follow `docs/roadmap.md`
- Always follow `docs/skills.md`

### Phase Control
- Do not skip phases
- Complete Phase 1 fully before Phase 2
- Complete Phase 2 fully before Phase 3
- If a phase is incomplete, continue that phase first

### Memory System
- After every feature, update `docs/memory.md`
- Track completed, in-progress, and pending features
- If a session breaks, resume from `docs/memory.md`

## Architecture

```text
/project-root
|-- frontend/           # React + Vite
|-- backend/            # Express + Node.js
|-- database/           # SQLite database file and notes
`-- docs/               # Documentation
```

## Commands

### Backend
```bash
cd backend
npm install
npm run dev
npm start
```

Environment variables:

- `PORT` - backend server port
- `DATABASE_PATH` - SQLite database path, relative to project root or absolute
- `JWT_SECRET` - JWT signing secret
- `JWT_EXPIRES_IN` - token lifetime

### Frontend
```bash
cd frontend
npm install
npm run dev
npm run build
```

## API Endpoints

### Auth
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login

### Tasks
- `GET /api/tasks` - Get all tasks
- `GET /api/tasks/my` - Get my assigned tasks
- `GET /api/tasks/analytics` - Get admin analytics
- `GET /api/tasks/:id` - Get single task
- `POST /api/tasks` - Create task
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task
- `PATCH /api/tasks/:id/status` - Update employee task status

### Employees
- `GET /api/employees` - List all employees

### Comments
- `GET /api/comments?task_id=:taskId` - List task comments
- `POST /api/comments` - Add comment to a task
- `DELETE /api/comments/:id` - Delete a comment

### Notifications
- `GET /api/notifications` - Get notifications
- `GET /api/notifications/unread-count` - Get unread count
- `PATCH /api/notifications/:id/read` - Mark one notification as read
- `PATCH /api/notifications/read-all` - Mark all notifications as read

## Important Files

- `MASTER_PROMPT.md` - Project specification
- `docs/memory.md` - Development state tracker
- `docs/roadmap.md` - Phase plan
- `docs/skills.md` - Agent behavior guidance
- `database/tasktracker.db` - Default SQLite database location

## Phase Status

- Phase 1: Complete
- Phase 2: Complete
- Phase 3: In progress

Phase 3 features already present in code include comments, notifications, and admin analytics.
