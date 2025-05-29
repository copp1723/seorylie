import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";

// Create a TooltipProvider component that wraps the Radix UI TooltipProvider
const TooltipProvider = TooltipPrimitive.Provider;

// Create a Tooltip component that wraps the Radix UI Tooltip
const Tooltip = TooltipPrimitive.Root;

// Create a TooltipTrigger component that wraps the Radix UI TooltipTrigger
const TooltipTrigger = TooltipPrimitive.Trigger;

// Create a TooltipContent component that wraps the Radix UI TooltipContent with styling
const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
      "z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
      className
    )}
    {...props}
  />
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

// Create a simple wrapper component for easier usage
interface SimpleTooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  delayDuration?: number;
  skipDelayDuration?: number;
  className?: string;
  contentClassName?: string;
}

const SimpleTooltip: React.FC<SimpleTooltipProps> = ({
  content,
  children,
  side = "top",
  align = "center",
  delayDuration = 300,
  skipDelayDuration = 300,
  className,
  contentClassName,
}) => (
  <Tooltip delayDuration={delayDuration} skipDelayDuration={skipDelayDuration}>
    <TooltipTrigger asChild className={className}>
      {children}
    </TooltipTrigger>
    <TooltipContent 
      side={side} 
      align={align} 
      className={contentClassName}
      aria-label={typeof content === 'string' ? content : undefined}
    >
      {content}
    </TooltipContent>
  </Tooltip>
);

// Export the components
export {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
  SimpleTooltip as default,
};
