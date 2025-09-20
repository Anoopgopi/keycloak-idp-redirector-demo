import { useEffect, useState } from 'react';
import { KeycloakProvider } from '../providers/keycloak/KeycloakProvider';
import logger from '../utils/logger';

const Callback = () => {
    const [status, setStatus] = useState('Processing...');
    const [userInfo, setUserInfo] = useState(null);
    const [identityProvider, setIdentityProvider] = useState(null);
    const [keycloakProvider] = useState(() => new KeycloakProvider());

    // Detect identity provider from email domain or session
    const detectIdentityProvider = (email) => {
        if (!email) return null;
        
        const domain = email.split('@')[1]?.toLowerCase();
        const domainMappings = {
            'gmail.com': 'Google',
            'googlemail.com': 'Google',
            'outlook.com': 'Microsoft',
            'hotmail.com': 'Microsoft',
            'live.com': 'Microsoft',
            'msn.com': 'Microsoft'
        };
        
        return domainMappings[domain] || 'Unknown Provider';
    };

    // Simple non-copyrighted logo components
    const MicrosoftLogo = () => (
        <div style={styles.logoContainer}>
            <div style={styles.microsoftGrid}>
                <div style={{...styles.microsoftSquare, backgroundColor: '#f25022'}}></div>
                <div style={{...styles.microsoftSquare, backgroundColor: '#7fba00'}}></div>
                <div style={{...styles.microsoftSquare, backgroundColor: '#00a4ef'}}></div>
                <div style={{...styles.microsoftSquare, backgroundColor: '#ffb900'}}></div>
            </div>
        </div>
    );

    const GoogleLogo = () => (
        <div style={styles.logoContainer}>
            <div style={styles.googleCircle}>
                <div style={styles.googleInner}>
                    <span style={styles.googleText}>G</span>
                </div>
            </div>
        </div>
    );

    const renderProviderLogo = (provider) => {
        if (provider === 'Microsoft') return <MicrosoftLogo />;
        if (provider === 'Google') return <GoogleLogo />;
        return null;
    };

    // Handle logout with proper backchannel IDP logout
    const handleLogout = async () => {
        logger.log('Initiating backchannel logout from identity provider:', identityProvider);
        
        // Show detailed logout status
        setStatus(`Logging out from ${identityProvider}...`);
        
        try {
            // Perform Keycloak backchannel logout which will also logout from the IDP
            await keycloakProvider.logout();
        } catch (error) {
            logger.error('Logout error:', error);
            // Show error status briefly before fallback
            setStatus('Logout error, redirecting...');
            
            // Fallback: clear storage and redirect after brief delay
            setTimeout(() => {
                keycloakProvider.clearLocalStorage();
                window.location.href = '/';
            }, 1000);
        }
    };



    useEffect(() => {
        const handleCallback = async () => {
            logger.log('Keycloak callback handler started');
            
            // Prevent multiple executions
            if (window.callbackProcessed) {
                logger.log('Callback already processed, skipping');
                return;
            }
            window.callbackProcessed = true;
            
            try {
                const urlParams = new URLSearchParams(window.location.search);
                const code = urlParams.get('code');
                const error = urlParams.get('error');

                if (error) {
                    setStatus(`Error: ${error}`);
                    return;
                }

                if (!code) {
                    setStatus('No authorization code received');
                    return;
                }

                logger.log('Processing OAuth callback...');
                setStatus('Processing login...');

                // Use Keycloak provider to handle callback
                const result = await keycloakProvider.handleCallback(code, window.location.origin + '/callback');
                
                // Detect which identity provider was used
                const detectedProvider = detectIdentityProvider(result.user.email);
                
                // Store authentication result
                localStorage.setItem('access_token', result.tokens.access_token);
                localStorage.setItem('user_info', JSON.stringify(result.user));
                localStorage.setItem('auth_provider', 'keycloak');
                localStorage.setItem('identity_provider', detectedProvider || 'Unknown');
                
                // Store id_token for logout (if available)
                if (result.tokens.id_token) {
                    sessionStorage.setItem('keycloak_id_token', result.tokens.id_token);
                }
                
                // Update UI state
                setUserInfo(result.user);
                setIdentityProvider(detectedProvider);
                setStatus(detectedProvider ? `${detectedProvider} login successful!` : 'Login successful!');
                
                logger.log('Login completed successfully with provider:', detectedProvider);

            } catch (error) {
                logger.error('Callback error:', error);
                setStatus(`Error: ${error.message}`);
            }
        };

        handleCallback();
    }, [keycloakProvider]);

    return (
        <div style={styles.container}>
            {userInfo && (
                <div style={styles.userInfo}>
                    {identityProvider && (
                        <div style={styles.providerSection}>
                            <p><strong>Logged in via:</strong> {identityProvider}</p>
                            {renderProviderLogo(identityProvider)}
                        </div>
                    )}
                    <h3>User Information:</h3>
                    <p><strong>Name:</strong> {userInfo.name}</p>
                    <p><strong>Email:</strong> {userInfo.email}</p>
                    {userInfo.picture && (
                        <img
                            src={userInfo.picture}
                            alt="Profile"
                            style={styles.avatar}
                        />
                    )}
                </div>
            )}

            {userInfo && (
                <div style={styles.buttonContainer}>
                    <button
                        onClick={handleLogout}
                        style={{ ...styles.button, ...styles.logoutButton }}
                    >
                        {identityProvider ? `Logout from ${identityProvider}` : 'Logout'}
                    </button>
                </div>
            )}
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
        fontFamily: 'Arial, sans-serif',
        backgroundColor: '#f5f5f5',
        padding: '2rem'
    },
    status: {
        fontSize: '18px',
        marginBottom: '1rem'
    },
    userInfo: {
        backgroundColor: 'white',
        padding: '1rem',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        marginBottom: '1rem',
        textAlign: 'center'
    },
    providerSection: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        marginBottom: '1rem'
    },
    logoContainer: {
        marginTop: '0.5rem'
    },
    // Microsoft logo styles (4 colored squares)
    microsoftGrid: {
        display: 'grid',
        gridTemplate: '20px 20px / 20px 20px',
        gap: '2px',
        padding: '8px'
    },
    microsoftSquare: {
        width: '20px',
        height: '20px'
    },
    // Google logo styles (familiar circular design with G)
    googleCircle: {
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        background: 'conic-gradient(from 0deg, #4285f4 0deg 90deg, #34a853 90deg 180deg, #fbbc05 180deg 270deg, #ea4335 270deg 360deg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        padding: '3px'
    },
    googleInner: {
        width: '100%',
        height: '100%',
        backgroundColor: 'white',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    },
    googleText: {
        color: '#4285f4',
        fontSize: '20px',
        fontWeight: 'bold',
        fontFamily: 'Arial, sans-serif'
    },
    avatar: {
        width: '80px',
        height: '80px',
        borderRadius: '50%',
        marginTop: '1rem'
    },
    buttonContainer: {
        display: 'flex',
        gap: '1rem',
        flexWrap: 'wrap',
        justifyContent: 'center'
    },
    button: {
        padding: '12px 24px',
        fontSize: '16px',
        backgroundColor: '#007bff',
        color: 'white',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer'
    },
    logoutButton: {
        backgroundColor: '#dc3545'
    }
};

export default Callback;