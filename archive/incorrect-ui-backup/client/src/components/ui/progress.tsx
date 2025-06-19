import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Define variants and sizes for the progress bar using class-variance-authority
const progressVariants = cva(
  "relative w-full overflow-hidden rounded-full bg-secondary transition-all",
  {
    variants: {
      size: {
        sm: "h-1",
        default: "h-2",
        lg: "h-3",
      },
      variant: {
        default: "",
        primary: "",
        success: "",
        warning: "",
        destructive: "",
      },
    },
    defaultVariants: {
      size: "default",
      variant: "default",
    },
  },
);

// Define variants for the indicator
const indicatorVariants = cva("h-full w-full flex-1 transition-all", {
  variants: {
    variant: {
      default: "bg-primary",
      primary: "bg-primary",
      success: "bg-green-500 dark:bg-green-600",
      warning: "bg-yellow-500 dark:bg-yellow-600",
      destructive: "bg-destructive",
    },
    indeterminate: {
      true: "animate-progress-indeterminate",
    },
  },
  defaultVariants: {
    variant: "default",
    indeterminate: false,
  },
});

// Extend the Progress component props with our variants
export interface ProgressProps
  extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>,
    VariantProps<typeof progressVariants> {
  value?: number;
  max?: number;
  showValue?: boolean;
  valueLabel?: string;
  indeterminate?: boolean;
  formatValue?: (value: number, max: number) => string;
  labelPosition?: "inside" | "outside" | "none";
}

// Create the Progress component
const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  ProgressProps
>(
  (
    {
      className,
      value = 0,
      max = 100,
      showValue = false,
      valueLabel,
      indeterminate = false,
      formatValue,
      labelPosition = "none",
      size,
      variant,
      ...props
    },
    ref,
  ) => {
    // Calculate the percentage for ARIA attributes
    const percentage = Math.round((value / max) * 100);

    // Format the value for display
    const formattedValue = React.useMemo(() => {
      if (formatValue) {
        return formatValue(value, max);
      }
      return valueLabel ? `${valueLabel}: ${percentage}%` : `${percentage}%`;
    }, [value, max, formatValue, valueLabel, percentage]);

    return (
      <div className="relative w-full">
        {showValue && labelPosition === "outside" && (
          <div className="mb-1 flex justify-between text-xs">
            <span>{formattedValue}</span>
            <span>{max}</span>
          </div>
        )}

        <ProgressPrimitive.Root
          ref={ref}
          className={cn(progressVariants({ size, variant }), className)}
          {...props}
          value={indeterminate ? undefined : value}
          max={max}
          aria-valuemin={0}
          aria-valuemax={max}
          aria-valuenow={indeterminate ? undefined : value}
          aria-valuetext={formattedValue}
          aria-label={valueLabel || "Progress"}
          data-indeterminate={indeterminate ? "true" : undefined}
          data-state={indeterminate ? "indeterminate" : "determinate"}
        >
          <ProgressPrimitive.Indicator
            className={cn(
              indicatorVariants({
                variant,
                indeterminate,
              }),
              indeterminate ? "w-[30%]" : "w-[var(--progress)]",
            )}
            style={
              indeterminate
                ? {}
                : ({ "--progress": `${percentage}%` } as React.CSSProperties)
            }
          >
            {showValue && labelPosition === "inside" && (
              <div className="absolute inset-0 flex items-center justify-center text-xs font-medium text-white">
                {formattedValue}
              </div>
            )}
          </ProgressPrimitive.Indicator>
        </ProgressPrimitive.Root>
      </div>
    );
  },
);

Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
