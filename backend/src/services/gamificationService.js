const { getRow, getRows } = require('../utils/sql');

const BADGE_DEFINITIONS = [
  { key: 'first_win', name: 'First Win', condition: (stats) => stats.completedTasks >= 1 },
  { key: 'task_master_10', name: 'Task Master x10', condition: (stats) => stats.completedTasks >= 10 },
  { key: 'century_points', name: 'Century Points', condition: (stats) => stats.totalPoints >= 100 },
  { key: 'streak_3', name: '3-Day Streak', condition: (stats) => stats.currentStreak >= 3 },
  { key: 'streak_7', name: '7-Day Streak', condition: (stats) => stats.currentStreak >= 7 }
];

const ensureProfile = async (db, userId) => {
  await db.run(
    `INSERT INTO gamification_profiles (user_id)
     VALUES (?)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );
};

const getProfile = async (db, userId) => {
  await ensureProfile(db, userId);

  const profile = await getRow(
    db,
    `SELECT total_points, current_streak, longest_streak, last_activity_date
     FROM gamification_profiles
     WHERE user_id = ?`,
    [userId]
  );

  return {
    totalPoints: profile?.total_points || 0,
    currentStreak: profile?.current_streak || 0,
    longestStreak: profile?.longest_streak || 0,
    lastActivityDate: profile?.last_activity_date || null
  };
};

const awardPoints = async (db, userId, { eventType, points, referenceType = null, referenceId = null }) => {
  await ensureProfile(db, userId);

  const insertResult = await db.run(
    `INSERT INTO gamification_events (user_id, event_type, points, reference_type, reference_id)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (user_id, event_type, reference_type, reference_id) DO NOTHING
     RETURNING id`,
    [userId, eventType, points, referenceType, referenceId]
  );

  if (!insertResult.rows.length) {
    return { awarded: false, points: 0 };
  }

  await db.run(
    `UPDATE gamification_profiles
     SET total_points = total_points + ?, updated_at = CURRENT_TIMESTAMP
     WHERE user_id = ?`,
    [points, userId]
  );

  return { awarded: true, points };
};

const refreshStreakFromAttendance = async (db, userId) => {
  await ensureProfile(db, userId);

  const days = await getRows(
    db,
    `SELECT attendance_date
     FROM attendance_records
     WHERE user_id = ?
     GROUP BY attendance_date
     ORDER BY attendance_date DESC`,
    [userId]
  );

  let currentStreak = 0;
  let longestStreak = 0;
  let previousDate = null;

  for (const day of days) {
    const currentDate = new Date(`${day.attendance_date}T00:00:00.000Z`);

    if (!previousDate) {
      currentStreak = 1;
      longestStreak = Math.max(longestStreak, currentStreak);
      previousDate = currentDate;
      continue;
    }

    const diffDays = Math.round((previousDate - currentDate) / (24 * 60 * 60 * 1000));
    if (diffDays === 1) {
      currentStreak += 1;
      longestStreak = Math.max(longestStreak, currentStreak);
      previousDate = currentDate;
      continue;
    }

    break;
  }

  const overallLongest = Math.max(longestStreak, currentStreak);
  const lastActivityDate = days[0]?.attendance_date || null;

  await db.run(
    `UPDATE gamification_profiles
     SET current_streak = ?, longest_streak = GREATEST(longest_streak, ?), last_activity_date = ?, updated_at = CURRENT_TIMESTAMP
     WHERE user_id = ?`,
    [currentStreak, overallLongest, lastActivityDate, userId]
  );

  return { currentStreak, longestStreak: overallLongest };
};

const awardBadges = async (db, userId) => {
  const stats = await getGamificationStats(db, userId);
  const unlocked = [];

  for (const badge of BADGE_DEFINITIONS) {
    if (!badge.condition(stats)) {
      continue;
    }

    const insertResult = await db.run(
      `INSERT INTO user_badges (user_id, badge_key, badge_name)
       VALUES (?, ?, ?)
       ON CONFLICT (user_id, badge_key) DO NOTHING
       RETURNING id`,
      [userId, badge.key, badge.name]
    );

    if (insertResult.rows.length) {
      unlocked.push({ key: badge.key, name: badge.name });
    }
  }

  return unlocked;
};

const getGamificationStats = async (db, userId) => {
  const profile = await getProfile(db, userId);

  const completedTasksRow = await getRow(
    db,
    `SELECT COUNT(*)::int as count
     FROM task_assignments
     WHERE user_id = ? AND status = 'completed'`,
    [userId]
  );

  const badges = await getRows(
    db,
    `SELECT badge_key, badge_name, created_at
     FROM user_badges
     WHERE user_id = ?
     ORDER BY created_at DESC`,
    [userId]
  );

  const recentEvents = await getRows(
    db,
    `SELECT event_type, points, created_at
     FROM gamification_events
     WHERE user_id = ?
     ORDER BY created_at DESC
    LIMIT 10`,
    [userId]
  );

  const recentAttendance = await getRows(
    db,
    `SELECT attendance_date, status
     FROM attendance_records
     WHERE user_id = ?
       AND attendance_date >= (CURRENT_DATE - INTERVAL '400 day')
     ORDER BY attendance_date DESC`,
    [userId]
  );

  return {
    totalPoints: profile.totalPoints,
    currentStreak: profile.currentStreak,
    longestStreak: profile.longestStreak,
    completedTasks: completedTasksRow?.count || 0,
    badges: badges.map((badge) => ({
      key: badge.badge_key,
      name: badge.badge_name,
      awardedAt: badge.created_at
    })),
    recentEvents: recentEvents.map((event) => ({
      type: event.event_type,
      points: event.points,
      createdAt: event.created_at
    })),
    streakCalendar: recentAttendance.map((day) => ({
      date: day.attendance_date,
      status: day.status
    }))
  };
};

const getLeaderboard = async (db, limit = 10) => {
  const safeLimit = Math.max(1, Math.min(50, Number(limit) || 10));

  const rows = await getRows(
    db,
    `SELECT
       u.id,
       u.first_name,
       u.last_name,
       COALESCE(gp.total_points, 0)::int as total_points,
       COALESCE(gp.current_streak, 0)::int as current_streak,
       COALESCE(gp.longest_streak, 0)::int as longest_streak,
       COALESCE(task_stats.completed_tasks, 0)::int as completed_tasks
     FROM users u
     LEFT JOIN gamification_profiles gp ON gp.user_id = u.id
     LEFT JOIN (
       SELECT user_id, COUNT(*)::int as completed_tasks
       FROM task_assignments
       WHERE status = 'completed'
       GROUP BY user_id
     ) task_stats ON task_stats.user_id = u.id
     WHERE u.role = 'employee'
     ORDER BY total_points DESC, current_streak DESC, completed_tasks DESC, u.first_name ASC
     LIMIT ?`,
    [safeLimit]
  );

  return rows.map((row, index) => ({
    rank: index + 1,
    userId: row.id,
    name: `${row.first_name} ${row.last_name}`,
    totalPoints: row.total_points,
    currentStreak: row.current_streak,
    longestStreak: row.longest_streak,
    completedTasks: row.completed_tasks
  }));
};

module.exports = {
  awardPoints,
  refreshStreakFromAttendance,
  awardBadges,
  getGamificationStats,
  getLeaderboard
};
