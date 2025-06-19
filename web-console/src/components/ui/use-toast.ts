import { useState } from "react";

type ToastProps = {
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
  duration?: number;
};

export function useToast() {
  const [toasts, setToasts] = useState<ToastProps[]>([]);

  const toast = (props: ToastProps) => {
    const duration = props.duration || 5000;
    
    // For now, just use console.log and alert for demonstration
    console.log("Toast:", props);
    
    if (props.variant === "destructive") {
      alert(`Error: ${props.title || 'Error'}\n${props.description || ''}`);
    } else {
      console.log(`${props.title || 'Success'}: ${props.description || ''}`);
    }

    // Add to toasts array
    const newToast = { ...props, id: Date.now() };
    setToasts(prev => [...prev, newToast]);

    // Remove after duration
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== newToast.id));
    }, duration);
  };

  return { toast, toasts };
}

