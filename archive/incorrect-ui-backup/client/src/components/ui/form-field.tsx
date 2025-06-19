import React from "react";
import { AlertCircle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface FieldError {
  message: string;
  code?: string;
}

export interface FormFieldProps {
  label: string;
  name: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: FieldError | string;
  success?: boolean;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  helperText?: string;
  variant?: "input" | "textarea";
  rows?: number;
  className?: string;
  inputClassName?: string;
}

export function FormField({
  label,
  name,
  type = "text",
  value,
  onChange,
  onBlur,
  error,
  success,
  required,
  disabled,
  placeholder,
  helperText,
  variant = "input",
  rows = 3,
  className,
  inputClassName,
}: FormFieldProps) {
  const hasError = Boolean(error);
  const errorMessage = typeof error === "string" ? error : error?.message;
  const fieldId = `field-${name}`;
  const errorId = `${fieldId}-error`;
  const helperId = `${fieldId}-helper`;

  const inputProps = {
    id: fieldId,
    name,
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange(e.target.value),
    onBlur,
    placeholder,
    disabled,
    required,
    "aria-invalid": hasError,
    "aria-describedby": cn(errorMessage && errorId, helperText && helperId),
    className: cn(
      // Base styles
      "transition-colors duration-200",
      // Error styles
      hasError && "border-red-500 focus:border-red-500 focus:ring-red-500/20",
      // Success styles
      success &&
        !hasError &&
        "border-green-500 focus:border-green-500 focus:ring-green-500/20",
      inputClassName,
    ),
  };

  return (
    <div className={cn("space-y-2", className)}>
      {/* Label */}
      <Label
        htmlFor={fieldId}
        className={cn(
          "text-sm font-medium",
          hasError && "text-red-700",
          success && !hasError && "text-green-700",
        )}
      >
        {label}
        {required && (
          <span className="text-red-500 ml-1" aria-label="required">
            *
          </span>
        )}
      </Label>

      {/* Input/Textarea */}
      <div className="relative">
        {variant === "textarea" ? (
          <Textarea {...inputProps} rows={rows} />
        ) : (
          <Input {...inputProps} type={type} />
        )}

        {/* Status Icon */}
        {(hasError || success) && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            {hasError ? (
              <AlertCircle className="h-5 w-5 text-red-500" />
            ) : success ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : null}
          </div>
        )}
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div
          id={errorId}
          className="flex items-start gap-2 text-sm text-red-600"
          role="alert"
          aria-live="polite"
        >
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Helper Text */}
      {helperText && !errorMessage && (
        <p id={helperId} className="text-sm text-muted-foreground">
          {helperText}
        </p>
      )}

      {/* Success Message */}
      {success && !hasError && (
        <div className="flex items-center gap-2 text-sm text-green-600">
          <CheckCircle className="h-4 w-4" />
          <span>Valid</span>
        </div>
      )}
    </div>
  );
}

// Enhanced form wrapper with validation state management
export interface FormErrors {
  [key: string]: FieldError | string | undefined;
}

export interface FormValidationProps {
  children: React.ReactNode;
  errors?: FormErrors;
  onSubmit?: (e: React.FormEvent) => void;
  isSubmitting?: boolean;
  className?: string;
}

export function FormValidation({
  children,
  errors = {},
  onSubmit,
  isSubmitting,
  className,
}: FormValidationProps) {
  const hasErrors = Object.values(errors).some((error) => Boolean(error));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasErrors && !isSubmitting && onSubmit) {
      onSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={cn("space-y-4", className)}>
      {children}

      {/* Global form errors */}
      {hasErrors && (
        <div className="rounded-md bg-red-50 border border-red-200 p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Please fix the following errors:
              </h3>
              <div className="mt-2 text-sm text-red-700">
                <ul className="list-disc list-inside space-y-1">
                  {Object.entries(errors).map(([field, error]) => {
                    if (!error) return null;
                    const message =
                      typeof error === "string" ? error : error.message;
                    return (
                      <li key={field}>
                        <span className="font-medium capitalize">{field}:</span>{" "}
                        {message}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}

// Validation utilities
export const validators = {
  required: (value: string, message = "This field is required") =>
    !value.trim() ? { message } : undefined,

  email: (value: string, message = "Please enter a valid email address") => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return value && !emailRegex.test(value) ? { message } : undefined;
  },

  minLength: (min: number, message?: string) => (value: string) => {
    const defaultMessage = `Must be at least ${min} characters`;
    return value && value.length < min
      ? { message: message || defaultMessage }
      : undefined;
  },

  maxLength: (max: number, message?: string) => (value: string) => {
    const defaultMessage = `Must be no more than ${max} characters`;
    return value && value.length > max
      ? { message: message || defaultMessage }
      : undefined;
  },

  pattern:
    (regex: RegExp, message = "Invalid format") =>
    (value: string) => {
      return value && !regex.test(value) ? { message } : undefined;
    },

  phone: (value: string, message = "Please enter a valid phone number") => {
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    return value && !phoneRegex.test(value.replace(/[\s\-\(\)]/g, ""))
      ? { message }
      : undefined;
  },
};

// Compose multiple validators
export function composeValidators(
  ...validators: Array<(value: string) => FieldError | undefined>
) {
  return (value: string): FieldError | undefined => {
    for (const validator of validators) {
      const error = validator(value);
      if (error) return error;
    }
    return undefined;
  };
}
