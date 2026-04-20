# Task Tracker App

Employee task tracking web app with a React frontend, Express backend, and SQLite persistence via `sql.js`.

Current implemented features include authentication, task assignment and tracking, task comments, notifications, and admin analytics.

Email notifications are supported through Resend. Set `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, and `EMAIL_FROM` in [backend/.env.example](/e:/VS%20Claude%20code/Task%20Tracker/backend/.env.example) or your real backend env file to send assignment and task update emails to employees/admins.
