import { useState, useEffect } from 'react';
import api from '../lib/api';
import { formatServerDateTime } from '../lib/datetime';

export const NotificationBell = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    fetchNotifications();
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
      await api.patch(`/notifications/${id}/read`);
      fetchNotifications();
      fetchUnreadCount();
    } catch (err) {
      console.error('Failed to mark as read');
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      fetchNotifications();
      fetchUnreadCount();
    } catch (err) {
      console.error('Failed to mark all as read');
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'task': return '📋';
      case 'update': return '🔄';
      case 'mention': return '💬';
      default: return '🔔';
    }
  };

  return (
    <div style={styles.container}>
      <button style={styles.bell} onClick={() => setShowDropdown(!showDropdown)}>
        🔔
        {unreadCount > 0 && <span style={styles.badge}>{unreadCount}</span>}
      </button>

      {showDropdown && (
        <div style={styles.dropdown}>
          <div style={styles.header}>
            <h4 style={styles.headerTitle}>Notifications</h4>
            {unreadCount > 0 && (
              <button style={styles.markAllBtn} onClick={markAllAsRead}>
                Mark all read
              </button>
            )}
          </div>

          <div style={styles.list}>
            {notifications.length === 0 ? (
              <div style={styles.empty}>No notifications</div>
            ) : (
              notifications.map(notif => (
                <div
                  key={notif.id}
                  style={{
                    ...styles.item,
                    background: notif.is_read ? '#f5f5f5' : 'white'
                  }}
                  onClick={() => !notif.is_read && markAsRead(notif.id)}
                >
                  <span style={styles.icon}>{getTypeIcon(notif.type)}</span>
                    <div style={styles.content}>
                      <div style={styles.title}>{notif.title}</div>
                      <div style={styles.message}>{notif.message}</div>
                      <div style={styles.time}>
                        {formatServerDateTime(notif.created_at)}
                      </div>
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
    background: 'none',
    border: 'none',
    fontSize: '1.5rem',
    cursor: 'pointer',
    padding: '0.5rem',
    position: 'relative'
  },
  badge: {
    position: 'absolute',
    top: '0',
    right: '0',
    background: '#dc3545',
    color: 'white',
    borderRadius: '50%',
    fontSize: '0.7rem',
    padding: '0.2rem 0.4rem',
    minWidth: '18px',
    textAlign: 'center'
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    right: '0',
    width: '350px',
    background: 'white',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    zIndex: 1000,
    overflow: 'hidden'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.75rem 1rem',
    borderBottom: '1px solid #eee'
  },
  headerTitle: {
    margin: 0,
    fontSize: '1rem'
  },
  markAllBtn: {
    background: 'none',
    border: 'none',
    color: '#007bff',
    cursor: 'pointer',
    fontSize: '0.85rem'
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
    padding: '0.75rem 1rem',
    borderBottom: '1px solid #eee',
    cursor: 'pointer'
  },
  icon: {
    fontSize: '1.25rem'
  },
  content: {
    flex: 1
  },
  title: {
    fontWeight: 'bold',
    fontSize: '0.9rem',
    marginBottom: '0.25rem'
  },
  message: {
    fontSize: '0.85rem',
    color: '#666',
    marginBottom: '0.25rem'
  },
  time: {
    fontSize: '0.75rem',
    color: '#999'
  }
};
