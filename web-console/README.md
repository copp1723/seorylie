# Seorylie Web Console

Modern, responsive web interface for the Seorylie SEO platform with comprehensive UI/UX design.

## Features

- **Dashboard**: Overview of SEO performance and activities
- **Chat Interface**: AI-powered SEO assistant
- **Request Management**: Create and track SEO service requests
- **Reports & Analytics**: SEO performance metrics and insights
- **Onboarding**: Multi-step business profile setup
- **Settings**: Account, notifications, security, and branding preferences
- **Orders**: Track service orders and deliverables
- **Internal Admin**: Administrative interface for system management

## Tech Stack

- **React 18** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS** for styling
- **React Router** for navigation
- **Lucide React** for icons
- **shadcn/ui** design system components

## Getting Started

### Prerequisites

- Node.js 18.0.0 or higher
- npm or yarn package manager

### Installation

1. Navigate to the web console directory:
```bash
cd web-console
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser and visit `http://localhost:5173`

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── ui/             # Base UI components
│   └── ChatWidget.tsx  # Chat interface component
├── contexts/           # React contexts
│   ├── AuthContext.tsx # Authentication state
│   └── BrandingContext.tsx # Theming and branding
├── layouts/           # Layout components
│   └── MainLayout.tsx # Main application layout
├── lib/              # Utilities
│   └── utils.ts      # Helper functions
├── pages/            # Page components
│   ├── Dashboard.tsx
│   ├── Chat.tsx
│   ├── Requests.tsx
│   ├── Reports.tsx
│   ├── Onboarding.tsx
│   ├── Settings.tsx
│   ├── Orders.tsx
│   └── Internal.tsx
├── App.tsx           # Main application component
├── main.tsx          # Application entry point
└── index.css         # Global styles
```

## Features Overview

### Authentication & Branding
- Mock authentication with role-based access
- White-label branding system
- Dynamic theme colors

### Dashboard
- Key performance metrics
- Recent activity tracking
- Quick action buttons
- Upcoming tasks overview

### Chat Interface
- AI-powered SEO assistant
- Real-time messaging simulation
- Suggested questions
- Branded experience

### Request Management
- Multi-type SEO request forms
- Request status tracking
- Search and filtering
- Form validation

### Reports & Analytics
- SEO performance metrics
- Keyword rankings
- Traffic analytics
- Visual charts (integration ready)

### Onboarding
- 4-step business profile setup
- Progressive form validation
- Goal selection interface
- Completion flow

### Settings
- Profile management
- Notification preferences
- Security settings
- Branding customization
- Website integration status

### Orders
- Service order tracking
- Payment status monitoring
- Deliverable management
- Download functionality

### Internal Admin
- System health monitoring
- Client management
- AI proxy status
- Analytics dashboard
- Role-based access control

## Customization

### Branding
The application supports white-label branding through the `BrandingContext`. You can customize:
- Company name
- Primary and secondary colors
- Theme (light/dark)
- Logo (integration ready)

### API Integration
The application is designed to integrate with the backend API. Replace mock data with actual API calls in:
- Authentication flows
- Data fetching
- Form submissions
- Real-time updates

## Production Deployment

1. Build the application:
```bash
npm run build
```

2. The built files will be in the `dist/` directory
3. Deploy to your hosting provider
4. Configure environment variables for production API endpoints

## Contributing

1. Follow the existing code structure
2. Use TypeScript for type safety
3. Follow the established naming conventions
4. Test thoroughly before submitting changes

## License

Private - OneKeel Engineering