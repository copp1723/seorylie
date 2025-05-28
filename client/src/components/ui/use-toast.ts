import * as React from "react";
import { CheckCircle, AlertCircle, XCircle, Info, Clock } from "lucide-react";

import type { ToastActionElement, ToastProps } from "@/components/ui/toast";

const TOAST_LIMIT = 5;
const TOAST_REMOVE_DELAY = 1000;

type ToastVariant = "default" | "destructive" | "success" | "warning" | "info" | "loading";

type ToasterToast = ToastProps & {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
  variant?: ToastVariant;
};

const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
} as const;

let count = 0;

function genId() {
  count = (count + 1) % Number.MAX_VALUE;
  return count.toString();
}

type ActionType = typeof actionTypes;

type Action =
  | {
      type: ActionType["ADD_TOAST"];
      toast: ToasterToast;
    }
  | {
      type: ActionType["UPDATE_TOAST"];
      toast: Partial<ToasterToast>;
    }
  | {
      type: ActionType["DISMISS_TOAST"];
      toastId?: string;
    }
  | {
      type: ActionType["REMOVE_TOAST"];
      toastId?: string;
    };

interface State {
  toasts: ToasterToast[];
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case actionTypes.ADD_TOAST:
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      };

    case actionTypes.UPDATE_TOAST:
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t,
        ),
      };

    case actionTypes.DISMISS_TOAST: {
      const { toastId } = action;

      // ! Side effects
      if (toastId) {
        toastTimeouts.forEach((_, key) => {
          if (key === toastId) {
            toastTimeouts.delete(key);
          }
        });
      } else {
        toastTimeouts.forEach((_, key) => {
          toastTimeouts.delete(key);
        });
      }

      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? {
                ...t,
                open: false,
              }
            : t,
        ),
      };
    }
    case actionTypes.REMOVE_TOAST:
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: [],
        };
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      };
  }
};

const listeners: Array<(state: State) => void> = [];

let memoryState: State = { toasts: [] };

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action);
  listeners.forEach((listener) => {
    listener(memoryState);
  });
}

type Toast = Omit<ToasterToast, "id">;

function toast({ ...props }: Toast) {
  const id = genId();

  const update = (props: ToasterToast) =>
    dispatch({
      type: actionTypes.UPDATE_TOAST,
      toast: { ...props, id },
    });
  const dismiss = () =>
    dispatch({ type: actionTypes.DISMISS_TOAST, toastId: id });

  dispatch({
    type: actionTypes.ADD_TOAST,
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) dismiss();
      },
    },
  });

  return {
    id: id,
    dismiss,
    update,
  };
}

function useToast() {
  const [state, setState] = React.useState<State>(memoryState);

  React.useEffect(() => {
    listeners.push(setState);
    return () => {
      const index = listeners.indexOf(setState);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }, [state]);

  const success = (props: Omit<Toast, "variant">) => {
    return toast({ ...props, variant: "success" });
  };

  const error = (props: Omit<Toast, "variant">) => {
    return toast({ ...props, variant: "destructive" });
  };

  const warning = (props: Omit<Toast, "variant">) => {
    return toast({ ...props, variant: "warning" });
  };

  const info = (props: Omit<Toast, "variant">) => {
    return toast({ ...props, variant: "info" });
  };

  const loading = (props: Omit<Toast, "variant">) => {
    return toast({ ...props, variant: "loading" });
  };

  return {
    ...state,
    toast,
    success,
    error,
    warning,
    info,
    loading,
    dismiss: (toastId?: string) =>
      dispatch({ type: actionTypes.DISMISS_TOAST, toastId }),
  };
}

// Convenience functions for direct use
const toastSuccess = (props: Omit<Toast, "variant">) => {
  return toast({ ...props, variant: "success" });
};

const toastError = (props: Omit<Toast, "variant">) => {
  return toast({ ...props, variant: "destructive" });
};

const toastWarning = (props: Omit<Toast, "variant">) => {
  return toast({ ...props, variant: "warning" });
};

const toastInfo = (props: Omit<Toast, "variant">) => {
  return toast({ ...props, variant: "info" });
};

const toastLoading = (props: Omit<Toast, "variant">) => {
  return toast({ ...props, variant: "loading" });
};

export { 
  useToast, 
  toast, 
  toastSuccess, 
  toastError, 
  toastWarning, 
  toastInfo, 
  toastLoading 
};
