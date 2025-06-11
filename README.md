# Rylie SEO Hub 🚀

**White-Label SEO Middleware with Complete Client/Agency Separation**

[![Deployed on Render](https://img.shields.io/badge/deployed%20on-Render-46E3B7.svg)](https://render.com)
[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](package.json)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-green.svg)](package.json)
[![TypeScript](https://img.shields.io/badge/typescript-5.1+-blue.svg)](package.json)

---

## 🎯 **Quick Start**

```bash
# 1. Clone and install dependencies
git clone <repository-url>
cd seorylie
npm install

# 2. Setup environment
cp .env.example .env
# Edit .env with your configuration

# 3. Start development server
npm run dev

# 4. Test the API
curl http://localhost:3000/health
```

**Ready to go!** 🎉 Your server is running at `http://localhost:3000`

---

## 📋 **Table of Contents**

- [Overview](#-overview)
- [Architecture](#-architecture)
- [Environment Setup](#-environment-setup)
- [Development Commands](#-development-commands)
- [API Documentation](#-api-documentation)
- [Deployment](#-deployment)
- [Contributing](#-contributing)
- [Troubleshooting](#-troubleshooting)

---

## 🔍 **Overview**

Rylie SEO Hub is a sophisticated white-label SEO middleware that provides **complete separation** between clients and agencies through advanced AI proxy technology. It ensures zero PII exposure while maintaining full functionality for both parties.

### ✨ **Key Features**

- **🤖 AI Proxy Middleware** - Complete anonymization of client/agency interactions
- **🔐 Role-Based Access Control (RBAC)** - Granular permission management
- **🎨 White-Label Branding** - Customizable interface for each tenant
- **📊 Comprehensive Analytics** - Google Analytics 4 integration with automated reporting
- **📝 Audit Logging** - Complete activity tracking with trace IDs
- **🔄 Real-time Updates** - WebSocket support for live data synchronization
- **🚀 Modern Tech Stack** - TypeScript, Express, React, PostgreSQL, Redis

---

## 🏗️ **Architecture**

### **System Overview**

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Console   │◄──►│   Server API    │◄──►│   External APIs │
│  (React + Vite) │    │ (Express + TS)  │    │ (GA4, OpenAI)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Static Files  │    │   PostgreSQL    │    │      Redis      │
│   (CDN/Local)   │    │   (Database)    │    │    (Cache)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### **Deployment on Render**

This project is optimized for deployment on [Render](https://render.com) with:

- Automatic builds and deployments
- Managed PostgreSQL database
- Static site hosting for the web console
- Environment variable management
- Automatic SSL certificates

---

## ⚙️ **Environment Setup**

### **Prerequisites**

- **Node.js** >= 18.0.0
- **PostgreSQL** >= 14 (or use Render's managed database)
- **Redis** >= 6.0 (optional)
- **Git** for version control

### **Environment Configuration**

1. **Copy Environment Template**

   ```bash
   cp .env.example .env
   ```

2. **Required Configuration**

   ```env
   # Database (auto-configured on Render)
   DATABASE_URL=postgresql://user:pass@host:5432/dbname

   # Security
   JWT_SECRET=your_very_secure_jwt_secret_at_least_64_characters_long

   # External Services
   OPENAI_API_KEY=sk-your-openai-key
   GA4_SERVICE_ACCOUNT_EMAIL=your-ga4-service-account@project.iam.gserviceaccount.com
   ```

---

## 🛠️ **Development Commands**

### **Core Commands**

| Command         | Purpose                                      |
| --------------- | -------------------------------------------- |
| `npm run dev`   | Start development server with hot reload     |
| `npm run build` | Build for production (all packages + server) |
| `npm start`     | Start production server                      |
| `npm test`      | Run all tests                                |
| `npm run lint`  | Check code quality                           |

### **Database Commands**

```bash
npm run migrate          # Apply pending migrations
npm run migrate:reset    # Reset database (⚠️ destructive)
npm run generate         # Generate new migration
npm run studio          # Open Drizzle Studio (database GUI)
```

---

## 📚 **API Documentation**

### **Base URL**

- **Development**: `http://localhost:3000/api`
- **Production**: `https://your-app.onrender.com/api`

### **Core Endpoints**

#### **Health & Status**

- `GET /health` - System health check
- `GET /` - API information and endpoints

#### **Client API** (`/api/client/*`)

- `GET /dashboard` - Client dashboard data
- `GET /reports` - Client-specific reports
- `POST /requests` - Submit SEO requests

#### **Agency API** (`/api/agency/*`)

- `GET /clients` - Managed client list (anonymized)
- `GET /tasks` - Agency task queue
- `POST /reports` - Generate reports for clients

---

## 🚀 **Deployment**

### **Render Deployment (Recommended)**

This project is optimized for deployment on [Render](https://render.com).

```bash
# Quick deploy with Blueprint
# 1. Connect your GitHub repository to Render
# 2. Render will automatically detect render.yaml
# 3. Click "Apply" to deploy all services
```

See [Render Deployment Guide](docs/RENDER_DEPLOYMENT.md) for detailed instructions.

### **What Gets Deployed**

1. **Backend API** - Node.js web service
2. **Frontend Console** - Static React site with CDN
3. **PostgreSQL Database** - Managed database with backups
4. **Environment Variables** - Secure configuration

### **Production Checklist**

- [ ] Environment variables configured in Render Dashboard
- [ ] Database migrations applied
- [ ] Custom domain configured (optional)
- [ ] External service credentials verified
- [ ] Monitoring and alerts configured
- [ ] Backup strategy implemented

---

## 🤝 **Contributing**

We welcome contributions! Please follow our development workflow:

### **Development Workflow**

1. **Create Feature Branch**

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make Changes**

   - Follow TypeScript conventions
   - Add tests for new features
   - Update documentation

3. **Submit Pull Request**
   - Target the `main` branch
   - Include clear description
   - Ensure CI checks pass

---

## 🔧 **Troubleshooting**

### **Common Issues**

#### **Server Won't Start**

```bash
# Check Node version
node --version  # Should be >= 18.0.0

# Check environment configuration
npm run validate:env
```

#### **Database Connection Failed**

```bash
# For local development
pg_isready

# For Render deployment
# Check DATABASE_URL in environment variables
```

### **Getting Help**

- **Documentation**: Check `/docs` folder
- **Issues**: Create GitHub issue with reproduction steps
- **Deployment**: See [Render Deployment Guide](docs/RENDER_DEPLOYMENT.md)

---

## 📄 **License**

This project is proprietary software. All rights reserved.

---

**Ready to build amazing SEO solutions?** 🚀

For deployment support, check our [Render Deployment Guide](docs/RENDER_DEPLOYMENT.md).
