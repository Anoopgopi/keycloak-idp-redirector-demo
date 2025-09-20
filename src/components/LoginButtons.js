import React, { useState, useEffect } from 'react';
import { KeycloakProvider } from '../providers/keycloak/KeycloakProvider';
import logger from '../utils/logger';

const LoginButtons = () => {
  const REDIRECT_URI = window.location.origin + '/callback';
  
  const [userInfo, setUserInfo] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [keycloakProvider] = useState(() => new KeycloakProvider());
  const [email, setEmail] = useState('');

  useEffect(() => {
    // Check if user is already logged in
    const accessToken = localStorage.getItem('access_token');
    const storedUserInfo = localStorage.getItem('user_info');
    
    if (accessToken && storedUserInfo) {
      try {
        const user = JSON.parse(storedUserInfo);
        setUserInfo(user);
        setIsLoggedIn(true);
        
        logger.log('User is logged in:', {
          provider: 'keycloak',
          user: user?.name
        });
      } catch (error) {
        logger.error('Error parsing stored user info:', error);
        // Clear invalid data
        localStorage.removeItem('access_token');
        localStorage.removeItem('user_info');
      }
    } else {
      logger.log('User is not logged in');
    }
  }, []);

  // Handle login with email-based IDP routing
  const handleLogin = async () => {
    if (!keycloakProvider.isConfigured()) {
      alert('Keycloak is not configured. Please check your environment variables.');
      return;
    }
    
    try {
      let loginHint = null;
      
      // If email is provided, determine the IDP hint
      if (email.trim()) {
        if (!keycloakProvider.isValidEmail(email.trim())) {
          alert('Please enter a valid email address');
          return;
        }
        loginHint = keycloakProvider.determineLoginHintFromEmail(email.trim());
        logger.log('Email provided:', email.trim(), '-> IDP hint:', loginHint);
      }
      
      // Use the Keycloak provider with the determined login hint
      await keycloakProvider.login(REDIRECT_URI, loginHint);
    } catch (error) {
      logger.error('Error initiating login:', error);
      alert(`Failed to initiate login: ${error.message}`);
    }
  };

  // Handle logout
  const handleLogout = async () => {
    logger.log('Logout button clicked');
    try {
      await keycloakProvider.logout();
      
      // Clear local state
      setUserInfo(null);
      setIsLoggedIn(false);
      
      logger.log('Logout completed');
    } catch (error) {
      logger.error('Logout error:', error);
      // Still clear local state even if provider logout fails
      keycloakProvider.clearLocalStorage();
      setUserInfo(null);
      setIsLoggedIn(false);
    }
  };



  if (isLoggedIn && userInfo) {
    return (
      <div style={styles.container}>
        <div style={styles.userInfo}>
          <h1 style={styles.welcomeTitle}>Welcome Back!</h1>
          
          <div style={styles.userCard}>
            <div style={styles.userDetail}>
              <span style={styles.userLabel}>Name:</span> {userInfo.name}
            </div>
            <div style={styles.userDetail}>
              <span style={styles.userLabel}>Email:</span> {userInfo.email}
            </div>
            <div style={styles.userDetail}>
              <span style={styles.userLabel}>Provider:</span> Keycloak
            </div>
            {userInfo.picture && (
              <img 
                src={userInfo.picture} 
                alt="Profile" 
                style={styles.avatar}
              />
            )}
          </div>

          <div style={styles.buttonContainer}>
            <button
              onClick={handleLogout}
              style={{ ...styles.button, ...styles.logoutButton }}
            >
              Logout from Keycloak
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Keycloak IDP Redirector Demo</h1>
        <p style={styles.subtitle}>
          Automatic identity provider routing based on email domain
        </p>

        <div style={styles.emailContainer}>
          <label style={styles.emailLabel}>
            Email Address:
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email address"
            style={styles.emailInput}
          />
          
          <div style={styles.detectionCard}>
            <div style={styles.detectionTitle}>
              🔍 Automatic Identity Provider Detection:
            </div>
            <ul style={styles.providerList}>
              <li style={styles.providerItem}>
                <strong>Gmail addresses</strong> (user@gmail.com) → Google login
              </li>
              <li style={styles.providerItem}>
                <strong>Microsoft addresses</strong> (user@outlook.com, user@hotmail.com) → Microsoft login
              </li>
              <li style={styles.providerItem}>
                <strong>Other addresses</strong> → Standard Keycloak login
              </li>
            </ul>
          </div>
        </div>

        <div style={styles.buttonContainer}>
          <button
            onClick={handleLogin}
            style={styles.button}
          >
            Login
          </button>
        </div>

        <div style={styles.info}>
          <div style={styles.infoItem}>
            <span><strong>Secure Authentication:</strong> Uses OAuth 2.0 with PKCE flow</span>
          </div>
          <div style={styles.infoItem}>
            <span><strong>Identity Provider Routing:</strong> Automatically routes to Google or Microsoft based on email domain</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: '20px',
    boxSizing: 'border-box'
  },
  card: {
    backgroundColor: 'white',
    borderRadius: '20px',
    padding: '40px',
    boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
    maxWidth: '500px',
    width: '100%',
    textAlign: 'center',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255,255,255,0.2)'
  },
  title: {
    fontSize: '2.5rem',
    fontWeight: '700',
    color: '#2d3748',
    marginBottom: '0.5rem',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text'
  },
  subtitle: {
    fontSize: '1.1rem',
    color: '#718096',
    marginBottom: '2.5rem',
    lineHeight: '1.6'
  },
  emailContainer: {
    marginBottom: '2rem',
    textAlign: 'left'
  },
  emailLabel: {
    display: 'block',
    fontSize: '1rem',
    fontWeight: '600',
    color: '#4a5568',
    marginBottom: '0.75rem'
  },
  emailInput: {
    width: '100%',
    padding: '16px 20px',
    fontSize: '16px',
    border: '2px solid #e2e8f0',
    borderRadius: '12px',
    outline: 'none',
    transition: 'all 0.3s ease',
    backgroundColor: '#f7fafc',
    boxSizing: 'border-box'
  },
  detectionCard: {
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '20px',
    marginTop: '1.5rem',
    textAlign: 'left'
  },
  detectionTitle: {
    fontSize: '0.95rem',
    fontWeight: '600',
    color: '#4a5568',
    marginBottom: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  providerList: {
    listStyle: 'none',
    padding: 0,
    margin: 0
  },
  providerItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 0',
    fontSize: '0.9rem',
    color: '#718096'
  },
  buttonContainer: {
    marginTop: '2rem'
  },
  button: {
    width: '100%',
    padding: '16px 24px',
    fontSize: '1.1rem',
    fontWeight: '600',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
    transform: 'translateY(0)',
    outline: 'none'
  },
  buttonHover: {
    transform: 'translateY(-2px)',
    boxShadow: '0 8px 25px rgba(102, 126, 234, 0.6)'
  },
  buttonIcon: {
    fontSize: '1.3rem'
  },
  info: {
    marginTop: '2rem',
    padding: '16px',
    backgroundColor: '#edf2f7',
    borderRadius: '10px',
    fontSize: '0.9rem',
    color: '#4a5568',
    lineHeight: '1.5'
  },
  infoItem: {
    margin: '8px 0',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px'
  },
  // Logged in user styles
  userInfo: {
    backgroundColor: 'white',
    borderRadius: '20px',
    padding: '40px',
    boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
    maxWidth: '500px',
    width: '100%',
    textAlign: 'center',
    border: '1px solid rgba(255,255,255,0.2)'
  },
  welcomeTitle: {
    fontSize: '2.2rem',
    fontWeight: '700',
    color: '#2d3748',
    marginBottom: '2rem',
    background: 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text'
  },
  userCard: {
    backgroundColor: '#f7fafc',
    borderRadius: '16px',
    padding: '30px',
    marginBottom: '2rem',
    border: '1px solid #e2e8f0'
  },
  userDetail: {
    margin: '12px 0',
    fontSize: '1rem',
    color: '#4a5568'
  },
  userLabel: {
    fontWeight: '600',
    color: '#2d3748'
  },
  avatar: {
    width: '100px',
    height: '100px',
    borderRadius: '50%',
    marginTop: '20px',
    border: '4px solid white',
    boxShadow: '0 8px 20px rgba(0,0,0,0.1)'
  },
  logoutButton: {
    background: 'linear-gradient(135deg, #f56565 0%, #e53e3e 100%)',
    boxShadow: '0 4px 15px rgba(245, 101, 101, 0.4)'
  },
  logoutButtonHover: {
    boxShadow: '0 8px 25px rgba(245, 101, 101, 0.6)'
  }
};

export default LoginButtons;