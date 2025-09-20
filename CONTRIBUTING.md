# Contributing to Keycloak IDP Redirector Demo

Thank you for your interest in contributing! This project demonstrates domain-based identity provider routing with Keycloak.

## Quick Setup for Contributors

1. **Fork and Clone**
   ```bash
   git clone https://github.com/your-username/keycloak-idp-redirector-demo.git
   cd keycloak-idp-redirector-demo
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Setup Environment**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your OAuth credentials
   ```

4. **Start Development Environment**
   ```bash
   ./scripts/keycloak-environment-setup.sh  # Complete Keycloak setup
   npm start                                # Start React app
   ```

##  Development Guidelines

### Code Style
- Use functional React components with hooks
- Follow existing naming conventions
- Add comments for complex logic
- Keep components focused and single-purpose

### Domain Mapping
To add new domain mappings, edit `src/providers/keycloak/KeycloakProvider.js`:

```javascript
const domainMappings = {
    'gmail.com': 'google',
    'outlook.com': 'microsoft',
    'your-domain.com': 'your-idp'  // Add your mapping here
};
```

### Testing
- Test with different email domains
- Verify logout functionality works correctly
- Ensure PKCE flow completes successfully

## Submitting Changes

1. **Create Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make Changes**
   - Follow the coding guidelines
   - Test your changes thoroughly
   - Update documentation if needed

3. **Commit Changes**
   ```bash
   git commit -m "feat: add support for new domain mapping"
   ```

4. **Submit Pull Request**
   - Describe your changes clearly
   - Include testing instructions
   - Reference any related issues

## Reporting Issues

When reporting issues, please include:
- Steps to reproduce
- Expected vs actual behavior
- Browser and version
- Console errors (if any)
- Keycloak version

## Feature Requests

We welcome suggestions for:
- New identity provider integrations
- Additional domain mappings
- UI/UX improvements
- Security enhancements

## Resources

- [Keycloak Documentation](https://www.keycloak.org/documentation)
- [React Documentation](https://reactjs.org/docs)
- [OAuth 2.0 PKCE Specification](https://tools.ietf.org/html/rfc7636)

Thank you for contributing! 