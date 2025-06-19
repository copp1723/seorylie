import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";
import { useToast } from "@/components/ui/use-toast";
import { CheckCircle, AlertCircle, XCircle, Info, Clock } from "lucide-react";

const TOAST_ICONS = {
  default: Info,
  destructive: XCircle,
  success: CheckCircle,
  warning: AlertCircle,
  info: Info,
  loading: Clock,
} as const;

const ICON_CLASSES = {
  default: "text-blue-600",
  destructive: "text-red-600",
  success: "text-green-600",
  warning: "text-yellow-600",
  info: "text-blue-600",
  loading: "text-gray-600 animate-spin",
} as const;

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({
        id,
        title,
        description,
        action,
        variant = "default",
        ...props
      }) {
        const Icon = TOAST_ICONS[variant];
        const iconClass = ICON_CLASSES[variant];

        return (
          <Toast key={id} variant={variant} {...props}>
            <div className="flex items-start gap-3 w-full">
              {/* Icon */}
              <div className="flex-shrink-0 mt-0.5">
                <Icon className={`h-5 w-5 ${iconClass}`} />
              </div>

              {/* Content */}
              <div className="flex-1 grid gap-1">
                {title && <ToastTitle>{title}</ToastTitle>}
                {description && (
                  <ToastDescription>{description}</ToastDescription>
                )}
              </div>

              {/* Action */}
              {action && <div className="flex-shrink-0">{action}</div>}
            </div>
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
