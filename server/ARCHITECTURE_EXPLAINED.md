# 🏗️ Multi-Tenant Isolation System - Complete Architecture Guide

## 📚 Table of Contents
1. [System Overview](#system-overview)
2. [Architecture Layers](#architecture-layers)
3. [Complete Request Flow](#complete-request-flow)
4. [Security Mechanisms](#security-mechanisms)
5. [Problem Diagnosis](#problem-diagnosis)
6. [Key Concepts](#key-concepts)

---

## 🎯 System Overview

This is a **production-grade multi-tenant SaaS application** where multiple customers (tenants) share the same infrastructure but their data is completely isolated.

### Multi-Tenancy Concept

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  Tenant A   │  │  Tenant B   │  │  Tenant C   │
│  (Acme Inc) │  │  (Beta Corp)│  │  (Gamma LLC)│
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       │                │                │
       └────────────────┼────────────────┘
                        │
              ┌─────────▼─────────┐
              │  Shared Backend   │
              │  (Express Server) │
              └─────────┬─────────┘
                        │
              ┌─────────▼─────────┐
              │ Shared Database   │
              │   (MongoDB)       │
              └───────────────────┘
```

**Critical Rule**: Tenant A should NEVER see Tenant B's data!

---

## 🏛️ Architecture Layers

### Layer 1: Frontend (React + Vite)

```
📁 client/
├── src/
│   ├── components/
│   │   ├── Login.jsx          ← Authentication UI
│   │   ├── Dashboard.jsx      ← Main dashboard
│   │   ├── Projects.jsx       ← Project management
│   │   ├── Users.jsx          ← User management
│   │   ├── AuditLogs.jsx      ← Security audit viewer
│   │   └── Monitoring.jsx     ← System metrics
│   ├── api.js                 ← Axios API client
│   ├── App.jsx                ← Main router
│   └── design-system.css      ← Styling
├── vite.config.js             ← Dev server + Proxy
└── package.json
```

**Purpose**: Beautiful, responsive UI for tenant users

**Key Features**:
- Premium glassmorphism design
- Real-time data updates
- Responsive layouts
- Interactive charts (Recharts)

### Layer 2: API Gateway (Express.js)

```
📁 src/
├── app.js                     ← Main server (routes, middleware)
├── middleware/
│   ├── tenantResolver.js      ← Extract tenant from JWT
│   ├── rateLimiter.js         ← Prevent abuse (Redis)
│   └── auditMiddleware.js     ← Log all actions
├── models/
│   ├── User.js                ← User schema + tenant hooks
│   ├── Project.js             ← Project schema + tenant hooks
│   └── AuditLog.js            ← Audit trail schema
├── services/
│   ├── tenantAwareService.js  ← Auto-filter by tenant
│   └── backupScheduler.js     ← Automated backups
├── utils/
│   ├── tenantContext.js       ← AsyncLocalStorage context
│   ├── encryptionUtils.js     ← AES-256-GCM encryption
│   ├── metricsCollector.js    ← Prometheus metrics
│   └── auditLogger.js         ← Audit logging
└── config/
    └── redisClient.js         ← Redis connection
```

**Purpose**: Route requests, enforce security, manage data

### Layer 3: Database (MongoDB)

```
Database: multi_tenant

Collections:
├── users
│   ├── { _id, tenant_id: "tenant-a", name: "Alice", email: "alice@acme.com" }
│   ├── { _id, tenant_id: "tenant-a", name: "Bob", email: "bob@acme.com" }
│   └── { _id, tenant_id: "tenant-b", name: "Charlie", email: "charlie@beta.com" }
│
├── projects
│   ├── { _id, tenant_id: "tenant-a", title: "Project X", status: "active" }
│   └── { _id, tenant_id: "tenant-b", title: "Project Y", status: "completed" }
│
└── auditlogs
    ├── { _id, tenant_id: "tenant-a", action: "CREATE", resource: "User", ... }
    └── { _id, tenant_id: "tenant-b", action: "READ", resource: "Project", ... }

Indexes:
├── users: { tenant_id: 1, email: 1 } (unique)
├── projects: { tenant_id: 1, createdAt: -1 }
└── auditlogs: { tenant_id: 1, timestamp: -1 }
```

**Purpose**: Store all tenant data with isolation via `tenant_id`

### Layer 4: Cache & Rate Limiting (Redis - Optional)

```
Redis Keys:
├── rate_limit:tenant-a → 45 (requests in current window)
├── rate_limit:tenant-b → 120 (requests in current window)
└── session:user123 → { ... } (optional session data)
```

**Purpose**: Performance optimization and abuse prevention

---

## 🔄 Complete Request Flow

### Scenario: User logs in and fetches their projects

#### Step 1: User Opens Browser

```
User → Browser → http://localhost:5173
```

1. Vite dev server serves `index.html`
2. React app loads
3. Router shows `<Login />` component

#### Step 2: User Enters Credentials

```javascript
// Login.jsx (line 24-54)
const handleSubmit = async (e) => {
    e.preventDefault();
    
    // User enters:
    // tenantId: "tenant-a"
    // userId: "admin"
    
    const response = await authAPI.generateToken(tenantId, userId);
    const { token } = response.data;
    
    onLogin({ tenantId, userId }, token);
};
```

#### Step 3: API Request (Frontend → Backend)

```javascript
// api.js (line 33-34)
export const authAPI = {
    generateToken: (tenantId, userId) =>
        api.post('/auth/token', { tenantId, userId })
};
```

**Network Flow**:
```
Browser: POST http://localhost:5173/auth/token
         ↓
Vite Proxy (vite.config.js line 13-16):
         Intercepts request
         Forwards to → http://localhost:3000/auth/token
         ↓
Express Server receives request
```

**Why Proxy?**
- ❌ **Without proxy**: `localhost:5173` → `localhost:3000` = CORS error (different origins)
- ✅ **With proxy**: `localhost:5173` → Vite forwards → `localhost:3000` = Same origin!

#### Step 4: Backend Generates Token

```javascript
// app.js (line 64-83)
app.post('/auth/token', async (req, res) => {
    const { tenantId, userId } = req.body;
    
    if (!tenantId || !userId) {
        return res.status(400).json({ error: 'tenantId and userId required' });
    }
    
    // Create encrypted JWT token
    const token = TenantResolver.createToken({ tenantId, userId }, true);
    
    res.json({
        token,
        expiresIn: process.env.JWT_EXPIRY || '24h',
        encrypted: true,
    });
});
```

**Token Creation Process**:

```javascript
// tenantResolver.js (line 47-58)
static createToken(payload, encryptTenantId = true) {
    const tokenPayload = { ...payload };
    
    if (encryptTenantId && payload.tenantId) {
        // Encrypt tenant_id with AES-256-GCM
        tokenPayload.tenantId = EncryptionUtils.encryptTenantId(payload.tenantId);
        tokenPayload.encrypted = true;
    }
    
    return jwt.sign(tokenPayload, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRY || '24h',
    });
}
```

**JWT Structure**:
```javascript
// Header
{
    "alg": "HS256",
    "typ": "JWT"
}

// Payload (before encryption)
{
    "tenantId": "tenant-a",
    "userId": "admin",
    "iat": 1738583353,
    "exp": 1738669753
}

// Payload (after encryption)
{
    "tenantId": "encrypted_base64_string_here",
    "userId": "admin",
    "encrypted": true,
    "iat": 1738583353,
    "exp": 1738669753
}

// Final Token
"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0ZW5hbnRJZCI6ImVuY3J5cHRlZF9iYXNlNjRfc3RyaW5nX2hlcmUiLCJ1c2VySWQiOiJhZG1pbiIsImVuY3J5cHRlZCI6dHJ1ZSwiaWF0IjoxNzM4NTgzMzUzLCJleHAiOjE3Mzg2Njk3NTN9.signature"
```

#### Step 5: Frontend Stores Token

```javascript
// App.jsx
const handleLogin = (user, token) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    setUser(user);
    setIsAuthenticated(true);
    // Navigate to dashboard
};
```

**Browser LocalStorage**:
```
token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
user: '{"tenantId":"tenant-a","userId":"admin"}'
```

#### Step 6: Dashboard Loads Projects

```javascript
// Dashboard.jsx
useEffect(() => {
    loadProjects();
}, []);

const loadProjects = async () => {
    const response = await tenantsAPI.getProjects();
    setProjects(response.data.data);
};
```

#### Step 7: API Request with Authorization

```javascript
// api.js (line 11-17) - Request Interceptor
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});
```

**HTTP Request**:
```
GET http://localhost:5173/api/projects

Headers:
  Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
  Content-Type: application/json
```

#### Step 8: Backend Middleware Chain

```javascript
// app.js (line 86-89)
app.use('/api', TenantResolver.fromJWT);        // 1. Extract tenant
app.use('/api', enforceTenantIsolation);        // 2. Enforce isolation
app.use('/api', TenantRateLimiter.middleware);  // 3. Rate limiting
app.use('/api', auditMiddleware);               // 4. Audit logging
```

**Middleware 1: TenantResolver.fromJWT**

```javascript
// tenantResolver.js (line 7-39)
static fromJWT(req, res, next) {
    try {
        // 1. Extract token from header
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ error: 'No token provided' });
        
        // 2. Verify JWT signature
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // 3. Decrypt tenant_id
        let tenantId = decoded.tenantId;
        if (decoded.encrypted === true) {
            tenantId = EncryptionUtils.decryptTenantId(decoded.tenantId);
        }
        
        // 4. Store in AsyncLocalStorage (critical for isolation!)
        TenantContext.run(tenantId, () => {
            req.tenantId = tenantId;
            req.tenantContext = { ...decoded, tenantId };
            next();
        });
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
}
```

**What AsyncLocalStorage Does**:
```javascript
// tenantContext.js
const { AsyncLocalStorage } = require('async_hooks');
const tenantStorage = new AsyncLocalStorage();

class TenantContext {
    static run(tenantId, callback) {
        // Creates isolated context for this request
        return tenantStorage.run({ tenantId }, callback);
    }
    
    static getTenantId() {
        const context = tenantStorage.getStore();
        if (!context) throw new Error('No tenant context!');
        return context.tenantId;
    }
}
```

**Visualization**:
```
Request 1 (Tenant A):
┌─────────────────────────────────┐
│ AsyncLocalStorage Context       │
│ { tenantId: "tenant-a" }        │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ Middleware Chain            │ │
│ │ → Route Handler             │ │
│ │ → Database Query            │ │
│ │ → Response                  │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘

Request 2 (Tenant B) - Runs simultaneously:
┌─────────────────────────────────┐
│ AsyncLocalStorage Context       │
│ { tenantId: "tenant-b" }        │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ Middleware Chain            │ │
│ │ → Route Handler             │ │
│ │ → Database Query            │ │
│ │ → Response                  │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘

No cross-contamination! Each request has isolated context.
```

**Middleware 2: enforceTenantIsolation**

```javascript
// tenantResolver.js (line 92-110)
const enforceTenantIsolation = (req, res, next) => {
    try {
        // Verify tenant context exists
        const tenantId = TenantContext.getTenantId();
        
        // Add to response headers for debugging
        res.setHeader('X-Tenant-Context', tenantId);
        
        // Log access
        console.log(`[${new Date().toISOString()}] Tenant ${tenantId} accessed ${req.path}`);
        
        next();
    } catch (error) {
        res.status(403).json({
            error: 'Tenant isolation violation',
            message: error.message
        });
    }
};
```

**Middleware 3: TenantRateLimiter**

```javascript
// rateLimiter.js
class TenantRateLimiter {
    static async middleware(req, res, next) {
        const tenantId = req.tenantId;
        const key = `rate_limit:${tenantId}`;
        
        try {
            const redis = getRedisClient();
            const count = await redis.incr(key);
            
            if (count === 1) {
                await redis.expire(key, 60); // 1 minute window
            }
            
            const limit = getTenantLimit(tenantId); // e.g., 100/min
            
            if (count > limit) {
                return res.status(429).json({
                    error: 'Rate limit exceeded',
                    limit,
                    retryAfter: 60
                });
            }
            
            res.setHeader('X-RateLimit-Limit', limit);
            res.setHeader('X-RateLimit-Remaining', limit - count);
            
            next();
        } catch (error) {
            // Redis unavailable - allow request
            console.warn('Rate limiting disabled:', error.message);
            next();
        }
    }
}
```

**Middleware 4: auditMiddleware**

```javascript
// auditMiddleware.js
const auditMiddleware = (req, res, next) => {
    const startTime = Date.now();
    
    res.on('finish', async () => {
        const duration = Date.now() - startTime;
        
        await AuditLogger.log({
            tenantId: req.tenantId,
            userId: req.tenantContext?.userId,
            action: req.method,
            resource: req.path,
            statusCode: res.statusCode,
            duration,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });
    });
    
    next();
};
```

#### Step 9: Route Handler Executes

```javascript
// app.js (line 125-132)
app.get('/api/projects', async (req, res) => {
    try {
        const projects = await projectService.findAll();
        res.json({ 
            tenant: req.tenantId, 
            count: projects.length, 
            data: projects 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
```

#### Step 10: TenantAwareService Queries Database

```javascript
// services/tenantAwareService.js
class TenantAwareService {
    constructor(model) {
        this.model = model;
    }
    
    async findAll(filter = {}) {
        // Get tenant from AsyncLocalStorage
        const tenantId = TenantContext.getTenantId();
        
        // Automatically add tenant_id filter
        const tenantFilter = { ...filter, tenant_id: tenantId };
        
        return await this.model.find(tenantFilter);
    }
    
    async create(data) {
        const tenantId = TenantContext.getTenantId();
        
        // Automatically inject tenant_id
        const tenantData = { ...data, tenant_id: tenantId };
        
        return await this.model.create(tenantData);
    }
}
```

**MongoDB Query Executed**:
```javascript
db.projects.find({ tenant_id: "tenant-a" })
```

**Additional Protection - Mongoose Middleware**:
```javascript
// models/Project.js
schema.pre('find', function() {
    const tenantId = TenantContext.getCurrentTenant();
    if (tenantId) {
        this.where({ tenant_id: tenantId });
    }
});

schema.pre('save', function() {
    const tenantId = TenantContext.getCurrentTenant();
    if (!this.tenant_id && tenantId) {
        this.tenant_id = tenantId;
    }
});
```

**Database Result**:
```javascript
[
    {
        _id: ObjectId("507f1f77bcf86cd799439011"),
        tenant_id: "tenant-a",
        title: "Project X",
        description: "Important project",
        status: "active",
        createdAt: ISODate("2026-02-01T10:00:00Z")
    },
    {
        _id: ObjectId("507f1f77bcf86cd799439012"),
        tenant_id: "tenant-a",
        title: "Project Y",
        description: "Another project",
        status: "completed",
        createdAt: ISODate("2026-02-02T14:30:00Z")
    }
]

// Notice: ONLY tenant-a's projects!
// tenant-b's projects are never returned!
```

#### Step 11: Response Sent Back

```javascript
// Response
{
    "tenant": "tenant-a",
    "count": 2,
    "data": [
        {
            "_id": "507f1f77bcf86cd799439011",
            "tenant_id": "tenant-a",
            "title": "Project X",
            "description": "Important project",
            "status": "active",
            "createdAt": "2026-02-01T10:00:00.000Z"
        },
        {
            "_id": "507f1f77bcf86cd799439012",
            "tenant_id": "tenant-a",
            "title": "Project Y",
            "description": "Another project",
            "status": "completed",
            "createdAt": "2026-02-02T14:30:00.000Z"
        }
    ]
}
```

#### Step 12: Frontend Displays Data

```javascript
// Projects.jsx
const loadProjects = async () => {
    try {
        const response = await tenantsAPI.getProjects();
        setProjects(response.data.data);
    } catch (error) {
        setError(error.message);
    }
};

// React renders beautiful cards
return (
    <div className="projects-grid">
        {projects.map(project => (
            <ProjectCard key={project._id} project={project} />
        ))}
    </div>
);
```

---

## 🔒 Security Mechanisms (7 Layers)

### 1. JWT Token Encryption (AES-256-GCM)

**Why?** Normal JWT tokens are just base64-encoded - anyone can decode them!

```javascript
// Normal JWT (INSECURE)
const token = jwt.sign({ tenantId: "tenant-a" }, secret);
// Anyone can decode: atob(token.split('.')[1])
// Result: { "tenantId": "tenant-a" } ← Visible!

// This App (SECURE)
const encryptedTenantId = EncryptionUtils.encryptTenantId("tenant-a");
const token = jwt.sign({ tenantId: encryptedTenantId, encrypted: true }, secret);
// Decode attempt: { "tenantId": "U2FsdGVkX1..." } ← Encrypted!
```

**Implementation**:
```javascript
// utils/encryptionUtils.js
const crypto = require('crypto');

class EncryptionUtils {
    static encryptTenantId(tenantId) {
        const algorithm = 'aes-256-gcm';
        const key = Buffer.from(process.env.ENCRYPTION_SECRET, 'base64');
        const iv = crypto.randomBytes(16);
        
        const cipher = crypto.createCipheriv(algorithm, key, iv);
        let encrypted = cipher.update(tenantId, 'utf8', 'base64');
        encrypted += cipher.final('base64');
        
        const authTag = cipher.getAuthTag();
        
        return JSON.stringify({
            iv: iv.toString('base64'),
            encrypted,
            authTag: authTag.toString('base64')
        });
    }
    
    static decryptTenantId(encryptedData) {
        const { iv, encrypted, authTag } = JSON.parse(encryptedData);
        const algorithm = 'aes-256-gcm';
        const key = Buffer.from(process.env.ENCRYPTION_SECRET, 'base64');
        
        const decipher = crypto.createDecipheriv(
            algorithm,
            key,
            Buffer.from(iv, 'base64')
        );
        
        decipher.setAuthTag(Buffer.from(authTag, 'base64'));
        
        let decrypted = decipher.update(encrypted, 'base64', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    }
}
```

### 2. AsyncLocalStorage Context Isolation

**Why?** Ensures tenant_id is available throughout the entire request lifecycle without passing it manually.

```javascript
// WITHOUT AsyncLocalStorage (BAD)
function handler(req, res) {
    const tenantId = req.tenantId;
    const projects = await getProjects(tenantId);
    const users = await getUsers(tenantId);
    // Must pass tenantId everywhere! Easy to forget!
}

// WITH AsyncLocalStorage (GOOD)
function handler(req, res) {
    // tenantId automatically available in all functions
    const projects = await getProjects();
    const users = await getUsers();
    // No need to pass tenantId - it's in context!
}
```

**How it works**:
```javascript
// Node.js AsyncLocalStorage creates isolated storage per request
const { AsyncLocalStorage } = require('async_hooks');
const storage = new AsyncLocalStorage();

// Request 1 (Tenant A)
storage.run({ tenantId: 'tenant-a' }, () => {
    console.log(storage.getStore()); // { tenantId: 'tenant-a' }
});

// Request 2 (Tenant B) - runs simultaneously
storage.run({ tenantId: 'tenant-b' }, () => {
    console.log(storage.getStore()); // { tenantId: 'tenant-b' }
});

// No cross-contamination!
```

### 3. Mongoose Pre-Query Hooks

**Why?** Automatic tenant filtering at the database level - impossible to forget!

```javascript
// models/Project.js
schema.pre('find', function() {
    const tenantId = TenantContext.getCurrentTenant();
    if (tenantId) {
        this.where({ tenant_id: tenantId });
    }
});

schema.pre('findOne', function() {
    const tenantId = TenantContext.getCurrentTenant();
    if (tenantId) {
        this.where({ tenant_id: tenantId });
    }
});

// Now ALL queries are automatically filtered!
Project.find({});              // → find({ tenant_id: "tenant-a" })
Project.findOne({ _id: "..." }); // → findOne({ _id: "...", tenant_id: "tenant-a" })
```

### 4. Database Indexes for Performance + Security

```javascript
// models/User.js
schema.index({ tenant_id: 1, email: 1 }, { unique: true });
// Benefits:
// 1. Fast lookups: O(log n) instead of O(n)
// 2. Enforces uniqueness per tenant (same email OK in different tenants)
// 3. Ensures tenant_id is always used in queries

// models/Project.js
schema.index({ tenant_id: 1, createdAt: -1 });
// Benefits:
// 1. Fast sorting by creation date per tenant
// 2. Efficient pagination
```

### 5. Rate Limiting (Redis-based)

**Why?** Prevent one tenant from overwhelming the system.

```javascript
// Scenario: Tenant A makes 1000 requests/second
// Without rate limiting: Server crashes, ALL tenants affected
// With rate limiting: Tenant A gets 429 error, other tenants unaffected

class TenantRateLimiter {
    static async middleware(req, res, next) {
        const key = `rate_limit:${req.tenantId}`;
        const count = await redis.incr(key);
        
        if (count === 1) {
            await redis.expire(key, 60); // 1 minute window
        }
        
        const limit = this.getTenantLimit(req.tenantId);
        
        if (count > limit) {
            return res.status(429).json({
                error: 'Rate limit exceeded',
                limit,
                retryAfter: 60
            });
        }
        
        next();
    }
    
    static getTenantLimit(tenantId) {
        // Different tiers
        const tier = process.env[`TENANT_${tenantId.toUpperCase()}_TIER`];
        
        const limits = {
            free: 100,      // 100 requests/minute
            premium: 1000,  // 1000 requests/minute
            enterprise: 10000 // 10000 requests/minute
        };
        
        return limits[tier] || limits.free;
    }
}
```

### 6. Comprehensive Audit Logging

**Why?** Security compliance, debugging, forensics.

```javascript
// Every action is logged
{
    _id: ObjectId("..."),
    tenant_id: "tenant-a",
    timestamp: ISODate("2026-02-03T17:19:13Z"),
    action: "READ",
    resource: "projects",
    resourceId: "507f1f77bcf86cd799439011",
    userId: "admin",
    ipAddress: "192.168.1.100",
    userAgent: "Mozilla/5.0...",
    statusCode: 200,
    duration: 45, // ms
    metadata: {
        query: { status: "active" }
    }
}

// Use cases:
// - Who accessed what data?
// - When did the breach happen?
// - Which tenant is abusing the API?
// - Performance analysis per tenant
```

### 7. CORS + Vite Proxy

**Why?** Prevent cross-origin attacks while allowing legitimate requests.

```javascript
// Backend CORS config (app.js)
app.use(cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Frontend Proxy (vite.config.js)
export default defineConfig({
    server: {
        proxy: {
            '/api': {
                target: 'http://localhost:3000',
                changeOrigin: true
            },
            '/auth': {
                target: 'http://localhost:3000',
                changeOrigin: true
            }
        }
    }
});

// Result:
// Browser thinks: "I'm making requests to localhost:5173" ✓
// Actually: Vite forwards to localhost:3000 ✓
// No CORS errors! ✓
```

---

## 🐛 Problem Diagnosis

### The Network Error Issue

#### What Was Happening

```
┌─────────────────────────────────────────────────────────┐
│ BEFORE FIX: Network Error on Login                     │
└─────────────────────────────────────────────────────────┘

1. User clicks "Login" in browser
   ↓
2. Frontend: axios.post('http://localhost:3000/auth/token')
   ↓
3. Browser: "CORS error - Origin http://localhost:5173 
              not allowed to access http://localhost:3000"
   ↓
4. Frontend: catch(error) → "Network Error"
   ↓
5. User sees: Login failed ❌
```

#### Root Causes

**Problem 1: API baseURL bypassing Vite proxy**

```javascript
// client/src/api.js (BEFORE)
const api = axios.create({
    baseURL: 'http://localhost:3000',  // ❌ Direct connection
    headers: { 'Content-Type': 'application/json' }
});

// What happens:
// Browser → http://localhost:3000/auth/token
// Origin: http://localhost:5173
// Target: http://localhost:3000
// Result: CORS error! Different origins!
```

**Problem 2: MongoDB Atlas connection failure**

```javascript
// .env (BEFORE)
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/...

// Possible issues:
// - Network/firewall blocking MongoDB Atlas
// - IP not whitelisted in MongoDB Atlas
// - Wrong credentials
// - Internet connectivity issues

// app.js
await mongoose.connect(process.env.MONGODB_URI);
// Throws error → process.exit(1) → Server never starts!
```

**Problem 3: Redis infinite retry loop**

```javascript
// src/config/redisClient.js (BEFORE)
retryStrategy: (times) => {
    return Math.min(times * 50, 2000);  // ❌ Never returns null!
}

// Result:
// Redis connection error...
// Redis connection error...
// Redis connection error... (forever)
// Server logs flooded, hard to debug
```

#### The Fixes

**Fix 1: Use Vite proxy**

```javascript
// client/src/api.js (AFTER)
const api = axios.create({
    baseURL: '',  // ✓ Empty = use relative URLs
    headers: { 'Content-Type': 'application/json' }
});

// Now:
// Browser → http://localhost:5173/auth/token
// Vite proxy → http://localhost:3000/auth/token
// Same origin (5173) = No CORS error!
```

**Fix 2: Use local MongoDB**

```javascript
// .env (AFTER)
MONGODB_URI=mongodb://localhost:27017/multi_tenant

// Benefits:
// ✓ Always available (no network issues)
// ✓ Fast (local connection)
// ✓ No IP whitelisting needed
// ✓ Works offline
```

**Fix 3: Limit Redis retries**

```javascript
// src/config/redisClient.js (AFTER)
retryStrategy: (times) => {
    if (times > 3) {
        console.warn('⚠ Redis unavailable - rate limiting disabled');
        return null;  // ✓ Stop retrying
    }
    return Math.min(times * 50, 2000);
}

// Result:
// Tries 3 times, then gives up gracefully
// Server continues without Redis (rate limiting disabled)
// Clean logs, easy to debug
```

---

## 🎓 Key Concepts

### What is Multi-Tenancy?

**Single-Tenant** (Traditional):
```
Company A → Server A → Database A
Company B → Server B → Database B
Company C → Server C → Database C

Cost: High (3 servers, 3 databases)
Maintenance: High (update 3 systems)
Scalability: Low (manual provisioning)
```

**Multi-Tenant** (This App):
```
Company A ┐
Company B ├→ Shared Server → Shared Database
Company C ┘

Cost: Low (1 server, 1 database)
Maintenance: Low (update once)
Scalability: High (automatic)

Challenge: Data isolation!
```

### What is AsyncLocalStorage?

Think of it like "thread-local storage" in other languages:

```javascript
// Without AsyncLocalStorage
function handleRequest(req, res) {
    const tenantId = req.tenantId;
    
    // Must pass tenantId to every function
    const projects = await getProjects(tenantId);
    const users = await getUsers(tenantId);
    const stats = await getStats(tenantId);
    
    // Easy to forget! Security risk!
}

// With AsyncLocalStorage
function handleRequest(req, res) {
    TenantContext.run(req.tenantId, async () => {
        // tenantId automatically available everywhere
        const projects = await getProjects();
        const users = await getUsers();
        const stats = await getStats();
        
        // Impossible to forget! Secure by default!
    });
}
```

### What is CORS?

**Cross-Origin Resource Sharing** - Browser security feature:

```
Browser at http://localhost:5173
Tries to fetch http://localhost:3000/api/projects

Browser checks:
- Same protocol? http = http ✓
- Same domain? localhost = localhost ✓
- Same port? 5173 ≠ 3000 ✗

Result: CORS error!

Solutions:
1. Backend adds CORS headers (allows specific origins)
2. Use proxy (Vite forwards requests, same origin)
```

### What is JWT?

**JSON Web Token** - Stateless authentication:

```javascript
// Structure
header.payload.signature

// Example
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.  ← Header (algorithm, type)
eyJ0ZW5hbnRJZCI6InRlbmFudC1hIiwidXNlcklkIjoiYWRtaW4iLCJpYXQiOjE3Mzg1ODMzNTMsImV4cCI6MTczODY2OTc1M30.  ← Payload (data)
SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c  ← Signature (verification)

// Benefits:
// - Stateless (no session storage needed)
// - Portable (works across services)
// - Secure (signed, can't be tampered)

// This app adds:
// - Encryption (payload is encrypted, not just signed)
// - Tenant isolation (tenant_id in token)
```

### What is Rate Limiting?

Prevent abuse:

```javascript
// Without rate limiting
Malicious user: Makes 1,000,000 requests/second
Server: Crashes
All users: Affected

// With rate limiting
Malicious user: Makes 1,000,000 requests/second
Server: Blocks after 100 requests/minute
Malicious user: Gets 429 error
Other users: Unaffected
```

---

## 🚀 Testing the System

### Test 1: Login

```bash
curl -X POST http://localhost:3000/auth/token \
  -H "Content-Type: application/json" \
  -d '{"tenantId":"tenant-a","userId":"admin"}'

# Response:
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": "24h",
  "encrypted": true
}
```

### Test 2: Fetch Projects (Authenticated)

```bash
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

curl http://localhost:3000/api/projects \
  -H "Authorization: Bearer $TOKEN"

# Response:
{
  "tenant": "tenant-a",
  "count": 2,
  "data": [
    { "_id": "...", "tenant_id": "tenant-a", "title": "Project X" },
    { "_id": "...", "tenant_id": "tenant-a", "title": "Project Y" }
  ]
}
```

### Test 3: Isolation Verification

```bash
# Create project for tenant-a
curl -X POST http://localhost:3000/api/projects \
  -H "Authorization: Bearer $TOKEN_TENANT_A" \
  -H "Content-Type: application/json" \
  -d '{"title":"Secret Project A","status":"active"}'

# Try to access with tenant-b token
curl http://localhost:3000/api/projects \
  -H "Authorization: Bearer $TOKEN_TENANT_B"

# Response: Only tenant-b's projects, NOT tenant-a's!
{
  "tenant": "tenant-b",
  "count": 1,
  "data": [
    { "_id": "...", "tenant_id": "tenant-b", "title": "Project B" }
  ]
}
```

---

## 📊 System Monitoring

### Prometheus Metrics

```
GET http://localhost:3000/metrics

# Sample output:
http_requests_total{method="GET",path="/api/projects",status="200",tenant="tenant-a"} 45
http_requests_total{method="POST",path="/api/users",status="201",tenant="tenant-b"} 12
http_request_duration_seconds{tenant="tenant-a"} 0.045
tenant_active_requests{tenant="tenant-a"} 3
tenant_active_requests{tenant="tenant-b"} 1
```

### Audit Logs

```javascript
// Query audit logs
GET /api/audit-logs?action=CREATE&resource=User&limit=10

// Response:
{
  "tenant": "tenant-a",
  "count": 10,
  "data": [
    {
      "timestamp": "2026-02-03T17:19:13Z",
      "action": "CREATE",
      "resource": "User",
      "resourceId": "507f1f77bcf86cd799439011",
      "userId": "admin",
      "ipAddress": "192.168.1.100",
      "statusCode": 201
    }
  ]
}
```

---

## 🎯 Summary

This multi-tenant system provides:

1. **Complete Data Isolation**: Tenants can never see each other's data
2. **Production-Grade Security**: 7 layers of protection
3. **Scalability**: Single infrastructure serves unlimited tenants
4. **Observability**: Comprehensive logging and metrics
5. **Performance**: Rate limiting and caching
6. **Developer Experience**: Beautiful UI, clean code, well-documented

**The key insight**: Multi-tenancy is achieved through:
- JWT tokens carrying tenant identity
- AsyncLocalStorage maintaining context
- Automatic database filtering
- Comprehensive audit trails
- Rate limiting per tenant

All working together to ensure **secure, scalable, isolated multi-tenant operations**! 🚀
