# Form Components

This directory contains reusable form components and form-related utilities.

## Component List

- `FormField` - Base component for form fields with label and error handling
- `TextInput` - Text input component with validation
- `SelectInput` - Dropdown select component
- `Checkbox` - Checkbox input component
- `RadioGroup` - Radio button group component
- `DatePicker` - Date selection component
- `FileUpload` - File upload component
- `FormSection` - Component for grouping related form fields
- `FormActions` - Component for form action buttons (submit, cancel, etc.)

## Usage Guidelines

1. Form components should:

   - Handle validation and error states consistently
   - Support accessibility features (labels, ARIA attributes)
   - Work with form libraries (React Hook Form, Formik)
   - Maintain consistent styling

2. When adding new form components:
   - Ensure proper keyboard navigation
   - Include clear validation feedback
   - Document required props and validation options
   - Consider mobile usability
