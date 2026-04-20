const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { getDB } = require('./config/database');

dotenv.config();

const authRoutes = require('./routes/auth');
const taskRoutes = require('./routes/tasks');
const employeeRoutes = require('./routes/employees');
const commentRoutes = require('./routes/comments');
const notificationRoutes = require('./routes/notifications');
const timeEntryRoutes = require('./routes/timeEntries');
const attendanceRoutes = require('./routes/attendance');
const reportRoutes = require('./routes/reports');
const gamificationRoutes = require('./routes/gamification');
const { errorHandler } = require('./middleware/errorHandler');
const { securityHeaders, requireJsonBody } = require('./middleware/security');
const { enforceDesktopOnly } = require('./middleware/desktopOnly');

const app = express();
app.disable('x-powered-by');

const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('CORS origin not allowed'));
  }
}));
app.use(securityHeaders);
app.use(express.json({ limit: '100kb', strict: true }));
app.use(requireJsonBody);

app.get('/', (req, res) => {
  res.json({ message: 'Task Tracker API is running' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api', enforceDesktopOnly);
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/time-entries', timeEntryRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/gamification', gamificationRoutes);
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'dev-secret')) {
    console.error('JWT_SECRET must be configured in production');
    process.exit(1);
  }

  getDB()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
      });
    })
    .catch((error) => {
      console.error('Database startup error:', error);
      process.exit(1);
    });
}

module.exports = app;
