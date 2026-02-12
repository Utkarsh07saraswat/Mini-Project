# 🚨 FIXING: "next is not a function" Error

## ❌ **Problem**
- MongoDB is not running → System Status: Unknown
- Redis is not running → Cache: Unknown
- Backend can't connect to databases
- Project creation fails with "next is not a function"

---

## ✅ **SOLUTION - Quick Fix**

### **Option 1: Start MongoDB & Redis (Recommended)**

#### **1. Start MongoDB**

**Windows:**
```powershell
# If MongoDB is installed as a service:
net start MongoDB

# OR if installed manually:
"C:\Program Files\MongoDB\Server\7.0\bin\mongod.exe" --dbpath "C:\data\db"
```

**Check if MongoDB is running:**
```powershell
# Try connecting
mongo --eval "db.version()"
# OR
mongosh --eval "db.version()"
```

#### **2. Start Redis**

**Windows:**
```powershell
# If Redis is installed:
redis-server

# OR if using WSL:
wsl redis-server
```

**Check if Redis is running:**
```powershell
redis-cli ping
# Should return: PONG
```

---

### **Option 2: Use Docker (Easiest!)**

**Start MongoDB & Redis with Docker:**
```powershell
# Start MongoDB
docker run -d -p 27017:27017 --name mongodb mongo:latest

# Start Redis
docker run -d -p 6379:6379 --name redis redis:latest
```

**Check if running:**
```powershell
docker ps
```

**Stop when done:**
```powershell
docker stop mongodb redis
docker rm mongodb redis
```

---

### **Option 3: Use Docker Compose (Best!)**

**Start all services:**
```powershell
docker-compose up -d mongodb redis
```

**Check status:**
```powershell
docker-compose ps
```

**View logs:**
```powershell
docker-compose logs -f
```

**Stop:**
```powershell
docker-compose down
```

---

## 🔧 **After Starting Services**

### **1. Restart Backend**

**In the backend terminal:**
```powershell
# Stop: Ctrl+C
npm run dev
```

### **2. Check Health**

**Open browser:**
```
http://localhost:3000/health/detailed
```

**Should show:**
```json
{
  "status": "healthy",
  "dependencies": {
    "mongodb": {
      "status": "healthy",
      "state": "connected"
    },
    "redis": {
      "status": "healthy",
      "connected": true
    }
  }
}
```

### **3. Refresh Frontend**

**Refresh:**
```
http://localhost:5173
```

**Dashboard should now show:**
- ✅ System Status: healthy
- ✅ MongoDB: healthy
- ✅ Redis: healthy

---

## 📦 **Installing MongoDB & Redis**

### **Install MongoDB**

**Windows:**
1. Download from: https://www.mongodb.com/try/download/community
2. Run installer
3. Choose "Complete" installation
4. Install as Windows Service
5. MongoDB will auto-start

**Verify:**
```powershell
mongosh
# Should connect successfully
```

### **Install Redis**

**Windows (using WSL):**
```powershell
# Install WSL if not installed
wsl --install

# In WSL:
sudo apt update
sudo apt install redis-server
redis-server
```

**Windows (using Memurai - Redis alternative):**
1. Download from: https://www.memurai.com/
2. Install
3. Start service

**Verify:**
```powershell
redis-cli ping
# Should return: PONG
```

---

## 🐳 **Docker Installation (Recommended)**

### **Install Docker Desktop**

1. Download from: https://www.docker.com/products/docker-desktop
2. Install Docker Desktop
3. Start Docker Desktop
4. Wait for it to be running

### **Start Services**

```powershell
# Navigate to project
cd "d:/Project 4/multi-tenant-isolation"

# Start MongoDB & Redis
docker-compose up -d mongodb redis

# Check status
docker-compose ps

# View logs
docker-compose logs -f mongodb redis
```

---

## 🔍 **Troubleshooting**

### **Error: "next is not a function"**

**Cause:** Backend middleware chain is broken because MongoDB/Redis connection failed

**Fix:**
1. Start MongoDB
2. Start Redis (optional)
3. Restart backend
4. Refresh frontend

### **MongoDB Connection Error**

**Check:**
```powershell
# Is MongoDB running?
netstat -ano | findstr :27017

# Try connecting
mongosh
```

**Fix:**
```powershell
# Start MongoDB service
net start MongoDB
```

### **Redis Connection Error**

**Check:**
```powershell
# Is Redis running?
netstat -ano | findstr :6379

# Try connecting
redis-cli ping
```

**Fix:**
```powershell
# Start Redis
redis-server
```

### **Port Already in Use**

**MongoDB (27017):**
```powershell
# Find process
netstat -ano | findstr :27017

# Kill process (replace PID)
taskkill /PID <PID> /F
```

**Redis (6379):**
```powershell
# Find process
netstat -ano | findstr :6379

# Kill process (replace PID)
taskkill /PID <PID> /F
```

---

## ✅ **Quick Start Checklist**

- [ ] MongoDB installed
- [ ] Redis installed (or using Docker)
- [ ] MongoDB running (check port 27017)
- [ ] Redis running (check port 6379)
- [ ] Backend restarted
- [ ] Health check shows "healthy"
- [ ] Frontend refreshed
- [ ] Dashboard shows green status

---

## 🚀 **Complete Startup Sequence**

### **Using Docker (Easiest):**

```powershell
# 1. Start databases
docker-compose up -d mongodb redis

# 2. Wait 5 seconds for startup
Start-Sleep -Seconds 5

# 3. Start backend (in project root)
npm run dev

# 4. Start frontend (in another terminal)
cd client
npm run dev

# 5. Open browser
# http://localhost:5173
```

### **Using Local Installation:**

```powershell
# 1. Start MongoDB
net start MongoDB

# 2. Start Redis
redis-server
# (Keep this terminal open)

# 3. Start backend (new terminal)
cd "d:/Project 4/multi-tenant-isolation"
npm run dev

# 4. Start frontend (new terminal)
cd "d:/Project 4/multi-tenant-isolation/client"
npm run dev

# 5. Open browser
# http://localhost:5173
```

---

## 📊 **Verify Everything is Working**

### **1. Check Backend Health**
```
http://localhost:3000/health/detailed
```

**Expected:**
```json
{
  "status": "healthy",
  "timestamp": "...",
  "uptime": 123,
  "dependencies": {
    "mongodb": {
      "status": "healthy",
      "state": "connected",
      "host": "localhost:27017",
      "name": "multi_tenant"
    },
    "redis": {
      "status": "healthy",
      "ping": "PONG",
      "connected": true
    }
  }
}
```

### **2. Check Dashboard**
```
http://localhost:5173
```

**Expected:**
- ✅ System Status: healthy
- ✅ Database Status: MongoDB healthy
- ✅ Cache Status: Redis healthy

### **3. Create Project**
1. Go to Projects page
2. Click "+ New Project"
3. Fill in details
4. Click "Create Project"
5. ✅ Success message appears!

---

## 🎯 **Summary**

**The "next is not a function" error happens because:**
1. MongoDB is not running
2. Backend can't connect to database
3. Middleware chain breaks
4. Request fails

**To fix:**
1. ✅ Start MongoDB
2. ✅ Start Redis (optional)
3. ✅ Restart backend
4. ✅ Refresh frontend
5. ✅ Try creating project again

---

## 💡 **Recommended Setup**

**For Development:**
```powershell
# Use Docker Compose (easiest)
docker-compose up -d

# This starts:
# - MongoDB
# - Redis
# - Prometheus
# - Grafana
# - Your app
```

**For Quick Testing:**
```powershell
# Just MongoDB & Redis
docker run -d -p 27017:27017 --name mongodb mongo
docker run -d -p 6379:6379 --name redis redis
```

---

**Start MongoDB and Redis, then restart your backend!** 🚀

The project creation will work once the databases are running! ✅
