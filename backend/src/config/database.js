const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

let db = null;

const projectRoot = path.resolve(__dirname, '../../..');
const defaultDbPath = path.join(projectRoot, 'database', 'tasktracker.db');
const legacyDbPath = path.join(projectRoot, 'backend', 'database', 'tasktracker.db');

function resolveDbPath() {
  if (process.env.DATABASE_PATH) {
    return path.isAbsolute(process.env.DATABASE_PATH)
      ? process.env.DATABASE_PATH
      : path.resolve(projectRoot, process.env.DATABASE_PATH);
  }

  return defaultDbPath;
}

const dbPath = resolveDbPath();

async function getDB() {
  if (db) return db;

  const SQL = await initSqlJs();

  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else if (dbPath === defaultDbPath && fs.existsSync(legacyDbPath)) {
    const buffer = fs.readFileSync(legacyDbPath);
    db = new SQL.Database(buffer);
    saveDB();
  } else {
    db = new SQL.Database();
  }

  ensureTablesExist(db);

  return db;
}

function ensureTablesExist(database) {
  createTables(database);
  ensureColumnsExist(database);
  saveDB();
}

function createTables(database) {
  database.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'employee')),
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  database.run(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
  database.run(`CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)`);

  database.run(`
    CREATE TABLE IF NOT EXISTS employee_profiles (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      department TEXT,
      position TEXT,
      hire_date TEXT,
      manager_id INTEGER REFERENCES users(id),
      avatar_url TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
      priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
      assignee_id INTEGER REFERENCES users(id),
      created_by INTEGER REFERENCES users(id),
      due_date TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  database.run(`CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id)`);
  database.run(`CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)`);

  database.run(`
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id),
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  database.run(`CREATE INDEX IF NOT EXISTS idx_comments_task ON comments(task_id)`);

  database.run(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'info',
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  database.run(`CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id)`);
  database.run(`CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read)`);

  database.run(`
    CREATE TABLE IF NOT EXISTS time_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      start_time DATETIME NOT NULL,
      end_time DATETIME,
      duration_minutes INTEGER DEFAULT 0,
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  database.run(`CREATE INDEX IF NOT EXISTS idx_time_entries_task ON time_entries(task_id)`);
  database.run(`CREATE INDEX IF NOT EXISTS idx_time_entries_user ON time_entries(user_id)`);
  database.run(`CREATE INDEX IF NOT EXISTS idx_time_entries_active ON time_entries(user_id, end_time)`);

  database.run(`
    CREATE TABLE IF NOT EXISTS attendance_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      attendance_date TEXT NOT NULL,
      check_in_time DATETIME NOT NULL,
      check_out_time DATETIME,
      total_minutes INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'late')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, attendance_date)
    )
  `);

  database.run(`CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON attendance_records(user_id, attendance_date)`);
  database.run(`CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_records(attendance_date)`);
}

function ensureColumnsExist(database) {
  ensureColumnExists(database, 'attendance_records', 'work_summary', 'TEXT');
}

function ensureColumnExists(database, tableName, columnName, definition) {
  const columnInfo = database.exec(`PRAGMA table_info(${tableName})`);
  const columns = columnInfo[0]?.values?.map((row) => row[1]) || [];

  if (!columns.includes(columnName)) {
    database.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

function saveDB() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(dbPath, buffer);
}

module.exports = { getDB, saveDB };
