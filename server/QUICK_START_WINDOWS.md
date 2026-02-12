# 🚀 Quick Start Guide - Without Docker

## ⚠️ **Current Issue**

Your system shows:
- ❌ System Status: Unknown
- ❌ MongoDB: Unknown  
- ❌ Redis: Unknown
- ❌ Error: "next is not a function"

**Cause:** MongoDB and Redis are not running!

---

## ✅ **QUICK FIX - 3 Steps**

### **Step 1: Install MongoDB**

**Download & Install:**
1. Go to: https://www.mongodb.com/try/download/community
2. Download "MongoDB Community Server" for Windows
3. Run the installer
4. Choose "Complete" installation
5. ✅ Check "Install MongoDB as a Service"
6. ✅ Check "Run service as Network Service user"
7. Click "Install"

**Verify Installation:**
```powershell
# Check if MongoDB service is running
Get-Service MongoDB

# Should show: Status = Running
```

**If not running, start it:**
```powershell
net start MongoDB
```

---

### **Step 2: Install Redis (Optional but Recommended)**

**Option A: Using Memurai (Redis for Windows)**

1. Go to: https://www.memurai.com/get-memurai
2. Download Memurai (free Redis alternative for Windows)
3. Install
4. Start the service

**Option B: Using WSL (Windows Subsystem for Linux)**

```powershell
# Install WSL
wsl --install

# Restart computer

# After restart, in WSL terminal:
sudo apt update
sudo apt install redis-server -y

# Start Redis
redis-server --daemonize yes
```

**Option C: Skip Redis (App will work without it)**

Redis is optional. The app will work without it, but rate limiting won't work.

---

### **Step 3: Restart Backend**

```powershell
# In your backend terminal (where npm run dev is running)
# Press Ctrl+C to stop

# Then restart:
npm run dev
```

---

## 📊 **Verify It's Working**

### **1. Check MongoDB**

```powershell
# Test MongoDB connection
mongosh --eval "db.version()"

# Should show MongoDB version
```

### **2. Check Backend Health**

**Open in browser:**
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
    }
  }
}
```

### **3. Check Frontend**

**Refresh:**
```
http://localhost:5173
```

**Dashboard should show:**
- ✅ System Status: healthy
- ✅ MongoDB: healthy
- ✅ Redis: healthy (if installed) or warning (if not)

---

## 🎯 **Now Try Creating a Project**

1. Go to Projects page
2. Click "+ New Project"
3. Fill in:
   - Name: "Test Project"
   - Description: "My first project"
4. Click "Create Project"
5. ✅ Success! Project created!

---

## 🔧 **Troubleshooting**

### **MongoDB won't start**

```powershell
# Check if port 27017 is in use
netstat -ano | findstr :27017

# If nothing shows, MongoDB is not running
# Start it:
net start MongoDB
```

### **Still getting "next is not a function"**

**This means MongoDB is still not connected.**

**Check:**
1. Is MongoDB service running?
   ```powershell
   Get-Service MongoDB
   ```

2. Can you connect to MongoDB?
   ```powershell
   mongosh
   ```

3. Is backend using correct MongoDB URL?
   - Check `.env` file
   - Should be: `MONGODB_URI=mongodb://localhost:27017/multi_tenant`

4. Restart backend after starting MongoDB

---

## 📝 **MongoDB Installation Paths**

**Default Installation:**
```
C:\Program Files\MongoDB\Server\7.0\
```

**Data Directory:**
```
C:\data\db\
```

**Config File:**
```
C:\Program Files\MongoDB\Server\7.0\bin\mongod.cfg
```

---

## 🚀 **Complete Startup Sequence**

**Every time you want to work on the project:**

```powershell
# 1. Ensure MongoDB is running
Get-Service MongoDB
# If stopped: net start MongoDB

# 2. (Optional) Start Redis if installed
# Memurai: Check system tray
# WSL: wsl redis-server --daemonize yes

# 3. Start backend
cd "d:/Project 4/multi-tenant-isolation"
npm run dev

# 4. Start frontend (in another terminal)
cd "d:/Project 4/multi-tenant-isolation/client"
npm run dev

# 5. Open browser
# http://localhost:5173
```

---

## ✅ **After MongoDB is Running**

**Your dashboard will show:**
- ✅ System Status: **healthy** (green)
- ✅ Database Status: **MongoDB healthy** (green)
- ✅ Cache Status: **Redis healthy** or **warning** (yellow if not installed)

**And project creation will work!** 🎉

---

## 💡 **Quick Commands**

**Start MongoDB:**
```powershell
net start MongoDB
```

**Stop MongoDB:**
```powershell
net stop MongoDB
```

**Check MongoDB Status:**
```powershell
Get-Service MongoDB
```

**Connect to MongoDB:**
```powershell
mongosh
```

**Test Backend:**
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/health" -UseBasicParsing
```

---

## 🎯 **Summary**

**The error happens because:**
1. ❌ MongoDB is not running
2. ❌ Backend can't connect to database
3. ❌ Request fails with "next is not a function"

**To fix:**
1. ✅ Install MongoDB
2. ✅ Start MongoDB service
3. ✅ Restart backend
4. ✅ Refresh frontend
5. ✅ Create project successfully!

---

**Install MongoDB now and restart your backend!** 🚀

**Download:** https://www.mongodb.com/try/download/community
