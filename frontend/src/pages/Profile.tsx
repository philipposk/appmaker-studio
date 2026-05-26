import React from 'react';
import { useAppSelector } from '../utils/hooks';
import './Profile.scss';

const Profile: React.FC = () => {
  const { user } = useAppSelector((state) => state.auth);

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <div className="profile-page">
      <h1>Profile Settings</h1>
      
      <div className="profile-content">
        <div className="card">
          <div className="card__header">
            <h2>Account Information</h2>
          </div>
          <div className="card__content">
            <div className="info-row">
              <span className="info-label">Username:</span>
              <span className="info-value">{user.username}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Email:</span>
              <span className="info-value">{user.email}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Role:</span>
              <span className="info-value">{user.role}</span>
            </div>
            {user.profile?.firstName && (
              <div className="info-row">
                <span className="info-label">First Name:</span>
                <span className="info-value">{user.profile.firstName}</span>
              </div>
            )}
            {user.profile?.lastName && (
              <div className="info-row">
                <span className="info-label">Last Name:</span>
                <span className="info-value">{user.profile.lastName}</span>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card__header">
            <h2>Subscription</h2>
          </div>
          <div className="card__content">
            <div className="info-row">
              <span className="info-label">Plan:</span>
              <span className="info-value">{user.subscription?.plan || 'free'}</span>
            </div>
            <div className="info-row">
              <span className="info-label">App Limit:</span>
              <span className="info-value">{user.subscription?.maxApps || 3}</span>
            </div>
          </div>
        </div>

        {user.notifications !== undefined && (
          <div className="card">
            <div className="card__header">
              <h2>Notifications</h2>
            </div>
            <div className="card__content">
              <div className="info-row">
                <span className="info-label">Unread:</span>
                <span className="info-value">{user.notifications}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Profile;

