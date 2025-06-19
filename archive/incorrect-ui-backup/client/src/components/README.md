# Component Organization

This directory contains all React components used in the application, organized by their functional domain.

## Directory Structure

- `/auth` - Authentication-related components
- `/chat` - Chat and conversation interface components
- `/dashboard` - Dashboard-specific components
- `/inventory` - Vehicle inventory components
- `/common` - Reusable UI components
- `/forms` - Form components
- `/layout` - Layout components (headers, sidebars, etc.)
- `/ui` - Base UI components (from shadcn/ui)

## Component Guidelines

1. **Naming Conventions**:

   - Use PascalCase for component files (e.g., `VehicleCard.tsx`)
   - Use kebab-case for CSS modules (e.g., `vehicle-card.module.css`)

2. **Component Structure**:

   - Keep components focused on a single responsibility
   - Extract complex logic into custom hooks
   - Use TypeScript interfaces for props

3. **Export Patterns**:

   - Use named exports for utility components
   - Use default exports for main components

4. **Props Interfaces**:

   - Define prop interfaces at the top of the file
   - For large interfaces, move to separate files in a `types` folder

5. **Styling**:
   - Use CSS modules or styled components
   - Keep component-specific styles with the component
   - Use theme variables for consistent styling

## Example Component

```tsx
import React from "react";
import { Button } from "../ui/button";
import "./component-name.css";

interface ComponentNameProps {
  title: string;
  onAction: () => void;
}

export const ComponentName: React.FC<ComponentNameProps> = ({
  title,
  onAction,
}) => {
  return (
    <div className="component-container">
      <h2>{title}</h2>
      <Button onClick={onAction}>Click Me</Button>
    </div>
  );
};
```
