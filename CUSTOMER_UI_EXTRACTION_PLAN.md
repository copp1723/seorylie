# Customer UI Extraction Plan

## What's Already Built in feature/seowerks-integration

### Core Components:
1. **Dashboard** - Professional SEO dashboard with stats
2. **Chat** - Enhanced chat interface with intelligent responses  
3. **Requests** - Submit and track SEO requests
4. **Reports** - Analytics and performance reports
5. **Settings** - Branding and configuration
6. **Onboarding** - Client onboarding flow

### UI Components:
- Buttons, Cards, Tables, Forms
- Authentication context
- Branding context
- Responsive layouts

## Extraction Strategy

### Option 1: Static Build (Quick)
- Build the React app on feature branch
- Copy the built files
- Serve as static site
- Pros: Fast, no build complexity
- Cons: Not easily editable

### Option 2: Gradual Migration (Recommended)
- Extract one page at a time
- Convert to standalone HTML/JS
- Keep same styling and functionality
- Pros: No React dependency, easy to modify
- Cons: Takes more time

### Option 3: Full React App (Complex)
- Set up complete React build pipeline
- Extract entire web-console
- Pros: Full functionality
- Cons: Complex deployment, build times

## Next Steps

1. **Start with Dashboard page**
   - Extract styling
   - Convert components to vanilla JS
   - Maintain professional look

2. **Add Requests page**
   - Form for submitting SEO requests
   - Integrates with webhook API

3. **Enhanced Chat**
   - Better UI than current chat.html
   - More intelligent responses

## Current URLs:
- Admin Dashboard: `/dashboard` ✅
- Chat Interface: `/chat` ✅
- Customer UI: Coming soon...

## Implementation Plan:
1. Create `/app` endpoint for customer UI
2. Extract Dashboard component
3. Convert to standalone HTML
4. Add navigation between pages
5. Integrate with existing APIs