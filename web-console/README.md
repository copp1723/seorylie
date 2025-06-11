# Seorylie Web Console

A modern, comprehensive SEO management platform with real-time AI assistance, detailed analytics, and white-label branding capabilities.

## 🚀 Features

### 🏠 **Core Platform**
- **Dashboard**: KPI metrics, recent activity, and quick actions
- **AI Chat**: Real-time SEO assistant with WebSocket support
- **Request Management**: Multi-type SEO request forms with validation
- **Analytics & Reports**: Performance metrics with visual charts
- **Order Tracking**: Service orders with payment management
- **Settings**: Profile, notifications, security, and branding

### 🎨 **White-Label Branding**
- Dynamic company branding with custom colors
- Theme switching (light/dark)
- Logo upload and customization
- Brand-consistent UI throughout

### 🔐 **Authentication & Security**
- JWT-based authentication with refresh tokens
- Role-based access control (Client, Agency, Admin)
- Two-factor authentication support
- Session management

### 📊 **Admin Dashboard**
- Client management and analytics
- System health monitoring
- Real-time metrics and logs
- Feature flag management
- Billing and subscription tracking

### 🛠 **Technical Features**
- **React 18** with TypeScript for type safety
- **React Query** for efficient data fetching and caching
- **Tailwind CSS** with shadcn/ui components
- **WebSocket** support for real-time features
- **Zod** validation for all forms and API data
- **Error boundaries** with user-friendly fallbacks

## 🛠 Tech Stack

- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS + shadcn/ui
- **State Management**: React Query (TanStack Query)
- **Routing**: React Router v6
- **HTTP Client**: Axios
- **Validation**: Zod
- **Icons**: Lucide React
- **Error Handling**: react-error-boundary

## 📋 Prerequisites

- Node.js 18.0.0 or higher
- npm or yarn package manager
- Backend API server (see API Integration section)

## 🚀 Quick Start

### 1. **Clone and Install**
```bash
# Navigate to web console directory
cd web-console

# Install dependencies
npm install

# Copy environment file
cp .env.example .env.development

Configure Environment
VITE_API_BASE_URL=http://localhost:8000/api
VITE_WEBSOCKET_URL=ws://localhost:8000/ws
VITE_APP_NAME=Seorylie
VITE_APP_VERSION=1.0.0

Start Development Server
npm run dev

Open Application
Visit http://localhost:5173 in your browser.

Available Scripts
# Development
npm run dev          # Start development server with hot reload

# Building
npm run build        # Build for production
npm run preview      # Preview production build

# Code Quality
npm run lint         # Run ESLint
npm run type-check   # Run TypeScript compiler check

Project Structure
src/
├── components/          # Reusable UI components
│   ├── ui/             # Base shadcn/ui components
│   ├── ErrorBoundary.tsx
│   ├── LoadingSpinner.tsx
│   └── ChatWidget.tsx
├── contexts/           # React contexts
│   ├── AuthContext.tsx
│   └── BrandingContext.tsx
├── hooks/              # Custom React hooks
│   ├── useAuth.ts
│   ├── useRequests.ts
│   ├── useReports.ts
│   ├── useChat.ts
│   ├── useOrders.ts
│   ├── useSettings.ts
│   ├── useAdmin.ts
│   └── useOnboarding.ts
├── layouts/           # Layout components
│   └── MainLayout.tsx
├── lib/               # Utilities and configuration
│   ├── api.ts         # Axios configuration
│   ├── queryClient.ts # React Query setup
│   └── utils.ts       # Helper functions
├── pages/             # Page components
│   ├── Dashboard.tsx
│   ├── Chat.tsx
│   ├── Requests.tsx
│   ├── Reports.tsx
│   ├── Onboarding.tsx
│   ├── Settings.tsx
│   ├── Orders.tsx
│   └── Internal.tsx
├── schemas/           # Zod validation schemas
│   └── validation.ts
├── services/          # API service modules
│   ├── auth.ts
│   ├── requests.ts
│   ├── reports.ts
│   ├── chat.ts
│   ├── orders.ts
│   ├── settings.ts
│   ├── admin.ts
│   └── onboarding.ts
├── types/             # TypeScript type definitions
│   └── api.ts
├── utils/             # Utility functions
│   ├── constants.ts
│   ├── formatting.ts
│   └── errorHandling.ts
├── App.tsx            # Main application component
├── main.tsx           # Application entry point
└── index.css          # Global styles

API Integration
Required Backend Endpoints
The frontend expects these API endpoints to be available:

Authentication
POST /auth/login           # User login
POST /auth/logout          # User logout
GET  /auth/profile         # Get user profile
POST /auth/refresh         # Refresh access token
POST /auth/forgot-password # Password reset request
POST /auth/reset-password  # Password reset

Requests
GET    /requests           # List requests with filters
POST   /requests           # Create new request
GET    /requests/:id       # Get single request
PUT    /requests/:id       # Update request
DELETE /requests/:id       # Delete request
GET    /requests/stats     # Get request statistics

Reports & Analytics
GET /reports/metrics       # Dashboard metrics
GET /reports/keywords      # Keyword rankings
GET /reports/traffic       # Traffic data
GET /reports/top-pages     # Top performing pages
GET /reports/conversions   # Conversion data

Chat
POST /chat/messages        # Send message to AI
GET  /chat/messages        # Get chat history
GET  /chat/threads         # Get chat threads
WS   /ws/chat/:threadId    # WebSocket for real-time chat

Orders
GET  /orders               # List orders
POST /orders               # Create order
GET  /orders/:id           # Get order details
POST /orders/:id/payment   # Process payment

Settings
GET /settings/profile      # Get user profile
PUT /settings/profile      # Update profile
GET /settings/branding     # Get branding settings
PUT /settings/branding     # Update branding

Admin (Role-restricted)
GET /admin/clients         # List clients
GET /admin/system/health   # System health
GET /admin/analytics       # Admin analytics

API Response Format
All API responses should follow this format:
{
  "success": boolean,
  "data": any,
  "message"?: string
}

Authentication Flow
User submits login credentials
Backend validates and returns JWT tokens
Frontend stores tokens in localStorage
All subsequent requests include Bearer token
Refresh token used for token renewal
🎨 Customization
Branding
The application supports full white-label customization:

Company Name: Dynamic throughout the UI
Colors: Primary, secondary, and accent colors
Theme: Light/dark mode support
Logo: Upload custom logo (API integration required)
Adding New Pages
Create page component in src/pages/
Add route to src/App.tsx
Update navigation in src/layouts/MainLayout.tsx
Add any required API services and hooks
Adding New API Endpoints
Add types to src/types/api.ts
Create service functions in src/services/
Create custom hooks in src/hooks/
Add validation schemas in src/schemas/

🚀 Deployment
Production Build
# Install dependencies
npm install

# Build for production
npm run build

# Files will be in dist/ directory

Environment Configuration
Create .env.production for production settings:
VITE_API_BASE_URL=https://api.yourdomain.com/api
VITE_WEBSOCKET_URL=wss://api.yourdomain.com/ws
VITE_APP_NAME=Your Company Name
VITE_APP_VERSION=1.0.0

Hosting Options
Render: Zero-config deployment
Netlify: Static site hosting
AWS S3 + CloudFront: Scalable hosting
Docker: Containerized deployment
Docker Deployment

FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "preview"]

Development
Code Style
TypeScript for type safety
ESLint for code quality
Prettier for formatting
Consistent naming conventions
State Management
React Query for server state
React Context for global client state
Local state with useState/useReducer
Error Handling
Global error boundary
API error interceptors
User-friendly error messages
Retry logic for failed requests
Performance
Code splitting with React.lazy
Image optimization
Bundle size optimization
Caching with React Query
🐛 Troubleshooting
Common Issues
API Connection Failed

Check VITE_API_BASE_URL in environment file
Ensure backend server is running
Verify CORS configuration
Authentication Issues

Clear localStorage and try again
Check token expiration
Verify API endpoint responses
Build Failures

Clear node_modules and reinstall
Check TypeScript errors
Verify all dependencies are installed
WebSocket Not Connecting

Check VITE_WEBSOCKET_URL configuration
Verify WebSocket endpoint on backend
Check browser console for errors
📖 API Documentation
For complete API documentation, visit your backend API docs or see the service files in src/services/ for expected request/response formats.

🤝 Contributing
Follow existing code patterns
Add TypeScript types for all new features
Include error handling
Test thoroughly before submitting
Update documentation as needed
📄 License
Private - OneKeel Engineering

