# Common Components

This directory contains reusable UI components that are used across multiple features of the application.

## Component List

- `Button` - Standard button component with various styles
- `Card` - Container component with consistent styling
- `Modal` - Popup dialog component
- `Pagination` - Page navigation component
- `LoadingSpinner` - Loading indicator
- `ErrorBoundary` - Component for catching and displaying errors
- `EmptyState` - Component for displaying empty data states

## Usage Guidelines

1. Components in this directory should be:
   - Highly reusable
   - Presentational (minimal business logic)
   - Well-documented with prop types
   - Accessible

2. When adding a new common component:
   - Ensure it's truly reusable across features
   - Add proper TypeScript interfaces
   - Include basic unit tests
   - Document props and usage examples