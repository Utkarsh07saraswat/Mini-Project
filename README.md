# Multi-Tenant SaaS Application

A production-grade multi-tenant SaaS application with comprehensive security, data isolation, and modern React frontend.

## 📁 Project Structure

```
Project 4/
├── client/                 # React frontend (Vite + React)
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── vite.config.js
│
├── server/                 # Node.js backend (Express + MongoDB)
│   ├── src/
│   │   ├── app.js
│   │   ├── config/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── scripts/
│   │   ├── services/
│   │   └── utils/
│   ├── tests/
│   ├── tenant-configs/
│   ├── logs/
│   ├── package.json
│   └── .env
│
├── package.json           # Root package.json for managing both
├── .env                   # Root environment variables
└── README.md             # This file
```

## 🚀 Quick Start

### Prerequisites

- Node.js >= 18.0.0
- MongoDB (local or Atlas)
- Redis (optional, for caching)

### Installation

1. **Install all dependencies** (root, client, and server):
   ```bash
   npm run install:all
   ```

   Or install individually:
   ```bash
   # Install root dependencies
   npm install

   # Install server dependencies
   cd server
   npm install

   # Install client dependencies
   cd ../client
   npm install
   ```

2. **Configure environment variables**:
   - Copy `server/.env.example` to `server/.env`
   - Update MongoDB connection string and other settings
   - See `server/API_KEYS_LOCATION.md` for detailed configuration

### Development

**Run both client and server concurrently:**
```bash
npm run dev
```

**Run separately:**
```bash
# Terminal 1 - Server (runs on port 3000 by default)
npm run dev:server

# Terminal 2 - Client (runs on port 5173 by default)
npm run dev:client
```

### Production

**Build the client:**
```bash
npm run build:client
```

**Start the server:**
```bash
npm run start:server
```

**Preview the built client:**
```bash
npm run start:client
```

## 📚 Documentation

### Server Documentation
- [Architecture Explained](server/ARCHITECTURE_EXPLAINED.md)
- [Quick Start Guide](server/QUICK_START_WINDOWS.md)
- [API Keys & Configuration](server/API_KEYS_LOCATION.md)
- [Database Setup](server/DATABASE_LOCATION.md)
- [MongoDB Atlas Setup](server/MONGODB_ATLAS_SETUP.md)
- [JWT Token Guide](server/JWT_TOKEN_GUIDE.md)
- [Performance Guide](server/PERFORMANCE_GUIDE.md)
- [Deployment Guide](server/DEPLOYMENT.md)
- [CLI Guide](server/CLI_GUIDE.md)
- [Project Structure](server/PROJECT_STRUCTURE.md)
- [Quick Reference](server/QUICK_REFERENCE.md)

### Client Documentation
- See [client/README.md](client/README.md) for frontend-specific documentation

## 🧪 Testing

**Run all server tests:**
```bash
npm run test:all
```

**Run specific tests:**
```bash
cd server
npm run test:encryption
npm run test:isolation
npm run test:rate-limit
```

## 🔑 Key Features

### Backend (Server)
- ✅ Multi-tenant data isolation
- ✅ JWT authentication
- ✅ Role-based access control
- ✅ Rate limiting
- ✅ Audit logging
- ✅ Data encryption
- ✅ Automated backups
- ✅ Redis caching (optional)
- ✅ Prometheus metrics
- ✅ Docker support

### Frontend (Client)
- ✅ Modern React with Vite
- ✅ Premium UI/UX design
- ✅ Responsive layout
- ✅ Admin dashboard
- ✅ Tenant management
- ✅ User management

## 🛠️ Available Scripts

### Root Level
- `npm run install:all` - Install all dependencies
- `npm run dev` - Run both client and server in development mode
- `npm run dev:server` - Run only the server
- `npm run dev:client` - Run only the client
- `npm run build:client` - Build the client for production
- `npm run test:all` - Run all server tests

### Server (cd server)
- `npm start` - Start the server in production mode
- `npm run dev` - Start the server with nodemon
- `npm test` - Run Jest tests
- `npm run test:encryption` - Test encryption features
- `npm run test:isolation` - Test tenant isolation
- `npm run test:rate-limit` - Test rate limiting
- `npm run generate:secret` - Generate JWT and encryption secrets

### Client (cd client)
- `npm run dev` - Start Vite dev server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## 🌐 Default Ports

- **Client (Frontend)**: http://localhost:5173
- **Server (Backend)**: http://localhost:3000
- **Server API**: http://localhost:3000/api

## 📝 Environment Variables

### Server (.env in server folder)
```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/multi-tenant
JWT_SECRET=your-jwt-secret
ENCRYPTION_SECRET=your-encryption-secret
REDIS_URL=redis://localhost:6379
NODE_ENV=development
```

See `server/.env.example` for all available options.

## 🐳 Docker Support

```bash
cd server
docker-compose up
```

## 📄 License

ISC

## 🤝 Contributing

This is a private project. For questions or issues, please contact the development team.

---

**Last Updated**: February 2026
