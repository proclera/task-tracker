# Database Folder

This folder contains the application's SQLite database file.

- Default path: `database/tasktracker.db`
- Override with backend env var: `DATABASE_PATH`
- Legacy path kept for backward compatibility: `backend/database/tasktracker.db`

The backend will read from the legacy location once if needed and persist future writes to this folder.
