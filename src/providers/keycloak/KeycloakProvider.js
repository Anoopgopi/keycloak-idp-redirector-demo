// Simple Keycloak OIDC Provider with PKCE
import { generateCodeVerifier, generateCodeChallenge } from '../../utils/pkce';
import logger from '../../utils/logger';

export class KeycloakProvider {
    constructor() {
        this.baseUrl = process.env.REACT_APP_KEYCLOAK_URL || 'http://localhost:8080/auth';
        this.realm = process.env.REACT_APP_KEYCLOAK_REALM || 'idp-redirector-demo';
        this.clientId = process.env.REACT_APP_KEYCLOAK_CLIENT_ID || 'react-oidc-app';
    }

    // Build OIDC authorization URL with PKCE and optional IDP hint
    async buildAuthUrl(redirectUri, scope = 'openid email profile', loginHint = null) {
        const codeVerifier = generateCodeVerifier();
        const codeChallenge = await generateCodeChallenge(codeVerifier);

        // Store code verifier for token exchange
        sessionStorage.setItem('keycloak_code_verifier', codeVerifier);

        const params = new URLSearchParams({
            response_type: 'code',
            client_id: this.clientId,
            redirect_uri: redirectUri,
            scope: scope,
            code_challenge: codeChallenge,
            code_challenge_method: 'S256'
        });

        // Use Keycloak's kc_idp_hint parameter for automatic IDP redirection
        if (loginHint && (loginHint === 'google' || loginHint === 'microsoft')) {
            params.append('kc_idp_hint', loginHint);
            logger.log('Using kc_idp_hint for automatic redirection:', loginHint);
        }

        return `${this.baseUrl}/realms/${this.realm}/protocol/openid-connect/auth?${params.toString()}`;
    }

    // Handle login initiation with optional email-based IDP routing
    async login(redirectUri, loginHint = null) {
        if (!this.isConfigured()) {
            throw new Error('Keycloak not configured');
        }

        const authUrl = await this.buildAuthUrl(redirectUri, 'openid email profile', loginHint);
        logger.log('Redirecting to Keycloak with IDP hint:', loginHint);
        window.location.href = authUrl;
    }

    // Determine login hint based on email domain
    determineLoginHintFromEmail(email) {
        const domain = email.split('@')[1]?.toLowerCase();
        
        const domainMappings = {
            'gmail.com': 'google',
            'outlook.com': 'microsoft',
            'hotmail.com': 'microsoft',
            'live.com': 'microsoft',
            'msn.com': 'microsoft'
        };

        const loginHint = domainMappings[domain];
        
        if (loginHint) {
            logger.log(`Domain ${domain} mapped to IDP: ${loginHint}`);
        } else {
            logger.log(`Domain ${domain} not mapped, will use standard Keycloak login`);
        }

        return loginHint || null;
    }

    // Basic email validation
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    // Handle OIDC callback with PKCE verification
    async handleCallback(code, redirectUri) {
        logger.log('Starting callback handling with code:', code?.substring(0, 10) + '...');
        logger.log('Redirect URI:', redirectUri);
        
        const codeVerifier = sessionStorage.getItem('keycloak_code_verifier');
        
        if (!codeVerifier) {
            logger.error('PKCE code verifier not found in sessionStorage');
            throw new Error('PKCE code verifier not found. Please restart the authentication flow.');
        }
        
        logger.log('Found PKCE code verifier:', codeVerifier.substring(0, 10) + '...');

        // Prepare token exchange parameters
        const tokenParams = {
            grant_type: 'authorization_code',
            client_id: this.clientId,
            code: code,
            redirect_uri: redirectUri,
            code_verifier: codeVerifier
        };
        
        logger.log('Token exchange parameters:', {
            grant_type: tokenParams.grant_type,
            client_id: tokenParams.client_id,
            redirect_uri: tokenParams.redirect_uri,
            code: tokenParams.code?.substring(0, 10) + '...',
            code_verifier: tokenParams.code_verifier?.substring(0, 10) + '...'
        });

        // Exchange code for tokens
        const tokenResponse = await fetch(`${this.baseUrl}/realms/${this.realm}/protocol/openid-connect/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams(tokenParams)
        });

        if (!tokenResponse.ok) {
            const errorData = await tokenResponse.text();
            logger.error('Token exchange failed:', {
                status: tokenResponse.status,
                statusText: tokenResponse.statusText,
                error: errorData
            });
            throw new Error(`Token exchange failed: ${tokenResponse.status} - ${errorData}`);
        }

        const tokens = await tokenResponse.json();
        logger.log('Token exchange successful, received tokens');
        
        // Store id_token for logout if available
        if (tokens.id_token) {
            sessionStorage.setItem('keycloak_id_token', tokens.id_token);
            logger.log('Stored id_token for logout');
        }

        // Get user info
        logger.log('Fetching user info with access token');
        const userResponse = await fetch(`${this.baseUrl}/realms/${this.realm}/protocol/openid-connect/userinfo`, {
            headers: {
                'Authorization': `Bearer ${tokens.access_token}`
            }
        });

        if (!userResponse.ok) {
            const errorData = await userResponse.text();
            logger.error('User info fetch failed:', {
                status: userResponse.status,
                statusText: userResponse.statusText,
                error: errorData
            });
            throw new Error(`Failed to get user info: ${userResponse.status} - ${errorData}`);
        }

        const user = await userResponse.json();
        logger.log('User info retrieved successfully:', user);

        // Clean up
        sessionStorage.removeItem('keycloak_code_verifier');

        return {
            tokens,
            user: this.normalizeUser(user)
        };
    }

    // Normalize user data to common format
    normalizeUser(user) {
        return {
            id: user.sub,
            name: user.name || user.preferred_username || 'Unknown User',
            email: user.email,
            picture: user.picture,
            provider: 'keycloak'
        };
    }

    // Handle logout with proper backchannel session termination
    async logout() {
        logger.log('Starting backchannel logout process');
        
        try {
            // Get stored tokens and user info for logout BEFORE clearing storage
            const idToken = sessionStorage.getItem('keycloak_id_token');
            const userInfo = JSON.parse(localStorage.getItem('user_info') || '{}');
            const identityProvider = localStorage.getItem('identity_provider');
            
            logger.log('Logout details:', {
                hasIdToken: !!idToken,
                identityProvider: identityProvider,
                userEmail: userInfo.email,
                idTokenPreview: idToken ? idToken.substring(0, 20) + '...' : 'none'
            });
            
            // Perform backchannel logout to invalidate sessions in Keycloak and IDP
            if (idToken) {
                logger.log(`Initiating backchannel logout for ${identityProvider} user`);
                
                // Build logout URL for backchannel logout with redirect back to home
                const logoutParams = new URLSearchParams();
                logoutParams.append('client_id', this.clientId);
                logoutParams.append('id_token_hint', idToken);
                logoutParams.append('post_logout_redirect_uri', `${window.location.origin}/`);
                
                const logoutUrl = `${this.baseUrl}/realms/${this.realm}/protocol/openid-connect/logout?${logoutParams.toString()}`;
                
                logger.log('Redirecting to Keycloak logout (with backchannel):', logoutUrl);
                
                // Clear local storage before redirect
                this.clearLocalStorage();
                
                // Additional IDP-specific logout for better coverage (before redirect)
                this.performIdpSpecificLogout(identityProvider, idToken);
                
                // Use window.location.href to avoid CORS issues
                // This will trigger backchannel logout and redirect back to home
                window.location.href = logoutUrl;
                return; // Exit here as we're redirecting
                
            } else {
                logger.warn('No id_token available, performing local logout only');
                
                // Clear local storage and redirect to home
                this.clearLocalStorage();
                window.location.href = '/';
            }
            
        } catch (error) {
            logger.error('Logout error:', error);
            // Fallback: clear storage and redirect to home
            this.clearLocalStorage();
            window.location.href = '/';
        }
    }

    // Perform IDP-specific logout for additional session termination
    performIdpSpecificLogout(identityProvider, idToken) {
        if (!identityProvider || !idToken) return;
        
        try {
            let idpLogoutUrl = null;
            
            if (identityProvider === 'Google') {
                // Google logout URL
                idpLogoutUrl = 'https://accounts.google.com/logout';
                logger.log('Creating hidden iframe for additional Google logout');
            } else if (identityProvider === 'Microsoft') {
                // Microsoft logout URL
                idpLogoutUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/logout';
                logger.log('Creating hidden iframe for additional Microsoft logout');
            }
            
            if (idpLogoutUrl) {
                // Create a hidden iframe to trigger IDP logout
                const iframe = document.createElement('iframe');
                iframe.style.display = 'none';
                iframe.style.width = '1px';
                iframe.style.height = '1px';
                iframe.src = idpLogoutUrl;
                document.body.appendChild(iframe);
                
                logger.log(`Additional ${identityProvider} logout iframe created`);
                
                // The iframe will be cleaned up when the page redirects
            }
        } catch (error) {
            logger.warn(`Additional ${identityProvider} logout failed:`, error);
        }
    }

    // Clear local storage
    clearLocalStorage() {
        localStorage.removeItem('access_token');
        localStorage.removeItem('user_info');
        localStorage.removeItem('auth_provider');
        sessionStorage.removeItem('keycloak_code_verifier');
        sessionStorage.removeItem('keycloak_id_token');
        
        // Clear callback processing flag for fresh login
        if (window.callbackProcessed) {
            delete window.callbackProcessed;
        }
    }

    // Check if credentials are configured
    isConfigured() {
        return !!(this.baseUrl && this.realm && this.clientId);
    }
}