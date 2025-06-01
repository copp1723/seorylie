import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";
import type { TabsProps, TabsListProps, TabsTriggerProps, TabsContentProps } from './types';

const Tabs = React.memo(React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Root>,
  TabsProps
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Root
    ref={ref}
    className={cn("", className)}
    {...props}
  />
)));
Tabs.displayName = "Tabs";

const TabsList = React.memo(React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  TabsListProps
>(({ className, ...props }, ref) => {
  const computedClassName = React.useMemo(() => cn(
    "inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground",
    className,
  ), [className]);

  return (
    <TabsPrimitive.List
      ref={ref}
      className={computedClassName}
      {...props}
    />
  );
}));
TabsList.displayName = "TabsList";

const TabsTrigger = React.memo(React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  TabsTriggerProps
>(({ className, ...props }, ref) => {
  const computedClassName = React.useMemo(() => cn(
    "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
    className,
  ), [className]);

  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={computedClassName}
      {...props}
    />
  );
}));
TabsTrigger.displayName = "TabsTrigger";

const TabsContent = React.memo(React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  TabsContentProps
>(({ className, ...props }, ref) => {
  const computedClassName = React.useMemo(() => cn(
    "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    className,
  ), [className]);

  return (
    <TabsPrimitive.Content
      ref={ref}
      className={computedClassName}
      {...props}
    />
  );
}));
TabsContent.displayName = "TabsContent";

export { Tabs, TabsList, TabsTrigger, TabsContent };