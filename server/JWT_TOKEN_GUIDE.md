# 🔐 JWT Token - Complete Guide

## 📍 **Where is the JWT Token?**

### **1. In the Browser (After Login)**

**Location:** Browser's LocalStorage

**How to View:**
1. Open browser (http://localhost:5173)
2. Login with credentials
3. Press **F12** (DevTools)
4. Go to **Application** tab
5. Click **Local Storage** → **http://localhost:5173**
6. Look for key: **`token`**

**Example:**
```
Key: token
Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0ZW5hbnRfaWQiOiJ0ZW5hbnQtYSIsInVzZXJJZCI6ImFkbWluIiwiaWF0IjoxNzA2ODQ5MjkwLCJleHAiOjE3MDY5MzU2OTB9.abc123...
```

---

### **2. In the Code**

#### **Frontend - Where Token is Stored:**

**File:** `client/src/App.jsx`

**Line 11-12:**
```javascript
const [token, setToken] = useState(localStorage.getItem('token'));
const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || 'null'));
```

**When Login Succeeds:**
```javascript
// File: client/src/components/Login.jsx
// Line 20
onLogin({ tenantId, userId }, token);

// File: client/src/App.jsx
// Line 14-16
const handleLogin = (userData, token) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setToken(token);
    setUser(userData);
};
```

---

#### **Frontend - Where Token is Used:**

**File:** `client/src/api.js`

**Line 11-17:**
```javascript
// Add token to requests
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});
```

**Every API call includes:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

#### **Backend - Where Token is Generated:**

**File:** `src/middleware/tenantResolver.js`

**Line 80-95 (createEncryptedToken function):**
```javascript
function createEncryptedToken(tenantId, userId, expiresIn = '24h') {
    const encryptedTenantId = encryptionUtils.encrypt(tenantId);
    
    const payload = {
        tenant_id: encryptedTenantId,
        userId: userId,
    };

    const token = jwt.sign(payload, JWT_SECRET, {
        expiresIn: expiresIn,
        algorithm: 'HS256',
    });

    return token;
}
```

**API Endpoint:**
```javascript
// File: src/app.js
// Line 65-75
app.post('/auth/token', (req, res) => {
    const { tenantId, userId } = req.body;
    
    const token = TenantResolver.createEncryptedToken(tenantId, userId);
    
    res.json({
        token,
        expiresIn: '24h',
        encrypted: true,
    });
});
```

---

#### **Backend - Where Token is Verified:**

**File:** `src/middleware/tenantResolver.js`

**Line 15-40 (JWT Strategy):**
```javascript
strategies: {
    jwt: (req) => {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            return null;
        }

        const token = authHeader.substring(7);
        
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            
            // Decrypt tenant_id
            const tenantId = encryptionUtils.decrypt(decoded.tenant_id);
            
            return {
                tenantId,
                userId: decoded.userId,
                source: 'jwt',
            };
        } catch (error) {
            console.error('JWT verification failed:', error.message);
            return null;
        }
    },
    // ...
}
```

---

## 🔍 **How to Get Your JWT Token**

### **Method 1: From Browser Console**

```javascript
// Open browser console (F12)
// Type:
localStorage.getItem('token')

// Output:
"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0ZW5hbnRfaWQiOiJ0ZW5hbnQtYSIsInVzZXJJZCI6ImFkbWluIiwiaWF0IjoxNzA2ODQ5MjkwLCJleHAiOjE3MDY5MzU2OTB9.abc123..."
```

---

### **Method 2: From Network Tab**

1. Open DevTools (F12)
2. Go to **Network** tab
3. Login to the app
4. Look for request to `/auth/token`
5. Click on it
6. Go to **Response** tab
7. See the token:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": "24h",
  "encrypted": true
}
```

---

### **Method 3: Generate via API**

**Using PowerShell:**
```powershell
$body = @{
    tenantId = "tenant-a"
    userId = "admin"
} | ConvertTo-Json

$response = Invoke-WebRequest -Uri "http://localhost:3000/auth/token" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body `
    -UseBasicParsing

$response.Content
```

**Output:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0ZW5hbnRfaWQiOiJlbmNyeXB0ZWRfZGF0YSIsInVzZXJJZCI6ImFkbWluIiwiaWF0IjoxNzA2ODQ5MjkwLCJleHAiOjE3MDY5MzU2OTB9.signature",
  "expiresIn": "24h",
  "encrypted": true
}
```

---

### **Method 4: Using CLI Tool**

```powershell
node cli.js generate-token tenant-a admin
```

**Output:**
```
Token generated successfully!
Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Expires in: 24h
Encrypted: true
```

---

## 🔐 **JWT Token Structure**

### **Your Token Has 3 Parts:**

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9  ← Header
.
eyJ0ZW5hbnRfaWQiOiJlbmNyeXB0ZWQiLCJ1c2VySWQiOiJhZG1pbiIsImlhdCI6MTcwNjg0OTI5MCwiZXhwIjoxNzA2OTM1NjkwfQ  ← Payload (encrypted tenant_id)
.
abc123xyz...  ← Signature
```

### **Decoded Header:**
```json
{
  "alg": "HS256",
  "typ": "JWT"
}
```

### **Decoded Payload:**
```json
{
  "tenant_id": "encrypted_data_here",  // ← AES-256-GCM encrypted!
  "userId": "admin",
  "iat": 1706849290,  // Issued at
  "exp": 1706935690   // Expires at (24h later)
}
```

### **Signature:**
```
HMACSHA256(
  base64UrlEncode(header) + "." +
  base64UrlEncode(payload),
  JWT_SECRET
)
```

---

## 🎯 **Token Lifecycle**

### **1. Login → Token Generated**
```
User enters: tenant-a / admin
    ↓
Frontend calls: POST /auth/token
    ↓
Backend encrypts tenant_id with AES-256-GCM
    ↓
Backend creates JWT with encrypted tenant_id
    ↓
Backend returns token
    ↓
Frontend stores in localStorage
```

### **2. API Call → Token Sent**
```
User clicks "Create Project"
    ↓
Frontend gets token from localStorage
    ↓
Frontend adds header: Authorization: Bearer <token>
    ↓
Backend receives request
    ↓
Backend extracts token from header
    ↓
Backend verifies JWT signature
    ↓
Backend decrypts tenant_id
    ↓
Backend processes request for that tenant
```

### **3. Logout → Token Removed**
```
User clicks "Logout"
    ↓
Frontend removes token from localStorage
    ↓
Frontend redirects to login
```

---

## 📂 **File Locations**

### **Frontend Files:**
```
client/src/
├── App.jsx                 ← Stores token in state
├── api.js                  ← Adds token to requests
└── components/
    └── Login.jsx           ← Receives token from backend
```

### **Backend Files:**
```
src/
├── middleware/
│   └── tenantResolver.js   ← Generates & verifies tokens
├── utils/
│   └── encryptionUtils.js  ← Encrypts tenant_id
└── app.js                  ← /auth/token endpoint
```

---

## 🔧 **How to Use the Token**

### **In Browser (Manual Testing):**

1. **Get Token:**
```javascript
const token = localStorage.getItem('token');
console.log(token);
```

2. **Use Token in API Call:**
```javascript
fetch('http://localhost:3000/api/projects', {
    headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    }
})
.then(res => res.json())
.then(data => console.log(data));
```

---

### **In PowerShell (Manual Testing):**

```powershell
# 1. Get token
$token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# 2. Use token
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

Invoke-WebRequest -Uri "http://localhost:3000/api/projects" `
    -Headers $headers `
    -UseBasicParsing
```

---

### **In Postman:**

1. **Method:** GET
2. **URL:** `http://localhost:3000/api/projects`
3. **Headers:**
   - Key: `Authorization`
   - Value: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
4. **Send**

---

## 🔐 **Security Features**

### **1. Encrypted Tenant ID**
```javascript
// Plain tenant_id is NEVER in the token
// Instead, it's encrypted with AES-256-GCM

// Before encryption:
tenant_id: "tenant-a"

// After encryption (in JWT):
tenant_id: "encrypted:iv:authTag:ciphertext"
```

### **2. Signed with Secret**
```javascript
// JWT is signed with JWT_SECRET
// Can't be tampered with
// Backend verifies signature on every request
```

### **3. Expiration**
```javascript
// Token expires after 24 hours
// Must login again after expiration
expiresIn: "24h"
```

---

## 🎯 **Quick Reference**

### **Get Token:**
```javascript
localStorage.getItem('token')
```

### **Set Token:**
```javascript
localStorage.setItem('token', 'your-token-here')
```

### **Remove Token:**
```javascript
localStorage.removeItem('token')
```

### **Check if Token Exists:**
```javascript
const hasToken = !!localStorage.getItem('token')
```

### **Decode Token (Client-side):**
```javascript
function parseJwt(token) {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
}

const token = localStorage.getItem('token');
const decoded = parseJwt(token);
console.log(decoded);
```

---

## 📊 **Token Information**

**Your JWT Token Contains:**
- ✅ Encrypted tenant ID (AES-256-GCM)
- ✅ User ID (plain text)
- ✅ Issued at timestamp
- ✅ Expiration timestamp
- ✅ HMAC signature

**Token is:**
- ✅ Stored in browser localStorage
- ✅ Sent with every API request
- ✅ Verified by backend
- ✅ Used for tenant isolation
- ✅ Valid for 24 hours

---

## 🎉 **Summary**

**Where to Find JWT Token:**
1. **Browser:** LocalStorage → `token` key
2. **Console:** `localStorage.getItem('token')`
3. **Network Tab:** Response from `/auth/token`
4. **API:** POST to `/auth/token`

**Token is Used:**
- ✅ Every API request (Authorization header)
- ✅ Tenant identification
- ✅ User authentication
- ✅ Access control

---

**Open your browser console and type `localStorage.getItem('token')` to see your JWT token!** 🔐
