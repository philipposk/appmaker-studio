import React, { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../utils/hooks';
import { getMe } from '../../store/slices/authSlice';
import './Notifications.scss';

const Notifications: React.FC = () => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    if (user?.notifications !== undefined) {
      // Refresh user data periodically to get latest notifications
      const interval = setInterval(() => {
        dispatch(getMe());
      }, 30000); // Every 30 seconds

      return () => clearInterval(interval);
    }
  }, [dispatch, user]);

  const unreadCount = user?.notifications || 0;

  return (
    <div className="notifications">
      <button
        className="notification-button"
        onClick={() => setShowDropdown(!showDropdown)}
        title="Notifications"
      >
        🔔
        {unreadCount > 0 && (
          <span className="notification-badge">{unreadCount}</span>
        )}
      </button>

      {showDropdown && (
        <div className="notification-dropdown">
          <div className="notification-header">
            <h3>Notifications</h3>
            {unreadCount > 0 && (
              <button className="btn btn--small">Mark all as read</button>
            )}
          </div>
          <div className="notification-list">
            {unreadCount === 0 ? (
              <div className="notification-empty">
                <p>No new notifications</p>
              </div>
            ) : (
              <div className="notification-item">
                <p>You have {unreadCount} new notification{unreadCount > 1 ? 's' : ''}</p>
                <small>Click here to view all notifications</small>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Notifications;

