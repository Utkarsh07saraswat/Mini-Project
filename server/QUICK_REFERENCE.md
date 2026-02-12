# 🚀 Multi-Tenant System - Quick Reference Guide

## 📋 Quick Start

### Start the Application
```bash
# Terminal 1: Start Backend
cd d:\Project 4\multi-tenant-isolation
npm run dev

# Terminal 2: Start Frontend
cd d:\Project 4\multi-tenant-isolation\frontend
npm run dev
```

### Access the Application
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000
- **Health Check**: http://localhost:3000/health
- **Metrics**: http://localhost:3000/metrics

### Demo Login Credentials
- **Tenant ID**: `tenant-a`
- **User ID**: `admin`

---

## 🔑 Key Files to Understand

### Frontend (React)
| File | Purpose | Key Concept |
|------|---------|-------------|
| `frontend/src/api.js` | API client configuration | **Vite Proxy** - Uses empty baseURL to leverage proxy |
| `frontend/src/components/Login.jsx` | Login UI | Sends credentials to get JWT token |
| `frontend/src/components/Dashboard.jsx` | Main dashboard | Displays tenant-specific data |
| `frontend/vite.config.js` | Vite configuration | **Proxy setup** - Forwards `/api`, `/auth` to backend |

### Backend (Express)
| File | Purpose | Key Concept |
|------|---------|-------------|
| `src/app.js` | Main server file | Routes, middleware chain, error handling |
| `src/middleware/tenantResolver.js` | Extract tenant from JWT | **JWT decryption**, AsyncLocalStorage setup |
| `src/utils/tenantContext.js` | Tenant context storage | **AsyncLocalStorage** - Isolates tenant per request |
| `src/services/tenantAwareService.js` | Auto-filtered queries | Automatically adds `tenant_id` to all queries |
| `src/models/User.js` | User schema | Mongoose hooks for auto-filtering |
| `src/models/Project.js` | Project schema | Mongoose hooks for auto-filtering |

### Configuration
| File | Purpose | Key Concept |
|------|---------|-------------|
| `.env` | Environment variables | MongoDB URI, JWT secret, encryption key |
| `package.json` | Dependencies & scripts | Lists all npm packages |

---

## 🔄 Request Flow Cheat Sheet

```
1. User Login
   Browser → /auth/token → Backend → JWT Token → LocalStorage

2. Fetch Data (e.g., Projects)
   Browser → /api/projects (with JWT in header)
   ↓
   Vite Proxy → http://localhost:3000/api/projects
   ↓
   Middleware Chain:
     → TenantResolver (extract tenant from JWT)
     → enforceTenantIsolation (verify tenant exists)
     → RateLimiter (check rate limits)
     → AuditLogger (log action)
   ↓
   Route Handler → TenantAwareService
   ↓
   MongoDB Query: find({ tenant_id: "tenant-a" })
   ↓
   Response → Browser → Display
```

---

## 🔒 Security Layers

### 1. JWT Token Encryption
```javascript
// Normal JWT: Base64 encoded (anyone can decode)
// This app: AES-256-GCM encrypted (secure)

Token Structure:
{
  tenantId: "encrypted_string",  // ← Encrypted!
  userId: "admin",
  encrypted: true,
  iat: 1738583353,
  exp: 1738669753
}
```

### 2. AsyncLocalStorage Context
```javascript
// Ensures tenant_id is available throughout request
TenantContext.run(tenantId, () => {
  // All code here has access to tenantId
  // No need to pass it manually
});
```

### 3. Mongoose Pre-Query Hooks
```javascript
// Automatically filters ALL queries by tenant_id
schema.pre('find', function() {
  const tenantId = TenantContext.getCurrentTenant();
  this.where({ tenant_id: tenantId });
});

// Result: Impossible to query other tenant's data!
```

### 4. Rate Limiting
```javascript
// Prevents abuse
tenant-a: 100 requests/minute ✓
tenant-a: 101st request → 429 Too Many Requests ✗
```

### 5. Audit Logging
```javascript
// Every action logged
{
  tenantId: "tenant-a",
  action: "READ",
  resource: "projects",
  timestamp: "2026-02-03T17:19:13Z"
}
```

---

## 🐛 Common Issues & Solutions

### Issue 1: Network Error on Login

**Symptom**: "Network Error" when clicking login

**Cause**: API baseURL bypassing Vite proxy

**Solution**:
```javascript
// frontend/src/api.js
const api = axios.create({
    baseURL: '',  // ✓ Empty = use Vite proxy
    // NOT: baseURL: 'http://localhost:3000'  ✗
});
```

### Issue 2: MongoDB Connection Failed

**Symptom**: Server exits immediately after start

**Cause**: Can't connect to MongoDB

**Solution**:
```bash
# Check MongoDB is running
Get-Service -Name MongoDB

# If stopped, start it
Start-Service MongoDB

# Or use local MongoDB in .env
MONGODB_URI=mongodb://localhost:27017/multi_tenant
```

### Issue 3: Redis Connection Errors

**Symptom**: Continuous "Redis connection error" logs

**Cause**: Redis not installed or not running

**Solution**: Redis is optional! The app works without it (rate limiting disabled)

```javascript
// src/config/redisClient.js already handles this
retryStrategy: (times) => {
    if (times > 3) return null;  // Stop after 3 attempts
    return Math.min(times * 50, 2000);
}
```

### Issue 4: CORS Errors

**Symptom**: "Access-Control-Allow-Origin" error in browser console

**Cause**: Direct API calls instead of using proxy

**Solution**: Ensure Vite proxy is configured and API baseURL is empty

```javascript
// vite.config.js
export default defineConfig({
    server: {
        proxy: {
            '/api': { target: 'http://localhost:3000' },
            '/auth': { target: 'http://localhost:3000' }
        }
    }
});
```

---

## 🧪 Testing the System

### Test 1: Generate Token (Login)
```bash
curl -X POST http://localhost:3000/auth/token \
  -H "Content-Type: application/json" \
  -d '{"tenantId":"tenant-a","userId":"admin"}'

# Expected Response:
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": "24h",
  "encrypted": true
}
```

### Test 2: Fetch Projects (Authenticated)
```bash
# Replace TOKEN with actual token from Test 1
curl http://localhost:3000/api/projects \
  -H "Authorization: Bearer TOKEN"

# Expected Response:
{
  "tenant": "tenant-a",
  "count": 2,
  "data": [...]
}
```

### Test 3: Create Project
```bash
curl -X POST http://localhost:3000/api/projects \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"New Project","description":"Test","status":"active"}'

# Expected Response:
{
  "tenant": "tenant-a",
  "data": {
    "_id": "...",
    "tenant_id": "tenant-a",
    "title": "New Project",
    ...
  }
}
```

### Test 4: Verify Isolation
```bash
# Generate token for tenant-b
curl -X POST http://localhost:3000/auth/token \
  -H "Content-Type: application/json" \
  -d '{"tenantId":"tenant-b","userId":"admin"}'

# Fetch projects with tenant-b token
curl http://localhost:3000/api/projects \
  -H "Authorization: Bearer TENANT_B_TOKEN"

# Expected: Only tenant-b's projects, NOT tenant-a's!
```

---

## 📊 Monitoring Endpoints

### Health Check
```bash
curl http://localhost:3000/health

# Response:
{
  "status": "healthy",
  "timestamp": "2026-02-03T17:19:13.908Z",
  "uptime": 1234.9079851,
  "version": "1.0.0"
}
```

### Detailed Health
```bash
curl http://localhost:3000/health/detailed

# Response:
{
  "status": "healthy",
  "timestamp": "...",
  "services": {
    "mongodb": { "status": "healthy", "message": "Connected" },
    "redis": { "status": "unhealthy", "message": "Not connected" }
  },
  "metrics": {
    "uptime": 1234.9,
    "memory": { "used": 123456789, "total": 8589934592 },
    "cpu": { "user": 1234567, "system": 234567 }
  }
}
```

### Prometheus Metrics
```bash
curl http://localhost:3000/metrics

# Response: Prometheus format metrics
http_requests_total{method="GET",path="/api/projects",status="200",tenant="tenant-a"} 45
http_request_duration_seconds{tenant="tenant-a"} 0.045
...
```

---

## 🎯 Key Concepts Explained Simply

### Multi-Tenancy
**Question**: Why not give each customer their own server?

**Answer**: Cost and maintenance!
- **Single-Tenant**: 100 customers = 100 servers = $$$
- **Multi-Tenant**: 100 customers = 1 server = $

**Challenge**: Keep customer data isolated!

### AsyncLocalStorage
**Question**: How does the system remember which tenant a request belongs to?

**Answer**: AsyncLocalStorage creates isolated storage per request
```javascript
// Request 1 (Tenant A) and Request 2 (Tenant B) run simultaneously
// But each has its own isolated context - no mixing!

Request 1: TenantContext.getTenantId() → "tenant-a"
Request 2: TenantContext.getTenantId() → "tenant-b"
```

### JWT Token
**Question**: Why use JWT instead of sessions?

**Answer**: Stateless authentication
- **Sessions**: Server stores session data (memory/database)
- **JWT**: All data in token, server just verifies signature

**Benefits**: Scalable, works across services, no session storage needed

### Vite Proxy
**Question**: Why use a proxy instead of CORS?

**Answer**: Better security and simpler setup
- **CORS**: Backend allows specific origins (can be misconfigured)
- **Proxy**: Browser thinks it's same origin (no CORS needed)

### Rate Limiting
**Question**: Why limit requests per tenant?

**Answer**: Prevent one tenant from affecting others
- Malicious/buggy tenant makes 1M requests → Server crashes → All tenants affected
- With rate limiting → Malicious tenant blocked → Other tenants unaffected

---

## 🛠️ Development Workflow

### Adding a New Feature

1. **Create Database Model** (if needed)
   ```javascript
   // src/models/NewModel.js
   const schema = new mongoose.Schema({
       tenant_id: { type: String, required: true, index: true },
       // ... other fields
   });
   
   // Add tenant isolation hooks
   schema.pre('find', function() {
       const tenantId = TenantContext.getCurrentTenant();
       this.where({ tenant_id: tenantId });
   });
   ```

2. **Create Service**
   ```javascript
   // src/services/newService.js
   const service = new TenantAwareService(NewModel);
   ```

3. **Add Route**
   ```javascript
   // src/app.js
   app.get('/api/new-resource', async (req, res) => {
       const data = await service.findAll();
       res.json({ tenant: req.tenantId, data });
   });
   ```

4. **Add Frontend API Call**
   ```javascript
   // frontend/src/api.js
   export const newAPI = {
       getAll: () => api.get('/api/new-resource'),
       create: (data) => api.post('/api/new-resource', data)
   };
   ```

5. **Create React Component**
   ```javascript
   // frontend/src/components/NewComponent.jsx
   const NewComponent = () => {
       const [data, setData] = useState([]);
       
       useEffect(() => {
           newAPI.getAll().then(res => setData(res.data.data));
       }, []);
       
       return <div>{/* Render data */}</div>;
   };
   ```

**That's it!** Tenant isolation is automatic thanks to:
- AsyncLocalStorage context
- Mongoose pre-query hooks
- TenantAwareService

---

## 📚 Further Reading

- **Full Architecture Guide**: See `ARCHITECTURE_EXPLAINED.md`
- **API Documentation**: See `API_KEYS_LOCATION.md`
- **Deployment Guide**: See `DEPLOYMENT.md`
- **Performance Guide**: See `PERFORMANCE_GUIDE.md`
- **Quick Start**: See `QUICK_START_WINDOWS.md`

---

## 🆘 Getting Help

### Check Logs
```bash
# Backend logs
# Look in terminal running: npm run dev

# Frontend logs
# Open browser DevTools → Console tab
```

### Common Log Messages

**✓ Good Signs**:
```
✓ MongoDB connected
✓ Redis client initialized
Multi-tenant server running on port 3000
```

**⚠ Warnings (OK)**:
```
⚠ Redis connection failed (rate limiting will be disabled)
# This is fine! Redis is optional
```

**✗ Errors (Need Fix)**:
```
✗ MongoDB connection error
# Fix: Check MongoDB is running, check .env MONGODB_URI
```

### Debug Mode
```bash
# Enable detailed logging
NODE_ENV=development npm run dev
```

---

## 🎓 Learning Path

### Beginner
1. Understand multi-tenancy concept
2. Learn JWT authentication
3. Understand CORS and proxies
4. Run the application and test login

### Intermediate
1. Study AsyncLocalStorage
2. Understand Mongoose middleware
3. Learn rate limiting concepts
4. Add a new feature (follow workflow above)

### Advanced
1. Study encryption (AES-256-GCM)
2. Implement custom rate limiting tiers
3. Add Prometheus monitoring
4. Deploy to production

---

## 🚀 Production Checklist

Before deploying to production:

- [ ] Change JWT_SECRET to strong random value
- [ ] Change ENCRYPTION_SECRET to strong random value
- [ ] Use MongoDB Atlas or production MongoDB
- [ ] Set up Redis for rate limiting
- [ ] Configure proper CORS origins
- [ ] Enable HTTPS
- [ ] Set up monitoring (Prometheus + Grafana)
- [ ] Configure automated backups
- [ ] Set up error tracking (e.g., Sentry)
- [ ] Load testing
- [ ] Security audit

---

**Remember**: This system is designed for **security first**. Every layer adds protection to ensure tenant data isolation! 🔒
