# 🚀 Post-Merge Setup Guide

**After merging the feature branch, follow these steps to get the web console running:**

---

## 🔧 **1. Install Dependencies**

```bash
# Navigate to web console
cd web-console

# Install all dependencies
npm install
```

**Expected output:**
- Installation of React, TypeScript, Vite, and all API dependencies
- Should complete without errors

---

## ⚙️ **2. Configure Environment**

```bash
# Copy environment template
cp .env.example .env.development
```

**Edit `.env.development`:**
```env
VITE_API_BASE_URL=http://localhost:8000/api
VITE_WEBSOCKET_URL=ws://localhost:8000/ws
VITE_APP_NAME=Seorylie
VITE_APP_VERSION=1.0.0
```

**For production, create `.env.production`:**
```env
VITE_API_BASE_URL=https://api.yourdomain.com/api
VITE_WEBSOCKET_URL=wss://api.yourdomain.com/ws
VITE_APP_NAME=Your Company Name
VITE_APP_VERSION=1.0.0
```

---

## 🏃‍♂️ **3. Start Development Server**

```bash
# Start the development server
npm run dev
```

**Expected output:**
```
  VITE v4.4.5  ready in 500ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
  ➜  press h to show help
```

**Visit:** `http://localhost:5173`

---

## ✅ **4. Verify Build**

```bash
# Test production build
npm run build

# Preview production build
npm run preview
```

**Expected output:**
- Successful TypeScript compilation
- Optimized production bundle
- No build errors

---

## 🔍 **5. Test Key Features**

### **Dashboard**
- Visit `http://localhost:5173/`
- Should see metrics, charts, and quick actions
- All components should render without errors

### **Chat Interface**
- Navigate to `/chat`
- Test sending messages
- Verify AI assistant responses

### **Request Management**
- Go to `/requests`
- Test creating new requests
- Verify form validation

### **Settings**
- Access `/settings`
- Test branding customization
- Verify color changes apply

### **Admin Dashboard** (if applicable)
- Visit `/internal`
- Should show system metrics
- Verify role-based access

---

## 🔗 **6. API Integration Checklist**

### **When Backend is Ready:**

1. **Update Environment Variables**
   ```env
   VITE_API_BASE_URL=http://your-backend:8000/api
   ```

2. **Test Authentication**
   - Login should work with real credentials
   - JWT tokens should be stored
   - Protected routes should redirect

3. **Verify Data Loading**
   - Dashboard metrics load from API
   - Request lists populate with real data
   - Reports show actual analytics

4. **Test WebSocket Connection**
   - Chat should connect to WebSocket
   - Real-time updates should work
   - Connection status should be accurate

---

## 🚨 **Common Issues & Solutions**

### **Issue: Dependencies fail to install**
```bash
# Clear cache and retry
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### **Issue: TypeScript errors**
```bash
# Check TypeScript configuration
npm run type-check

# Fix path imports if needed
```

### **Issue: API connection fails**
- Verify `VITE_API_BASE_URL` is correct
- Check backend server is running
- Confirm CORS is configured
- Look for network errors in browser console

### **Issue: WebSocket won't connect**
- Verify `VITE_WEBSOCKET_URL` is correct
- Check backend WebSocket server
- Ensure no firewall blocking

### **Issue: Build fails**
```bash
# Check for TypeScript errors
npm run lint

# Fix any linting issues
# Ensure all imports are correct
```

---

## 🎯 **Development Workflow**

### **Daily Development:**
```bash
cd web-console
npm run dev
# Make changes
# Browser auto-refreshes
```

### **Before Committing:**
```bash
npm run lint      # Check code quality
npm run build     # Verify production build
```

### **Deployment:**
```bash
npm run build     # Create production build
# Deploy dist/ folder to your hosting
```

---

## 📚 **Next Steps**

1. **Backend Integration**
   - Implement the required API endpoints
   - Set up WebSocket server for chat
   - Configure authentication system

2. **Customization**
   - Update branding colors and logos
   - Modify company information
   - Add custom functionality

3. **Production Deployment**
   - Set up hosting (Vercel, Netlify, AWS)
   - Configure CI/CD pipeline
   - Set up monitoring and analytics

4. **Testing**
   - Set up automated tests
   - Perform user acceptance testing
   - Load test with real data

---

## 🆘 **Need Help?**

- **Documentation**: Check `README.md` for detailed guides
- **API Specs**: See service files in `src/services/`
- **Issues**: Check browser console for error messages
- **TypeScript**: Verify all types in `src/types/api.ts`

---

**🎉 Congratulations! Your Seorylie web console is ready for development.**