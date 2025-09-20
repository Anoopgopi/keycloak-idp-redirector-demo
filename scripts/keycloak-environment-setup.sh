#!/bin/bash

# Keycloak IDP Redirector Demo Environment Setup Script
# Installs and configures Keycloak with Docker, then sets up realm and client

set -e

# Configuration
KEYCLOAK_URL="http://localhost:8080"
KEYCLOAK_AUTH_URL="http://localhost:8080/auth"
ADMIN_USER="admin"
ADMIN_PASSWORD="admin"
REALM_NAME="idp-redirector-demo"
CLIENT_ID="react-oidc-app"
REDIRECT_URI="http://localhost:3001/callback"
CONTAINER_NAME="keycloak-idp-redirector-demo"
KEYCLOAK_IMAGE="quay.io/keycloak/keycloak:latest"

# Global variables
ACCESS_TOKEN=""
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
MICROSOFT_CLIENT_ID=""

echo "Setting up Keycloak IDP Redirector Demo Environment"
echo "=================================================="

# Function to load environment variables from .env.local
load_env_variables() {
    local env_file=".env.local"
    
    if [ -f "$env_file" ]; then
        echo "Loading OAuth credentials from $env_file..."
        
        # Source the .env.local file to load variables
        set -a  # automatically export all variables
        source "$env_file"
        set +a  # stop automatically exporting
        
        # Extract the values we need
        GOOGLE_CLIENT_ID="$REACT_APP_GOOGLE_CLIENT_ID"
        GOOGLE_CLIENT_SECRET="$REACT_APP_GOOGLE_CLIENT_SECRET"
        MICROSOFT_CLIENT_ID="$REACT_APP_MICROSOFT_CLIENT_ID"
        
        # Validate that we have the required credentials
        if [ -n "$GOOGLE_CLIENT_ID" ] && [ "$GOOGLE_CLIENT_ID" != "your-google-client-id.apps.googleusercontent.com" ]; then
            echo "SUCCESS: Google OAuth credentials loaded"
        else
            echo "WARNING: Google OAuth credentials not configured in $env_file"
            GOOGLE_CLIENT_ID="YOUR_GOOGLE_CLIENT_ID"
            GOOGLE_CLIENT_SECRET="YOUR_GOOGLE_CLIENT_SECRET"
        fi
        
        if [ -n "$MICROSOFT_CLIENT_ID" ] && [ "$MICROSOFT_CLIENT_ID" != "your-microsoft-client-id" ]; then
            echo "SUCCESS: Microsoft OAuth credentials loaded"
        else
            echo "WARNING: Microsoft OAuth credentials not configured in $env_file"
            MICROSOFT_CLIENT_ID="YOUR_MICROSOFT_CLIENT_ID"
        fi
    else
        echo "WARNING: $env_file not found, using placeholder credentials"
        echo "You will need to configure OAuth credentials manually in Keycloak admin console"
        GOOGLE_CLIENT_ID="YOUR_GOOGLE_CLIENT_ID"
        GOOGLE_CLIENT_SECRET="YOUR_GOOGLE_CLIENT_SECRET"
        MICROSOFT_CLIENT_ID="YOUR_MICROSOFT_CLIENT_ID"
    fi
}

# Function to check prerequisites
check_prerequisites() {
    echo "Checking prerequisites..."
    
    if ! command -v docker &> /dev/null; then
        echo "Docker is required but not installed"
        echo "Please install Docker first: https://docs.docker.com/get-docker/"
        exit 1
    fi
    
    if ! command -v curl &> /dev/null; then
        echo "ERROR: curl is required but not installed"
        exit 1
    fi
    
    if ! command -v jq &> /dev/null; then
        echo "ERROR: jq not found. Please install jq first."
        echo "macOS: brew install jq"
        echo "Ubuntu: sudo apt-get install jq"
        echo "CentOS: sudo yum install jq"
        exit 1
    fi
    
    echo "SUCCESS: Prerequisites check passed"
}

# Function to check if Keycloak container exists
check_keycloak_container() {
    if docker ps -a --format "table {{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
        return 0  # Container exists
    else
        return 1  # Container doesn't exist
    fi
}

# Function to check if Keycloak is running
check_keycloak_running() {
    if docker ps --format "table {{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
        return 0  # Container is running
    else
        return 1  # Container is not running
    fi
}

# Function to wait for Keycloak to be ready
wait_for_keycloak() {
    echo "Waiting for Keycloak to be ready..."
    local max_attempts=20
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        # Try new health endpoint first, then detect version
        if curl -s "$KEYCLOAK_URL/health/ready" > /dev/null 2>&1 || \
           detect_keycloak_version; then
            echo "SUCCESS: Keycloak is ready!"
            return 0
        fi
        
        echo "   Attempt $attempt/$max_attempts - Keycloak not ready yet..."
        sleep 5
        ((attempt++))
    done
    
    echo "ERROR: Keycloak failed to start within expected time"
    exit 1
}

# Function to install and start Keycloak
install_keycloak() {
    echo "Setting up Keycloak with Docker..."
    
    # Pull latest Keycloak image
    echo "Pulling latest Keycloak image..."
    docker pull $KEYCLOAK_IMAGE
    
    # Remove existing container if it exists
    if check_keycloak_container; then
        echo "Removing existing Keycloak container..."
        docker rm -f $CONTAINER_NAME
    fi
    
    # Start new Keycloak container
    echo "Starting Keycloak container..."
    if docker run -d \
        --name $CONTAINER_NAME \
        -p 8080:8080 \
        -e KEYCLOAK_ADMIN=$ADMIN_USER \
        -e KEYCLOAK_ADMIN_PASSWORD=$ADMIN_PASSWORD \
        $KEYCLOAK_IMAGE start-dev > /dev/null 2>&1; then
        echo "SUCCESS: Keycloak container started"
    else
        echo "ERROR: Failed to start Keycloak container"
        echo "This might be because port 8080 is already in use."
        echo "Check if another Keycloak instance is running:"
        echo "  docker ps | grep keycloak"
        echo "If you want to use an existing Keycloak instance, make sure it's accessible at http://localhost:8080"
        exit 1
    fi
}

# Function to start existing Keycloak container
start_keycloak() {
    echo "Starting existing Keycloak container..."
    docker start $CONTAINER_NAME
    echo "SUCCESS: Keycloak container started"
}

# Function to detect Keycloak version and set appropriate URLs
detect_keycloak_version() {
    # Try new version first (no /auth prefix)
    if curl -s "$KEYCLOAK_URL/realms/master" > /dev/null 2>&1; then
        KEYCLOAK_AUTH_URL="$KEYCLOAK_URL"
        echo "Detected new Keycloak version (no /auth prefix)"
        return 0
    # Try legacy version (with /auth prefix)
    elif curl -s "$KEYCLOAK_AUTH_URL/realms/master" > /dev/null 2>&1; then
        echo "Detected legacy Keycloak version (with /auth prefix)"
        return 0
    else
        return 1
    fi
}

# Function to check if Keycloak is accessible on port 8080
check_keycloak_accessible() {
    if curl -s "$KEYCLOAK_URL/health/ready" > /dev/null 2>&1 || \
       detect_keycloak_version; then
        return 0  # Keycloak is accessible
    else
        return 1  # Keycloak is not accessible
    fi
}

# Function to manage Keycloak Docker container
manage_keycloak_docker() {
    # First check if Keycloak is already accessible
    if check_keycloak_accessible; then
        echo "SUCCESS: Keycloak is already running and accessible at http://localhost:8080"
        echo "Using existing Keycloak instance for configuration..."
        SKIP_SSL_CONFIG=true
        return 0
    fi
    
    if check_keycloak_container; then
        if check_keycloak_running; then
            echo "SUCCESS: Keycloak container is running"
            wait_for_keycloak
            SKIP_SSL_CONFIG=true
        else
            start_keycloak
            wait_for_keycloak
            SKIP_SSL_CONFIG=true
        fi
    else
        install_keycloak
        wait_for_keycloak
        SKIP_SSL_CONFIG=false
    fi
}

# Function to configure SSL requirement using kcadm.sh
configure_ssl_requirement() {
    echo "Configuring SSL requirement..."
    
    # Configure kcadm.sh credentials and disable SSL requirement
    if docker exec $CONTAINER_NAME /opt/keycloak/bin/kcadm.sh config credentials \
        --server http://localhost:8080 \
        --realm master \
        --user $ADMIN_USER \
        --password $ADMIN_PASSWORD > /dev/null 2>&1; then
        
        echo "SUCCESS: kcadm.sh configured"
        
        # Update master realm to disable SSL requirement
        if docker exec $CONTAINER_NAME /opt/keycloak/bin/kcadm.sh update realms/master \
            -s sslRequired=NONE > /dev/null 2>&1; then
            echo "SUCCESS: SSL requirement disabled for master realm"
        else
            echo "WARNING: Could not disable SSL requirement for master realm"
        fi
    else
        echo "WARNING: Could not configure kcadm.sh, will try direct authentication"
    fi
}

# Function to authenticate and get access token
authenticate() {
    echo "Authenticating with Keycloak..."
    
    local max_attempts=5
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        local auth_response=$(curl -s -X POST "$KEYCLOAK_AUTH_URL/realms/master/protocol/openid-connect/token" \
            -H "Content-Type: application/x-www-form-urlencoded" \
            -d "username=$ADMIN_USER" \
            -d "password=$ADMIN_PASSWORD" \
            -d "grant_type=password" \
            -d "client_id=admin-cli" 2>/dev/null || echo "")
        
        ACCESS_TOKEN=$(echo "$auth_response" | jq -r '.access_token // empty' 2>/dev/null || echo "")
        
        if [ -n "$ACCESS_TOKEN" ] && [ "$ACCESS_TOKEN" != "null" ]; then
            echo "SUCCESS: Authentication successful"
            return 0
        fi
        
        echo "   Authentication attempt $attempt/$max_attempts failed, retrying..."
        sleep 3
        ((attempt++))
    done
    
    echo "ERROR: Authentication failed after $max_attempts attempts"
    exit 1
}

# Function to check if realm exists
check_realm_exists() {
    local response=$(curl -s -X GET "$KEYCLOAK_AUTH_URL/admin/realms/$REALM_NAME" \
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        -w "%{http_code}" -o /dev/null)
    
    if [ "$response" = "200" ]; then
        return 0  # Realm exists
    else
        return 1  # Realm doesn't exist
    fi
}

# Function to create realm
create_realm() {
    if check_realm_exists; then
        echo "SUCCESS: Realm '$REALM_NAME' already exists"
        
        # Ensure SSL requirement is disabled for existing realm
        if docker exec $CONTAINER_NAME /opt/keycloak/bin/kcadm.sh update realms/$REALM_NAME \
            -s sslRequired=NONE > /dev/null 2>&1; then
            echo "SUCCESS: SSL requirement verified/updated for $REALM_NAME realm"
        else
            echo "WARNING: Could not update SSL requirement for $REALM_NAME realm"
        fi
        return 0
    fi
    
    echo "Creating realm: $REALM_NAME"
    
    local realm_data='{
        "realm": "'$REALM_NAME'",
        "enabled": true,
        "displayName": "Keycloak IDP Redirector Demo Realm",
        "displayNameHtml": "<div class=\"kc-logo-text\"><span>Keycloak IDP Redirector Demo</span></div>",
        "loginWithEmailAllowed": true,
        "registrationAllowed": false,
        "resetPasswordAllowed": false,
        "rememberMe": false,
        "verifyEmail": false,
        "attributes": {
            "frontendUrl": "http://localhost:8080"
        }
    }'
    
    local response=$(curl -s -X POST "$KEYCLOAK_AUTH_URL/admin/realms" \
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        -H "Content-Type: application/json" \
        -d "$realm_data" \
        -w "%{http_code}" -o /dev/null)
    
    if [ "$response" = "201" ]; then
        echo "SUCCESS: Realm created successfully"
        
        # Disable SSL requirement for the new realm
        if docker exec $CONTAINER_NAME /opt/keycloak/bin/kcadm.sh update realms/$REALM_NAME \
            -s sslRequired=NONE > /dev/null 2>&1; then
            echo "SUCCESS: SSL requirement disabled for $REALM_NAME realm"
        else
            echo "WARNING: Could not disable SSL requirement for $REALM_NAME realm"
        fi
    else
        echo "ERROR: Failed to create realm (HTTP $response)"
        exit 1
    fi
}

# Function to check if client exists
check_client_exists() {
    local clients=$(curl -s -X GET "$KEYCLOAK_AUTH_URL/admin/realms/$REALM_NAME/clients?clientId=$CLIENT_ID" \
        -H "Authorization: Bearer $ACCESS_TOKEN")
    
    local count=$(echo "$clients" | jq '. | length' 2>/dev/null || echo "0")
    
    if [ "$count" -gt 0 ]; then
        return 0  # Client exists
    else
        return 1  # Client doesn't exist
    fi
}

# Function to create OIDC client
create_client() {
    if check_client_exists; then
        echo "SUCCESS: Client '$CLIENT_ID' already exists"
        fix_client_logout_config
        return 0
    fi
    
    echo "Creating OIDC client: $CLIENT_ID"
    
    local client_data='{
        "clientId": "'$CLIENT_ID'",
        "name": "Keycloak IDP Redirector Demo Application",
        "description": "Keycloak IDP Redirector Demo application using OIDC with PKCE",
        "enabled": true,
        "publicClient": true,
        "standardFlowEnabled": true,
        "implicitFlowEnabled": false,
        "directAccessGrantsEnabled": false,
        "protocol": "openid-connect",
        "redirectUris": [
            "'$REDIRECT_URI'"
        ],
        "webOrigins": [
            "http://localhost:3001"
        ],
        "attributes": {
            "pkce.code.challenge.method": "S256",
            "post.logout.redirect.uris": "http://localhost:3001/",
            "oauth2.device.authorization.grant.enabled": "false",
            "backchannel.logout.revoke.offline.tokens": "false",
            "use.refresh.tokens": "true",
            "oidc.ciba.grant.enabled": "false",
            "backchannel.logout.session.required": "true",
            "client_credentials.use_refresh_token": "false",
            "require.pushed.authorization.requests": "false",
            "tls.client.certificate.bound.access.tokens": "false",
            "display.on.consent.screen": "false",
            "access.token.lifespan": "300",
            "client.session.idle.timeout": "0",
            "client.session.max.lifespan": "0"
        },
        "defaultClientScopes": [
            "web-origins",
            "profile",
            "roles",
            "email"
        ]
    }'
    
    local response=$(curl -s -X POST "$KEYCLOAK_AUTH_URL/admin/realms/$REALM_NAME/clients" \
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        -H "Content-Type: application/json" \
        -d "$client_data" \
        -w "%{http_code}" -o /dev/null)
    
    if [ "$response" = "201" ]; then
        echo "SUCCESS: Client created successfully"
    else
        echo "ERROR: Failed to create client (HTTP $response)"
        exit 1
    fi
}

# Function to fix client logout configuration for existing clients
fix_client_logout_config() {
    echo "Verifying client logout configuration..."
    
    # Get client ID (internal UUID)
    local client_uuid=$(curl -s -X GET "$KEYCLOAK_AUTH_URL/admin/realms/$REALM_NAME/clients?clientId=$CLIENT_ID" \
        -H "Authorization: Bearer $ACCESS_TOKEN" | jq -r '.[0].id // empty')
    
    if [ -z "$client_uuid" ] || [ "$client_uuid" = "null" ]; then
        echo "WARNING: Could not find client UUID for logout configuration"
        return 1
    fi
    
    # Update client with proper logout attributes using kcadm.sh for better reliability
    echo "Updating client logout configuration..."
    
    # Use kcadm.sh to update client attributes
    docker exec $CONTAINER_NAME /opt/keycloak/bin/kcadm.sh update clients/$client_uuid -r $REALM_NAME \
        -s 'attributes."post.logout.redirect.uris"="http://localhost:3001/"' \
        -s 'attributes."use.refresh.tokens"="true"' \
        -s 'attributes."access.token.lifespan"="300"' \
        -s 'attributes."backchannel.logout.session.required"="true"' \
        -s 'attributes."backchannel.logout.revoke.offline.tokens"="false"' > /dev/null 2>&1
    
    if [ $? -eq 0 ]; then
        echo "SUCCESS: Client logout configuration updated"
    else
        echo "WARNING: Could not update client logout configuration"
    fi
}

# Function to check if identity provider exists
check_idp_exists() {
    local idp_alias=$1
    local response=$(curl -s -X GET "$KEYCLOAK_AUTH_URL/admin/realms/$REALM_NAME/identity-provider/instances/$idp_alias" \
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        -w "%{http_code}" -o /dev/null)
    
    if [ "$response" = "200" ]; then
        return 0  # IDP exists
    else
        return 1  # IDP doesn't exist
    fi
}

# Function to create Google identity provider
create_google_idp() {
    if check_idp_exists "google"; then
        echo "Google Identity Provider already exists, updating credentials..."
        # Update existing Google IDP with new credentials
        local update_response=$(curl -s -X PUT "$KEYCLOAK_AUTH_URL/admin/realms/$REALM_NAME/identity-provider/instances/google" \
            -H "Authorization: Bearer $ACCESS_TOKEN" \
            -H "Content-Type: application/json" \
            -d '{
                "alias": "google",
                "displayName": "Google",
                "providerId": "google",
                "enabled": true,
                "trustEmail": true,
                "config": {
                    "clientId": "'$GOOGLE_CLIENT_ID'",
                    "clientSecret": "'$GOOGLE_CLIENT_SECRET'",
                    "defaultScope": "openid profile email",
                    "syncMode": "IMPORT"
                }
            }' \
            -w "%{http_code}" -o /dev/null)
        
        if [ "$update_response" = "204" ]; then
            echo "SUCCESS: Google Identity Provider credentials updated"
        else
            echo "WARNING: Failed to update Google Identity Provider credentials (HTTP $update_response)"
        fi
        return 0
    fi
    
    echo "Creating Google Identity Provider..."
    
    local google_idp_data='{
        "alias": "google",
        "displayName": "Google",
        "providerId": "google",
        "enabled": true,
        "updateProfileFirstLoginMode": "on",
        "trustEmail": true,
        "storeToken": false,
        "addReadTokenRoleOnCreate": false,
        "authenticateByDefault": false,
        "linkOnly": false,
        "firstBrokerLoginFlowAlias": "first broker login",
        "config": {
            "hideOnLoginPage": "false",
            "clientId": "'$GOOGLE_CLIENT_ID'",
            "clientSecret": "'$GOOGLE_CLIENT_SECRET'",
            "defaultScope": "openid profile email",
            "syncMode": "IMPORT"
        }
    }'
    
    local response=$(curl -s -X POST "$KEYCLOAK_AUTH_URL/admin/realms/$REALM_NAME/identity-provider/instances" \
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        -H "Content-Type: application/json" \
        -d "$google_idp_data" \
        -w "%{http_code}" -o /dev/null)
    
    if [ "$response" = "201" ]; then
        echo "SUCCESS: Google IDP created successfully"
    else
        echo "ERROR: Failed to create Google IDP (HTTP $response)"
        exit 1
    fi
}

# Function to create Microsoft identity provider
create_microsoft_idp() {
    if check_idp_exists "microsoft"; then
        echo "Microsoft Identity Provider already exists, updating to OIDC configuration..."
        
        # Delete existing Microsoft IDP to recreate with OIDC provider
        curl -s -X DELETE "$KEYCLOAK_AUTH_URL/admin/realms/$REALM_NAME/identity-provider/instances/microsoft" \
            -H "Authorization: Bearer $ACCESS_TOKEN" > /dev/null
        
        echo "Existing Microsoft IDP removed, creating new OIDC-based configuration..."
    fi
    
    echo "Creating Microsoft Identity Provider (OIDC)..."
    
    # Use OIDC provider with Azure AD endpoints and PKCE (no client secret)
    local microsoft_idp_data='{
        "alias": "microsoft",
        "displayName": "Microsoft",
        "providerId": "oidc",
        "enabled": true,
        "updateProfileFirstLoginMode": "on",
        "trustEmail": true,
        "storeToken": false,
        "addReadTokenRoleOnCreate": false,
        "authenticateByDefault": false,
        "linkOnly": false,
        "firstBrokerLoginFlowAlias": "first broker login",
        "config": {
            "hideOnLoginPage": "false",
            "clientId": "'$MICROSOFT_CLIENT_ID'",
            "authorizationUrl": "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
            "tokenUrl": "https://login.microsoftonline.com/common/oauth2/v2.0/token",
            "userInfoUrl": "https://graph.microsoft.com/oidc/userinfo",
            "jwksUrl": "https://login.microsoftonline.com/common/discovery/v2.0/keys",
            "defaultScope": "openid profile email",
            "syncMode": "IMPORT",
            "acceptsPromptNoneForwardFromClient": "false",
            "disableUserInfo": "false",
            "validateSignature": "false",
            "useJwksUrl": "false",
            "pkceEnabled": "true",
            "pkceMethod": "S256",
            "guiOrder": "2"
        }
    }'
    
    local response=$(curl -s -X POST "$KEYCLOAK_AUTH_URL/admin/realms/$REALM_NAME/identity-provider/instances" \
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        -H "Content-Type: application/json" \
        -d "$microsoft_idp_data" \
        -w "%{http_code}" -o /dev/null)
    
    if [ "$response" = "201" ]; then
        echo "SUCCESS: Microsoft IDP (OIDC) created successfully"
    else
        echo "ERROR: Failed to create Microsoft IDP (HTTP $response)"
        exit 1
    fi
}

# Function to create identity provider mappers
create_idp_mappers() {
    echo "Creating identity provider mappers..."
    
    # Google mappers
    local google_mappers=(
        '{"name":"google-email-mapper","identityProviderAlias":"google","identityProviderMapper":"oidc-user-attribute-idp-mapper","config":{"syncMode":"INHERIT","user.attribute":"email","claim":"email"}}'
        '{"name":"google-first-name-mapper","identityProviderAlias":"google","identityProviderMapper":"oidc-user-attribute-idp-mapper","config":{"syncMode":"INHERIT","user.attribute":"firstName","claim":"given_name"}}'
        '{"name":"google-last-name-mapper","identityProviderAlias":"google","identityProviderMapper":"oidc-user-attribute-idp-mapper","config":{"syncMode":"INHERIT","user.attribute":"lastName","claim":"family_name"}}'
    )
    
    # Microsoft mappers
    local microsoft_mappers=(
        '{"name":"microsoft-email-mapper","identityProviderAlias":"microsoft","identityProviderMapper":"oidc-user-attribute-idp-mapper","config":{"syncMode":"INHERIT","user.attribute":"email","claim":"email"}}'
        '{"name":"microsoft-first-name-mapper","identityProviderAlias":"microsoft","identityProviderMapper":"oidc-user-attribute-idp-mapper","config":{"syncMode":"INHERIT","user.attribute":"firstName","claim":"given_name"}}'
        '{"name":"microsoft-last-name-mapper","identityProviderAlias":"microsoft","identityProviderMapper":"oidc-user-attribute-idp-mapper","config":{"syncMode":"INHERIT","user.attribute":"lastName","claim":"family_name"}}'
    )
    
    # Create Google mappers
    for mapper in "${google_mappers[@]}"; do
        curl -s -X POST "$KEYCLOAK_AUTH_URL/admin/realms/$REALM_NAME/identity-provider/instances/google/mappers" \
            -H "Authorization: Bearer $ACCESS_TOKEN" \
            -H "Content-Type: application/json" \
            -d "$mapper" > /dev/null
    done
    
    # Create Microsoft mappers
    for mapper in "${microsoft_mappers[@]}"; do
        curl -s -X POST "$KEYCLOAK_AUTH_URL/admin/realms/$REALM_NAME/identity-provider/instances/microsoft/mappers" \
            -H "Authorization: Bearer $ACCESS_TOKEN" \
            -H "Content-Type: application/json" \
            -d "$mapper" > /dev/null
    done
    
    echo "SUCCESS: Identity provider mappers created"
}

# Function to create test user for Keycloak direct login
create_test_user() {
    echo "Creating test user for Keycloak direct login..."
    
    # Check if user already exists
    local existing_user=$(curl -s -X GET "$KEYCLOAK_AUTH_URL/admin/realms/$REALM_NAME/users?username=testuser@test.com" \
        -H "Authorization: Bearer $ACCESS_TOKEN" 2>/dev/null | jq '. | length' 2>/dev/null || echo "0")
    
    if [ "$existing_user" -gt 0 ] 2>/dev/null; then
        echo "SUCCESS: Test user 'testuser@test.com' already exists"
        return 0
    fi
    
    # Create test user
    local user_data='{
        "username": "testuser@test.com",
        "email": "testuser@test.com",
        "firstName": "Test",
        "lastName": "User",
        "enabled": true,
        "emailVerified": true,
        "credentials": [{
            "type": "password",
            "value": "test123",
            "temporary": false
        }]
    }'
    
    local response=$(curl -s -X POST "$KEYCLOAK_AUTH_URL/admin/realms/$REALM_NAME/users" \
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        -H "Content-Type: application/json" \
        -d "$user_data" \
        -w "%{http_code}" -o /dev/null)
    
    if [ "$response" = "201" ]; then
        echo "SUCCESS: Test user created successfully"
        echo "   Username: testuser@test.com"
        echo "   Password: test123"
    else
        echo "WARNING: Failed to create test user (HTTP $response)"
        echo "You can create it manually in the admin console if needed"
    fi
}

# Function to display setup summary
display_summary() {
    echo ""
    echo "Keycloak Environment Setup Completed!"
    echo "======================================"
    echo ""
    echo "Setup Summary:"
    echo "   • Keycloak: Running on http://localhost:8080"
    echo "   • Admin Console: http://localhost:8080/admin"
    echo "   • Realm: $REALM_NAME"
    echo "   • Client: $CLIENT_ID"
    echo "   • Identity Providers: Google, Microsoft"
    echo "   • Test User: testuser@test.com (password: test123)"
    echo ""
    
    # Show different next steps based on whether credentials were loaded
    if [ "$GOOGLE_CLIENT_ID" != "YOUR_GOOGLE_CLIENT_ID" ] || [ "$MICROSOFT_CLIENT_ID" != "YOUR_MICROSOFT_CLIENT_ID" ]; then
        echo "OAuth Credentials Status:"
        if [ "$GOOGLE_CLIENT_ID" != "YOUR_GOOGLE_CLIENT_ID" ]; then
            echo "   ✓ Google OAuth credentials configured"
        else
            echo "   ⚠ Google OAuth credentials need configuration"
        fi
        if [ "$MICROSOFT_CLIENT_ID" != "YOUR_MICROSOFT_CLIENT_ID" ]; then
            echo "   ✓ Microsoft OAuth credentials configured"
        else
            echo "   ⚠ Microsoft OAuth credentials need configuration"
        fi
        echo ""
    fi
    
    echo "Next Steps:"
    
    # Show credential configuration steps only if needed
    if [ "$GOOGLE_CLIENT_ID" = "YOUR_GOOGLE_CLIENT_ID" ] || [ "$MICROSOFT_CLIENT_ID" = "YOUR_MICROSOFT_CLIENT_ID" ]; then
        echo "1. Configure missing OAuth credentials:"
        echo "   Admin Console: http://localhost:8080/admin (admin/admin)"
        echo "   Navigate to: Realms → $REALM_NAME → Identity Providers"
        if [ "$GOOGLE_CLIENT_ID" = "YOUR_GOOGLE_CLIENT_ID" ]; then
            echo "   • Update Google provider with your Google OAuth credentials"
        fi
        if [ "$MICROSOFT_CLIENT_ID" = "YOUR_MICROSOFT_CLIENT_ID" ]; then
            echo "   • Update Microsoft provider with your Microsoft OAuth credentials"
        fi
        echo ""
        echo "2. Update your .env.local file with OAuth credentials"
        echo ""
        echo "3. Start React app:"
    else
        echo "1. Start React app:"
    fi
    
    echo "   npm start"
    echo ""
    echo "2. Test the application:"
    echo "   Visit: http://localhost:3001"
    echo "   Test with different email domains:"
    echo "      • user@gmail.com (Google)"
    echo "      • user@outlook.com (Microsoft)"
    echo "      • testuser@test.com (Keycloak - password: test123)"
    echo "      • user@company.com (Keycloak - any other domain)"
    echo ""
    echo "Docker Commands:"
    echo "   • Stop Keycloak: docker stop $CONTAINER_NAME"
    echo "   • Start Keycloak: docker start $CONTAINER_NAME"
    echo "   • Remove Keycloak: docker rm -f $CONTAINER_NAME"
    echo "   • View logs: docker logs $CONTAINER_NAME"
}

# Main execution function
main() {
    echo "Starting Keycloak environment setup..."
    echo ""
    
    load_env_variables
    check_prerequisites
    manage_keycloak_docker
    
    # Only configure SSL for new containers
    if [ "$SKIP_SSL_CONFIG" != "true" ]; then
        configure_ssl_requirement
    fi
    
    # Detect Keycloak version and set correct URLs
    detect_keycloak_version
    
    authenticate
    create_realm
    create_client
    create_google_idp
    create_microsoft_idp
    create_idp_mappers
    create_test_user
    
    display_summary
}

# Handle script interruption
trap 'echo ""; echo "ERROR: Setup interrupted"; exit 1' INT TERM

# Run main function
main