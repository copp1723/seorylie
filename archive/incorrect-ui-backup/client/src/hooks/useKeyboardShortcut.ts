import { useEffect, useCallback, useRef } from "react";

// Types for keyboard shortcuts
export interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
  description?: string;
  preventDefault?: boolean;
  stopPropagation?: boolean;
  enabled?: boolean;
  global?: boolean;
}

export interface KeyboardShortcutOptions {
  /**
   * Whether the shortcut should work when inputs are focused
   * @default false
   */
  allowInInputs?: boolean;

  /**
   * Whether to prevent default browser behavior
   * @default true
   */
  preventDefault?: boolean;

  /**
   * Whether to stop event propagation
   * @default true
   */
  stopPropagation?: boolean;

  /**
   * Whether the shortcut is enabled
   * @default true
   */
  enabled?: boolean;

  /**
   * Whether the shortcut should work globally (outside the component)
   * @default false
   */
  global?: boolean;
}

export interface KeyboardShortcutHook {
  register: (
    shortcuts: KeyboardShortcut[],
    callback: (shortcut: KeyboardShortcut) => void,
  ) => () => void;
  unregister: (shortcuts: KeyboardShortcut[]) => void;
  isPressed: (key: string) => boolean;
}

type KeyboardEventHandler = (event: KeyboardEvent) => void;

// Main hook that returns a management interface
export const useKeyboardShortcut = (): KeyboardShortcutHook => {
  const shortcutsRef = useRef<
    Map<
      string,
      {
        shortcut: KeyboardShortcut;
        callback: (shortcut: KeyboardShortcut) => void;
      }
    >
  >(new Map());
  const pressedKeysRef = useRef<Set<string>>(new Set());

  const createShortcutKey = useCallback(
    (shortcut: KeyboardShortcut): string => {
      const modifiers = [];
      if (shortcut.ctrlKey) modifiers.push("ctrl");
      if (shortcut.shiftKey) modifiers.push("shift");
      if (shortcut.altKey) modifiers.push("alt");
      if (shortcut.metaKey) modifiers.push("meta");
      return [...modifiers, shortcut.key.toLowerCase()].join("+");
    },
    [],
  );

  const matchesShortcut = useCallback(
    (event: KeyboardEvent, shortcut: KeyboardShortcut): boolean => {
      // If shortcut is disabled, it never matches
      if (shortcut.enabled === false) return false;

      const keyMatches = event.key.toLowerCase() === shortcut.key.toLowerCase();
      const ctrlMatches = !!event.ctrlKey === !!shortcut.ctrlKey;
      const shiftMatches = !!event.shiftKey === !!shortcut.shiftKey;
      const altMatches = !!event.altKey === !!shortcut.altKey;
      const metaMatches = !!event.metaKey === !!shortcut.metaKey;

      return (
        keyMatches && ctrlMatches && shiftMatches && altMatches && metaMatches
      );
    },
    [],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      pressedKeysRef.current.add(event.key.toLowerCase());

      for (const [, { shortcut, callback }] of shortcutsRef.current) {
        if (matchesShortcut(event, shortcut)) {
          if (shortcut.preventDefault !== false) {
            event.preventDefault();
          }
          if (shortcut.stopPropagation) {
            event.stopPropagation();
          }
          callback(shortcut);
          break;
        }
      }
    },
    [matchesShortcut],
  );

  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    pressedKeysRef.current.delete(event.key.toLowerCase());
  }, []);

  const register = useCallback(
    (
      shortcuts: KeyboardShortcut[],
      callback: (shortcut: KeyboardShortcut) => void,
    ): (() => void) => {
      shortcuts.forEach((shortcut) => {
        const key = createShortcutKey(shortcut);
        shortcutsRef.current.set(key, { shortcut, callback });
      });

      return () => {
        shortcuts.forEach((shortcut) => {
          const key = createShortcutKey(shortcut);
          shortcutsRef.current.delete(key);
        });
      };
    },
    [createShortcutKey],
  );

  const unregister = useCallback(
    (shortcuts: KeyboardShortcut[]) => {
      shortcuts.forEach((shortcut) => {
        const key = createShortcutKey(shortcut);
        shortcutsRef.current.delete(key);
      });
    },
    [createShortcutKey],
  );

  const isPressed = useCallback((key: string): boolean => {
    return pressedKeysRef.current.has(key.toLowerCase());
  }, []);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("keyup", handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  return {
    register,
    unregister,
    isPressed,
  };
};

/**
 * Simple hook for registering keyboard shortcuts with string format
 * @param shortcutMap Object mapping shortcut keys to handlers or array of shortcut strings
 * @param handlerOrOptions Handler function (when using array) or options object
 * @param options Global options for all shortcuts (when using array format)
 */
function useKeyboardShortcuts(
  shortcutMap: Record<string, (event: KeyboardEvent) => void>,
  options?: KeyboardShortcutOptions,
): void;
function useKeyboardShortcuts(
  shortcuts: string[],
  handler: (event: KeyboardEvent) => void,
  options?: KeyboardShortcutOptions,
): void;
function useKeyboardShortcuts(
  shortcutMapOrArray: Record<string, (event: KeyboardEvent) => void> | string[],
  handlerOrOptions?: ((event: KeyboardEvent) => void) | KeyboardShortcutOptions,
  options: KeyboardShortcutOptions = {},
): void {
  // Normalize inputs to always work with object format
  let shortcutMap: Record<string, (event: KeyboardEvent) => void>;
  let finalOptions: KeyboardShortcutOptions;

  if (Array.isArray(shortcutMapOrArray)) {
    // Array format: ['Meta+k', 'Control+k']
    if (typeof handlerOrOptions !== "function") {
      throw new Error("Handler function is required when using array format");
    }

    shortcutMap = {};
    shortcutMapOrArray.forEach((shortcut) => {
      shortcutMap[shortcut] = handlerOrOptions as (
        event: KeyboardEvent,
      ) => void;
    });
    finalOptions = options;
  } else {
    // Object format: { 'Meta+k': callback }
    shortcutMap = shortcutMapOrArray;
    finalOptions = (handlerOrOptions as KeyboardShortcutOptions) || {};
  }

  // Store handlers in a ref to avoid unnecessary re-renders
  const handlersRef = useRef(shortcutMap);

  // Update handlers ref when shortcutMap changes
  useEffect(() => {
    handlersRef.current = shortcutMap;
  }, [shortcutMap]);

  // Default options
  const {
    allowInInputs = false,
    preventDefault = true,
    stopPropagation = true,
    enabled = true,
    global = false,
  } = finalOptions;

  // Parse a shortcut string into a KeyboardShortcut object
  const parseShortcut = useCallback(
    (shortcut: string): KeyboardShortcut => {
      const parts = shortcut.toLowerCase().split("+");
      const key = parts.pop() || "";

      return {
        key,
        ctrlKey: parts.includes("ctrl") || parts.includes("control"),
        altKey: parts.includes("alt"),
        shiftKey: parts.includes("shift"),
        metaKey:
          parts.includes("meta") ||
          parts.includes("cmd") ||
          parts.includes("command"),
        preventDefault,
        stopPropagation,
        enabled,
        global,
      };
    },
    [preventDefault, stopPropagation, enabled, global],
  );

  // Check if a keyboard event matches a shortcut
  const matchesShortcut = useCallback(
    (event: KeyboardEvent, shortcut: KeyboardShortcut): boolean => {
      // If shortcut is disabled, it never matches
      if (shortcut.enabled === false) return false;

      // Check if the key matches (case-insensitive)
      const keyMatches = event.key.toLowerCase() === shortcut.key.toLowerCase();

      // Check if modifiers match
      const ctrlMatches = !!shortcut.ctrlKey === event.ctrlKey;
      const altMatches = !!shortcut.altKey === event.altKey;
      const shiftMatches = !!shortcut.shiftKey === event.shiftKey;
      const metaMatches = !!shortcut.metaKey === event.metaKey;

      return (
        keyMatches && ctrlMatches && altMatches && shiftMatches && metaMatches
      );
    },
    [],
  );

  // Handle keyboard events
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Skip if disabled
      if (!enabled) return;

      // Skip if target is an input element and allowInInputs is false
      if (
        !allowInInputs &&
        (event.target instanceof HTMLInputElement ||
          event.target instanceof HTMLTextAreaElement ||
          (event.target as HTMLElement).isContentEditable)
      ) {
        return;
      }

      // Check each shortcut
      for (const [shortcutStr, handler] of Object.entries(
        handlersRef.current,
      )) {
        const shortcut = parseShortcut(shortcutStr);

        if (matchesShortcut(event, shortcut)) {
          // Prevent default browser behavior if specified
          if (shortcut.preventDefault) {
            event.preventDefault();
          }

          // Stop event propagation if specified
          if (shortcut.stopPropagation) {
            event.stopPropagation();
          }

          // Call the handler
          handler(event);

          // Exit after first match
          break;
        }
      }
    },
    [allowInInputs, enabled, matchesShortcut, parseShortcut],
  );

  // Register and unregister keyboard event listeners
  useEffect(() => {
    // Determine where to attach the event listener
    const target = global ? window : document;

    // Add event listener
    target.addEventListener("keydown", handleKeyDown);

    // Cleanup
    return () => {
      target.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown, global]);
}

/**
 * Register a single keyboard shortcut
 * @param shortcut Shortcut key combination (e.g., 'ctrl+s')
 * @param handler Function to call when shortcut is triggered
 * @param options Options for the shortcut
 */
export const useShortcut = (
  shortcut: string,
  handler: KeyboardEventHandler,
  options: KeyboardShortcutOptions = {},
): void => {
  useKeyboardShortcuts({ [shortcut]: handler }, options);
};

// Export the string-based shortcut hook as the default
export default useKeyboardShortcuts;
