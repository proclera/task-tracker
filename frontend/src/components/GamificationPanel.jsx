import { useEffect, useMemo, useState } from 'react';
import api from '../lib/api';

const BADGE_META = {
  first_win: { icon: 'FW', tone: '#275cae', bg: '#e7f0ff' },
  task_master_10: { icon: 'TM', tone: '#0d8a58', bg: '#e6f8ee' },
  century_points: { icon: 'CP', tone: '#985f09', bg: '#fff4de' },
  streak_3: { icon: 'S3', tone: '#6a2ba9', bg: '#f1e8ff' },
  streak_7: { icon: 'S7', tone: '#b11d53', bg: '#ffe5f0' }
};

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const prettifyEvent = (value) => String(value || '').replaceAll('_', ' ');

const toDateKey = (date) => date.toISOString().slice(0, 10);
const getDayLabel = (dateKey) => Number(dateKey.slice(8, 10));
const getMonthStart = (date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));

const addMonths = (monthStart, offset) =>
  new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + offset, 1));

const buildMonthGrid = (monthStart) => {
  const startWeekday = monthStart.getUTCDay();
  const daysInMonth = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0)).getUTCDate();
  const cells = [];

  for (let i = 0; i < startWeekday; i += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), day));
    cells.push(toDateKey(date));
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
};

export const GamificationPanel = () => {
  const [stats, setStats] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [visibleMonth, setVisibleMonth] = useState(() => getMonthStart(new Date()));
  const currentMonth = useMemo(() => getMonthStart(new Date()), []);

  const loadGamification = async () => {
    try {
      setLoading(true);
      setError('');

      const [statsResponse, leaderboardResponse] = await Promise.all([
        api.get('/gamification/me'),
        api.get('/gamification/leaderboard', { params: { limit: 5 } })
      ]);

      setStats(statsResponse.data.gamification);
      setLeaderboard(leaderboardResponse.data.leaderboard || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load gamification');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGamification();
  }, []);

  const attendanceMap = useMemo(() => {
    const map = new Map();
    for (const day of stats?.streakCalendar || []) {
      map.set(day.date, day.status);
    }
    return map;
  }, [stats?.streakCalendar]);

  const monthCells = useMemo(() => buildMonthGrid(visibleMonth), [visibleMonth]);
  const monthLabel = useMemo(
    () => new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(visibleMonth),
    [visibleMonth]
  );
  const canGoNext = visibleMonth.getTime() < currentMonth.getTime();

  if (loading) {
    return (
      <section style={styles.section}>
        <div style={styles.loading}>Loading progress rewards...</div>
      </section>
    );
  }

  return (
    <section style={styles.section}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Progress & Rewards</h2>
          <p style={styles.subtitle}>Stay motivated with points, streaks, badges, and calendar consistency.</p>
        </div>
        <button type="button" style={styles.refreshBtn} onClick={loadGamification}>
          Refresh
        </button>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {stats && (
        <div style={styles.statsGrid}>
          <StatCard label="Total Points" value={stats.totalPoints} />
          <StatCard label="Current Streak" value={`${stats.currentStreak} days`} />
          <StatCard label="Longest Streak" value={`${stats.longestStreak} days`} />
          <StatCard label="Completed Tasks" value={stats.completedTasks} />
        </div>
      )}

      <div style={styles.columns}>
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>My Badges</h3>
          {!stats?.badges?.length ? (
            <div style={styles.empty}>Complete activities to unlock badges.</div>
          ) : (
            <div style={styles.badges}>
              {stats.badges.map((badge) => {
                const meta = BADGE_META[badge.key] || { icon: 'BG', tone: '#1f4b86', bg: '#e6f0ff' };

                return (
                  <div key={badge.key} style={styles.badgeCard}>
                    <div style={{ ...styles.badgeIcon, background: meta.bg, color: meta.tone }}>
                      {meta.icon}
                    </div>
                    <div style={styles.badgeBody}>
                      <div style={styles.badgeTitle}>{badge.name}</div>
                      <div style={styles.badgeDate}>Unlocked</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Top Performers</h3>
          {!leaderboard.length ? (
            <div style={styles.empty}>No leaderboard data yet.</div>
          ) : (
            <div style={styles.leaderboard}>
              {leaderboard.map((entry) => (
                <div key={entry.userId} style={styles.entry}>
                  <div style={styles.entryName}>#{entry.rank} {entry.name}</div>
                  <div style={styles.entryMeta}>{entry.totalPoints} pts | {entry.currentStreak}d streak</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={styles.card}>
        <div style={styles.calendarToolbar}>
          <h3 style={styles.cardTitle}>Streak Calendar</h3>
          <div style={styles.calendarNav}>
            <button
              type="button"
              style={styles.navButton}
              onClick={() => setVisibleMonth((month) => addMonths(month, -1))}
            >
              Prev
            </button>
            <span style={styles.monthLabel}>{monthLabel}</span>
            <button
              type="button"
              style={{ ...styles.navButton, ...(canGoNext ? null : styles.navButtonDisabled) }}
              onClick={() => canGoNext && setVisibleMonth((month) => addMonths(month, 1))}
              disabled={!canGoNext}
            >
              Next
            </button>
          </div>
        </div>
        <div style={styles.weekdays}>
          {WEEKDAY_LABELS.map((day) => (
            <span key={day} style={styles.weekday}>{day}</span>
          ))}
        </div>
        <div style={styles.calendarGrid}>
          {monthCells.map((dateKey, index) => {
            if (!dateKey) {
              return <div key={`empty-${index}`} style={{ ...styles.calendarCell, ...styles.calendarCellEmpty }} />;
            }

            const status = attendanceMap.get(dateKey);
            const cellStyle =
              status === 'present'
                ? styles.calendarCellPresent
                : status === 'late'
                  ? styles.calendarCellLate
                  : styles.calendarCellMiss;

            return (
              <div key={dateKey} style={{ ...styles.calendarCell, ...cellStyle }} title={`${dateKey}${status ? ` (${status})` : ''}`}>
                {getDayLabel(dateKey)}
              </div>
            );
          })}
        </div>
        <div style={styles.legend}>
          <span style={styles.legendItem}><span style={{ ...styles.legendDot, background: '#34a068' }} /> Present</span>
          <span style={styles.legendItem}><span style={{ ...styles.legendDot, background: '#d28614' }} /> Late</span>
          <span style={styles.legendItem}><span style={{ ...styles.legendDot, background: '#d9e3f2' }} /> No check-in</span>
        </div>
      </div>

      <div style={styles.card}>
        <h3 style={styles.cardTitle}>Recent Point Events</h3>
        {!stats?.recentEvents?.length ? (
          <div style={styles.empty}>No events yet.</div>
        ) : (
          <div style={styles.events}>
            {stats.recentEvents.map((event, index) => (
              <div key={`${event.type}-${event.createdAt}-${index}`} style={styles.event}>
                <span style={styles.eventType}>{prettifyEvent(event.type)}</span>
                <span style={styles.eventPoints}>+{event.points} pts</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

const StatCard = ({ label, value }) => (
  <div style={styles.statCard}>
    <div style={styles.statLabel}>{label}</div>
    <div style={styles.statValue}>{value}</div>
  </div>
);

const styles = {
  section: {
    marginBottom: '1.5rem'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '1rem',
    marginBottom: '1rem'
  },
  title: {
    margin: 0,
    color: '#183153'
  },
  subtitle: {
    margin: '0.35rem 0 0',
    color: '#60738f'
  },
  refreshBtn: {
    border: '1px solid #cfdcf0',
    borderRadius: '12px',
    background: 'white',
    padding: '0.65rem 0.95rem',
    fontWeight: 700,
    cursor: 'pointer',
    color: '#22456f'
  },
  loading: {
    padding: '1rem',
    borderRadius: '12px',
    background: '#eef4ff',
    color: '#35557f'
  },
  error: {
    padding: '0.85rem',
    borderRadius: '12px',
    marginBottom: '1rem',
    background: '#ffe7e7',
    color: '#9f2323'
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
    gap: '0.9rem',
    marginBottom: '1rem'
  },
  statCard: {
    background: 'white',
    borderRadius: '16px',
    border: '1px solid #dce5f3',
    padding: '1rem'
  },
  statLabel: {
    color: '#667892',
    fontSize: '0.85rem',
    marginBottom: '0.3rem'
  },
  statValue: {
    color: '#173053',
    fontWeight: 800,
    fontSize: '1.35rem'
  },
  columns: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: '1rem',
    marginBottom: '1rem'
  },
  card: {
    background: 'white',
    borderRadius: '16px',
    border: '1px solid #dce5f3',
    padding: '1rem'
  },
  cardTitle: {
    marginTop: 0,
    color: '#173053'
  },
  empty: {
    padding: '0.75rem',
    borderRadius: '12px',
    background: '#f4f8ff',
    color: '#60738f'
  },
  badges: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.65rem'
  },
  badgeCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.7rem',
    padding: '0.7rem',
    borderRadius: '12px',
    background: '#f7faff',
    border: '1px solid #e4ecfa'
  },
  badgeIcon: {
    width: '42px',
    height: '42px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.82rem',
    fontWeight: 800,
    letterSpacing: '0.04em'
  },
  badgeBody: {
    minWidth: 0
  },
  badgeTitle: {
    color: '#1f4b86',
    fontWeight: 700
  },
  badgeDate: {
    color: '#60738f',
    fontSize: '0.82rem',
    marginTop: '0.15rem'
  },
  leaderboard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.55rem'
  },
  entry: {
    padding: '0.65rem 0.75rem',
    borderRadius: '12px',
    background: '#f4f8ff'
  },
  entryName: {
    fontWeight: 700,
    color: '#1e3a5f'
  },
  entryMeta: {
    marginTop: '0.2rem',
    color: '#60738f',
    fontSize: '0.85rem'
  },
  weekdays: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
    gap: '0.35rem',
    marginBottom: '0.45rem'
  },
  calendarToolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '0.8rem',
    marginBottom: '0.5rem',
    flexWrap: 'wrap'
  },
  calendarNav: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem'
  },
  navButton: {
    border: '1px solid #d1ddf0',
    background: 'white',
    borderRadius: '10px',
    padding: '0.35rem 0.6rem',
    fontWeight: 700,
    color: '#35557f',
    cursor: 'pointer'
  },
  navButtonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed'
  },
  monthLabel: {
    minWidth: '128px',
    textAlign: 'center',
    fontWeight: 700,
    color: '#1e3a5f'
  },
  weekday: {
    fontSize: '0.74rem',
    textAlign: 'center',
    color: '#60738f',
    fontWeight: 700
  },
  calendarGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
    gap: '0.35rem'
  },
  calendarCell: {
    borderRadius: '10px',
    height: '34px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.78rem',
    fontWeight: 700
  },
  calendarCellPresent: {
    background: '#dff4e8',
    color: '#196445'
  },
  calendarCellLate: {
    background: '#fff0d9',
    color: '#9b5e00'
  },
  calendarCellMiss: {
    background: '#edf2f9',
    color: '#8da0bd'
  },
  calendarCellEmpty: {
    background: 'transparent',
    border: '1px dashed #edf2f9',
    color: 'transparent'
  },
  legend: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.85rem',
    marginTop: '0.7rem'
  },
  legendItem: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    color: '#60738f',
    fontSize: '0.8rem',
    fontWeight: 600
  },
  legendDot: {
    width: '10px',
    height: '10px',
    borderRadius: '999px',
    display: 'inline-block'
  },
  events: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem'
  },
  event: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.65rem 0.75rem',
    borderRadius: '12px',
    background: '#f4f8ff'
  },
  eventType: {
    textTransform: 'capitalize',
    color: '#35557f',
    fontWeight: 600
  },
  eventPoints: {
    color: '#0f8b46',
    fontWeight: 800
  }
};
