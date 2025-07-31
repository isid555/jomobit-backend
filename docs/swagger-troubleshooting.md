# 🔧 Swagger API Troubleshooting Guide

This comprehensive guide helps you resolve common issues when using the Jomobit API through Swagger UI.

## 🚀 Quick Start Checklist

Before diving into troubleshooting, ensure you have:

- [ ] Valid JWT token from Auth0
- [ ] Proper Authorization header format: `Bearer <your-token>`
- [ ] Active internet connection
- [ ] Correct API base URL
- [ ] Required permissions for admin endpoints

## 🔐 Authentication Issues

### Problem: 401 Unauthorized Error

**Symptoms:**
- All authenticated endpoints return 401
- "Unauthorized" message in response
- Lock icon shows "Not authorized" in Swagger UI

**Solutions:**

1. **Check Token Format**
   ```
   ✅ Correct: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
   ❌ Wrong: eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
   ❌ Wrong: JWT eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

2. **Verify Token Expiration**
   - JWT tokens expire after 24 hours
   - Check the `exp` claim in your token
   - Use the token validation tool in `/api-docs/test-utils`

3. **Re-authorize in Swagger UI**
   - Click the "Authorize" button (🔒)
   - Clear existing authorization
   - Enter new token with "Bearer " prefix
   - Click "Authorize" and "Close"

### Problem: 403 Forbidden Error

**Symptoms:**
- Token is valid but access denied
- Admin endpoints return 403
- "Insufficient permissions" message

**Solutions:**

1. **Check Admin Permissions**
   - Admin endpoints require special permissions
   - Verify your token has admin role/scope
   - Contact admin to grant necessary permissions

2. **Verify Token Scope**
   - Check token payload for required scopes
   - Ensure token was issued for correct audience

## 🌐 Network and Connection Issues

### Problem: Network Errors or Timeouts

**Symptoms:**
- "Network Error" in Swagger UI
- Requests timeout after 30 seconds
- CORS errors in browser console

**Solutions:**

1. **Check API Server Status**
   ```bash
   curl http://localhost:3000/health
   ```

2. **Verify Base URL**
   - Development: `http://localhost:3000`
   - Production: `https://api.jomobit.com`

3. **Check CORS Configuration**
   - Ensure your domain is allowed
   - Check browser console for CORS errors

### Problem: SSL/TLS Certificate Issues

**Symptoms:**
- "Certificate error" messages
- "Insecure connection" warnings
- HTTPS requests failing

**Solutions:**

1. **For Development**
   - Use HTTP instead of HTTPS for local testing
   - Add certificate exception in browser

2. **For Production**
   - Verify SSL certificate is valid
   - Check certificate expiration date
   - Contact system administrator

## 📊 API Response Issues

### Problem: 400 Bad Request Errors

**Symptoms:**
- Validation errors in response
- "Bad Request" status
- Missing required fields

**Solutions:**

1. **Check Request Body Format**
   ```json
   {
     "profileId": "507f1f77bcf86cd799439011",
     "templateId": "507f1f77bcf86cd799439012"
   }
   ```

2. **Validate Required Fields**
   - Check API documentation for required fields
   - Ensure all required parameters are provided
   - Verify data types match specification

3. **Check Parameter Formats**
   - MongoDB ObjectIds: 24-character hex strings
   - Dates: ISO 8601 format (2024-01-15T10:30:00Z)
   - Emails: Valid email format

### Problem: 404 Not Found Errors

**Symptoms:**
- Endpoint returns 404
- "Route not found" message
- API path seems correct

**Solutions:**

1. **Verify Endpoint Path**
   ```
   ✅ Correct: /api/profiles
   ❌ Wrong: /profiles
   ❌ Wrong: /api/profile
   ```

2. **Check HTTP Method**
   - Ensure using correct method (GET, POST, PUT, DELETE)
   - Some endpoints only support specific methods

3. **Verify Resource Exists**
   - For endpoints with IDs, ensure resource exists
   - Check if resource was deleted or moved

### Problem: 429 Rate Limit Exceeded

**Symptoms:**
- "Too Many Requests" error
- Rate limit headers in response
- Temporary blocking of requests

**Solutions:**

1. **Wait and Retry**
   - Standard endpoints: Wait 1 minute
   - Generation endpoints: Wait 1 minute
   - Admin endpoints: Wait 1 minute

2. **Implement Exponential Backoff**
   ```javascript
   const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
   setTimeout(() => retry(), delay);
   ```

3. **Optimize Request Patterns**
   - Batch multiple operations when possible
   - Cache responses to reduce API calls
   - Use webhooks instead of polling

## 🎨 Swagger UI Specific Issues

### Problem: Swagger UI Not Loading

**Symptoms:**
- Blank page at `/api-docs`
- JavaScript errors in console
- "Failed to load API definition" message

**Solutions:**

1. **Clear Browser Cache**
   - Hard refresh (Ctrl+F5 or Cmd+Shift+R)
   - Clear browser cache and cookies
   - Try incognito/private browsing mode

2. **Check Browser Compatibility**
   - Use modern browser (Chrome, Firefox, Safari, Edge)
   - Enable JavaScript
   - Disable ad blockers temporarily

3. **Verify API Specification**
   - Check `/api-docs/swagger.json` loads correctly
   - Validate OpenAPI specification format

### Problem: Authorization Not Persisting

**Symptoms:**
- Need to re-authorize after page refresh
- Token not saved between sessions
- Authorization header missing from requests

**Solutions:**

1. **Enable Persistent Authorization**
   - This is enabled by default in our configuration
   - Check browser local storage for saved token

2. **Manual Token Storage**
   ```javascript
   // Store token manually
   localStorage.setItem('swagger_jwt_token', 'your-token-here');
   
   // Retrieve stored token
   const token = localStorage.getItem('swagger_jwt_token');
   ```

3. **Use Test Utilities**
   - Visit `/api-docs/test-utils` for token management tools
   - Use provided JavaScript helpers

### Problem: Request/Response Not Showing

**Symptoms:**
- "Try it out" button not working
- No request/response details shown
- Curl command not generated

**Solutions:**

1. **Check Browser Console**
   - Look for JavaScript errors
   - Check network tab for failed requests

2. **Verify Content Security Policy**
   - CSP might be blocking Swagger UI functionality
   - Check for CSP violations in console

3. **Try Different Browser**
   - Test in different browser
   - Disable browser extensions

## 🔍 Debugging Tools and Techniques

### Using Browser Developer Tools

1. **Network Tab**
   - Monitor all API requests
   - Check request headers and body
   - Verify response status and data

2. **Console Tab**
   - Look for JavaScript errors
   - Check API request/response logs
   - Use custom logging functions

3. **Application Tab**
   - Check local storage for saved tokens
   - Verify cookies and session data

### API Testing Tools

1. **Curl Commands**
   ```bash
   # Test health endpoint
   curl -X GET http://localhost:3000/health
   
   # Test authenticated endpoint
   curl -X GET http://localhost:3000/api/profiles \
        -H "Authorization: Bearer YOUR_TOKEN"
   ```

2. **Postman Collection**
   - Import OpenAPI specification into Postman
   - Create test collection for common scenarios
   - Set up environment variables

3. **Custom Test Script**
   ```bash
   # Run comprehensive endpoint tests
   npm run test:swagger
   
   # Run with debug output
   npm run test:swagger:debug
   ```

### Logging and Monitoring

1. **Request Correlation IDs**
   - Each request gets unique correlation ID
   - Use for tracking requests in logs
   - Include in support requests

2. **Server Logs**
   - Check application logs for errors
   - Look for authentication failures
   - Monitor performance metrics

## 📞 Getting Help

### Before Contacting Support

1. **Gather Information**
   - Error messages and status codes
   - Request correlation ID
   - Browser and version
   - Steps to reproduce issue

2. **Try Basic Troubleshooting**
   - Clear browser cache
   - Try different browser
   - Check network connectivity
   - Verify token validity

### Support Channels

1. **Documentation**
   - API documentation: `/api-docs`
   - Test utilities: `/api-docs/test-utils`
   - Status page: `/api-docs/status`

2. **Contact Information**
   - Email: support@jomobit.com
   - Documentation: https://jomobit.com/docs
   - Status page: https://status.jomobit.com

### Information to Include

When contacting support, please include:

- **Error Details**: Exact error message and status code
- **Request Information**: Endpoint, method, and parameters used
- **Correlation ID**: From X-Correlation-ID header
- **Environment**: Browser, OS, and API environment
- **Steps to Reproduce**: Detailed steps that led to the issue
- **Expected vs Actual**: What you expected vs what happened

## 🎯 Best Practices

### API Usage

1. **Authentication**
   - Store tokens securely
   - Refresh tokens before expiration
   - Use appropriate scopes

2. **Error Handling**
   - Implement proper error handling
   - Use exponential backoff for retries
   - Log errors with correlation IDs

3. **Performance**
   - Cache responses when appropriate
   - Use pagination for large datasets
   - Implement request debouncing

### Testing

1. **Use Test Environment**
   - Test in development environment first
   - Use test data, not production data
   - Validate all edge cases

2. **Automated Testing**
   - Use provided test scripts
   - Implement continuous testing
   - Monitor API health regularly

---

## 📚 Additional Resources

- [OpenAPI Specification](https://swagger.io/specification/)
- [JWT Token Guide](https://jwt.io/introduction)
- [HTTP Status Codes](https://httpstatuses.com/)
- [REST API Best Practices](https://restfulapi.net/)

---

*Last updated: 2024-01-15*
*For the most current information, visit `/api-docs/status`*