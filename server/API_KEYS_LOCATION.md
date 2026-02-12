# 🔑 API Keys & Secrets - Location Guide

## 📍 **Where Are API Keys Stored?**

### **Main Location: `.env` File**

**Path:** `d:/Project 4/multi-tenant-isolation/.env`

**This file contains ALL your secrets:**
- JWT Secret
- Encryption Secret
- MongoDB URI
- Redis credentials
- API keys (if any)

---

## 🔐 **Current Secrets in `.env`**

**File:** `.env`

```env
# Application Configuration
NODE_ENV=development
PORT=3000

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/multi_tenant

# JWT Configuration
JWT_SECRET=dev-secret-change-in-production-12345
JWT_EXPIRY=24h

# Encryption Configuration
ENCRYPTION_SECRET=ZGV2LWVuY3J5cHRpb24tc2VjcmV0LWNoYW5nZS1pbi1wcm9kdWN0aW9u

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Backup Configuration
BACKUP_DIR=./backups
BACKUP_RETENTION_COUNT=7

# Monitoring & Logging
LOG_LEVEL=info
ENABLE_AUDIT_LOGS=true
ENABLE_METRICS=true
```

---

## 📂 **File Structure for Secrets**

```
d:/Project 4/multi-tenant-isolation/
│
├── .env                    ← YOUR SECRETS (gitignored)
├── .env.example            ← Template (safe to commit)
├── .gitignore              ← Ensures .env is not committed
│
├── src/
│   └── utils/
│       └── encryptionUtils.js  ← Uses ENCRYPTION_SECRET
│
└── (No separate API key folder - all in .env)
```

---

## 🔑 **Types of Secrets**

### **1. JWT Secret**
```env
JWT_SECRET=dev-secret-change-in-production-12345
```
**Used for:** Signing JWT tokens  
**Location:** `.env`  
**Used in:** `src/middleware/tenantResolver.js`

---

### **2. Encryption Secret**
```env
ENCRYPTION_SECRET=ZGV2LWVuY3J5cHRpb24tc2VjcmV0LWNoYW5nZS1pbi1wcm9kdWN0aW9u
```
**Used for:** Encrypting tenant_id in JWT  
**Location:** `.env`  
**Used in:** `src/utils/encryptionUtils.js`

---

### **3. MongoDB URI**
```env
MONGODB_URI=mongodb://localhost:27017/multi_tenant
```
**Used for:** Database connection  
**Location:** `.env`  
**Used in:** `src/app.js`

---

### **4. Redis Credentials**
```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
```
**Used for:** Cache & rate limiting  
**Location:** `.env`  
**Used in:** `src/config/redisClient.js`

---

## 📁 **There is NO Separate API Key Folder**

**Why?**
- All secrets are in `.env` file
- This is the standard Node.js practice
- `.env` is gitignored for security
- Easy to manage in one place

**If you need to add API keys:**
1. Open `.env` file
2. Add your key:
   ```env
   OPENAI_API_KEY=sk-...
   STRIPE_API_KEY=sk_test_...
   AWS_ACCESS_KEY=AKIA...
   ```
3. Access in code:
   ```javascript
   const apiKey = process.env.OPENAI_API_KEY;
   ```

---

## 🔍 **How to View Your Secrets**

### **Method 1: Open .env File**

**Windows Explorer:**
1. Navigate to: `d:\Project 4\multi-tenant-isolation`
2. Look for `.env` file
3. Open with text editor

**VS Code:**
1. Open project folder
2. Click `.env` in file explorer
3. View/edit secrets

**PowerShell:**
```powershell
cd "d:/Project 4/multi-tenant-isolation"
Get-Content .env
```

---

### **Method 2: Using CLI**

```powershell
# View all environment variables
node -e "require('dotenv').config(); console.log(process.env)"

# View specific secret
node -e "require('dotenv').config(); console.log(process.env.JWT_SECRET)"
```

---

## 🔐 **Security Best Practices**

### **✅ DO:**
- ✅ Keep secrets in `.env` file
- ✅ Add `.env` to `.gitignore`
- ✅ Use `.env.example` as template
- ✅ Use strong, random secrets
- ✅ Rotate secrets regularly
- ✅ Use different secrets for dev/prod

### **❌ DON'T:**
- ❌ Commit `.env` to git
- ❌ Share secrets in chat/email
- ❌ Hardcode secrets in code
- ❌ Use weak secrets in production
- ❌ Reuse secrets across projects
- ❌ Store secrets in frontend code

---

## 📝 **How to Add New API Keys**

### **Step 1: Add to .env**

**File:** `.env`

```env
# Add your new API key
OPENAI_API_KEY=sk-proj-abc123...
STRIPE_SECRET_KEY=sk_test_xyz789...
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
```

---

### **Step 2: Add to .env.example**

**File:** `.env.example`

```env
# Add template (without actual value)
OPENAI_API_KEY=your-openai-api-key-here
STRIPE_SECRET_KEY=your-stripe-secret-key-here
AWS_ACCESS_KEY_ID=your-aws-access-key-here
AWS_SECRET_ACCESS_KEY=your-aws-secret-access-key-here
```

---

### **Step 3: Use in Code**

**Example:**

```javascript
// File: src/services/openaiService.js
const openai = require('openai');

const client = new openai.OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

module.exports = client;
```

---

## 🗂️ **Alternative: Secrets Folder (Optional)**

**If you want a separate secrets folder:**

### **Create Structure:**
```
d:/Project 4/multi-tenant-isolation/
│
├── secrets/                ← New folder
│   ├── .gitkeep
│   ├── api-keys.json       ← API keys
│   ├── certificates/       ← SSL certs
│   │   ├── server.key
│   │   └── server.crt
│   └── service-accounts/   ← Service account keys
│       └── google-cloud.json
│
└── .gitignore              ← Add: secrets/*
```

### **Update .gitignore:**
```
# Secrets folder
secrets/*
!secrets/.gitkeep
```

### **Load Secrets:**
```javascript
// File: src/config/secrets.js
const fs = require('fs');
const path = require('path');

const loadSecrets = () => {
  const secretsPath = path.join(__dirname, '../../secrets/api-keys.json');
  
  if (fs.existsSync(secretsPath)) {
    return JSON.parse(fs.readFileSync(secretsPath, 'utf8'));
  }
  
  return {};
};

module.exports = loadSecrets();
```

---

## 🎯 **Current Setup Summary**

**Your Project Uses:**
- ✅ `.env` file for all secrets
- ✅ `.env.example` as template
- ✅ `.gitignore` to protect secrets
- ✅ `dotenv` package to load secrets
- ✅ Environment variables in code

**No separate API key folder needed!**

---

## 📊 **Secrets Location Map**

| Secret Type | Location | File | Used In |
|-------------|----------|------|---------|
| JWT Secret | `.env` | `JWT_SECRET` | `tenantResolver.js` |
| Encryption Key | `.env` | `ENCRYPTION_SECRET` | `encryptionUtils.js` |
| MongoDB URI | `.env` | `MONGODB_URI` | `app.js` |
| Redis Config | `.env` | `REDIS_*` | `redisClient.js` |
| Custom API Keys | `.env` | `YOUR_API_KEY` | Your code |

---

## 🔧 **How to Access Secrets in Code**

### **Backend (Node.js):**

```javascript
// Load environment variables
require('dotenv').config();

// Access secrets
const jwtSecret = process.env.JWT_SECRET;
const mongoUri = process.env.MONGODB_URI;
const apiKey = process.env.YOUR_API_KEY;

// Use in your code
const token = jwt.sign(payload, jwtSecret);
```

### **Frontend (React):**

**⚠️ IMPORTANT:** Never put secrets in frontend!

**For public API keys only:**
```javascript
// File: client/.env
VITE_PUBLIC_API_KEY=pk_test_...

// Access in code:
const publicKey = import.meta.env.VITE_PUBLIC_API_KEY;
```

**Note:** Only use `VITE_` prefix for non-sensitive, public keys!

---

## 📁 **File Locations**

### **Backend Secrets:**
```
d:/Project 4/multi-tenant-isolation/.env
```

### **Frontend Public Config:**
```
d:/Project 4/multi-tenant-isolation/client/.env
```

### **Example Templates:**
```
d:/Project 4/multi-tenant-isolation/.env.example
d:/Project 4/multi-tenant-isolation/client/.env.example
```

---

## 🎯 **Quick Reference**

**View Secrets:**
```powershell
cd "d:/Project 4/multi-tenant-isolation"
Get-Content .env
```

**Edit Secrets:**
```powershell
code .env
```

**Add New Secret:**
1. Open `.env`
2. Add: `NEW_API_KEY=value`
3. Save
4. Restart backend

**Use Secret:**
```javascript
const secret = process.env.NEW_API_KEY;
```

---

## 🎉 **Summary**

**API Keys & Secrets Location:**
- 📁 **Main File:** `.env` (root directory)
- 📁 **Template:** `.env.example`
- 📁 **Protected by:** `.gitignore`
- 📁 **No separate folder** (standard practice)

**To Add API Keys:**
1. Open `.env` file
2. Add your key
3. Use `process.env.YOUR_KEY` in code
4. Restart server

**Your `.env` file is at:**
```
d:/Project 4/multi-tenant-isolation/.env
```

---

**Open `.env` file to view/edit all your API keys and secrets!** 🔑
