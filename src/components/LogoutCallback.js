import React, { useEffect } from 'react';
import logger from '../utils/logger';

const LogoutCallback = () => {
    useEffect(() => {
        logger.log('Front-channel logout callback received');
        
        // This component is loaded in an iframe during front-channel logout
        
        // Optional: Send message to parent window if needed
        if (window.parent && window.parent !== window) {
            try {
                window.parent.postMessage('logout-complete', '*');
                logger.log('Sent logout-complete message to parent window');
            } catch (error) {
                logger.warn('Could not send message to parent window:', error);
            }
        }
        
        // The iframe will be closed automatically by Keycloak
    }, []);

    return (
        <div style={styles.container}>
            <div style={styles.message}>
                <h2>Logging out...</h2>
                <p>Please wait while we complete the logout process.</p>
                <div style={styles.spinner}></div>
            </div>
        </div>
    );
};

const styles = {
    container: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        backgroundColor: '#f5f5f5'
    },
    message: {
        textAlign: 'center',
        padding: '2rem',
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
    },
    spinner: {
        width: '40px',
        height: '40px',
        border: '4px solid #f3f3f3',
        borderTop: '4px solid #3498db',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        margin: '1rem auto'
    }
};

// Add CSS animation for spinner
const styleSheet = document.createElement('style');
styleSheet.type = 'text/css';
styleSheet.innerText = `
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
`;
document.head.appendChild(styleSheet);

export default LogoutCallback;