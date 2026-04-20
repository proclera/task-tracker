import { useEffect, useState } from 'react';
import api from '../lib/api';
import { formatServerDateTime } from '../lib/datetime';

export const NotificationBellModern = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    fetchNotifications();
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = async () => {
    try {
      const response = await api.get('/notifications');
      setNotifications(response.data.notifications || []);
    } catch (err) {
      console.error('Failed to fetch notifications');
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const response = await api.get('/notifications/unread-count');
      setUnreadCount(response.data.unreadCount || 0);
    } catch (err) {
      console.error('Failed to fetch unread count');
    }
  };

  const markAsRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`, {});
      fetchNotifications();
      fetchUnreadCount();
    } catch (err) {
      console.error('Failed to mark as read');
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.patch('/notifications/read-all', {});
      fetchNotifications();
      fetchUnreadCount();
    } catch (err) {
      console.error('Failed to mark all as read');
    }
  };

  const getTypeLabel = (type) => {
    switch (type) {
      case 'task':
        return '[Task]';
      case 'update':
        return '[Update]';
      case 'mention':
        return '[Note]';
      case 'overdue':
        return '[Due]';
      default:
        return '[Bell]';
    }
  };

  return (
    <div style={styles.container}>
      <button type="button" style={styles.bell} onClick={() => setShowDropdown((current) => !current)}>
        <span>Notifications</span>
        {unreadCount > 0 && <span style={styles.badge}>{unreadCount}</span>}
      </button>

      {showDropdown && (
        <div style={styles.dropdown}>
          <div style={styles.header}>
            <h4 style={styles.headerTitle}>Notifications</h4>
            {unreadCount > 0 && (
              <button type="button" style={styles.markAllBtn} onClick={markAllAsRead}>
                Mark all read
              </button>
            )}
          </div>

          <div style={styles.list}>
            {notifications.length === 0 ? (
              <div style={styles.empty}>No notifications</div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  style={{
                    ...styles.item,
                    background: notification.is_read ? '#f5f5f5' : 'white'
                  }}
                  onClick={() => !notification.is_read && markAsRead(notification.id)}
                >
                  <span style={styles.icon}>{getTypeLabel(notification.type)}</span>
                  <div style={styles.content}>
                    <div style={styles.title}>{notification.title}</div>
                    <div style={styles.message}>{notification.message}</div>
                    <div style={styles.time}>{formatServerDateTime(notification.created_at)}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    position: 'relative'
  },
  bell: {
    background: 'white',
    border: '1px solid #d7deea',
    borderRadius: '999px',
    fontSize: '0.92rem',
    cursor: 'pointer',
    padding: '0.55rem 0.9rem',
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    color: '#274266',
    fontWeight: 700
  },
  badge: {
    background: '#dc3545',
    color: 'white',
    borderRadius: '999px',
    fontSize: '0.72rem',
    padding: '0.18rem 0.42rem',
    minWidth: '18px',
    textAlign: 'center'
  },
  dropdown: {
    position: 'absolute',
    top: 'calc(100% + 10px)',
    right: '0',
    width: '350px',
    background: 'white',
    borderRadius: '14px',
    boxShadow: '0 18px 42px rgba(31, 45, 76, 0.18)',
    zIndex: 1000,
    overflow: 'hidden',
    border: '1px solid #e3e8f2'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.9rem 1rem',
    borderBottom: '1px solid #eef2f7'
  },
  headerTitle: {
    margin: 0,
    fontSize: '1rem',
    color: '#183153'
  },
  markAllBtn: {
    background: 'none',
    border: 'none',
    color: '#1e63d4',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 700
  },
  list: {
    maxHeight: '400px',
    overflowY: 'auto'
  },
  empty: {
    padding: '2rem',
    textAlign: 'center',
    color: '#666'
  },
  item: {
    display: 'flex',
    gap: '0.75rem',
    padding: '0.9rem 1rem',
    borderBottom: '1px solid #eef2f7',
    cursor: 'pointer'
  },
  icon: {
    fontSize: '0.74rem',
    fontWeight: 800,
    color: '#667a98',
    paddingTop: '0.2rem'
  },
  content: {
    flex: 1
  },
  title: {
    fontWeight: 'bold',
    fontSize: '0.9rem',
    marginBottom: '0.25rem',
    color: '#183153'
  },
  message: {
    fontSize: '0.85rem',
    color: '#666',
    marginBottom: '0.25rem',
    lineHeight: 1.45
  },
  time: {
    fontSize: '0.75rem',
    color: '#999'
  }
};
