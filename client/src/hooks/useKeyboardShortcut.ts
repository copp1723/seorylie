import { useEffect, useCallback, useRef } from 'react';

export interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  preventDefault?: boolean;
  description?: string;
}

export interface KeyboardShortcutHook {
  register: (shortcuts: KeyboardShortcut[], callback: (shortcut: KeyboardShortcut) => void) => () => void;
  unregister: (shortcuts: KeyboardShortcut[]) => void;
  isPressed: (key: string) => boolean;
}

export const useKeyboardShortcut = (): KeyboardShortcutHook => {
  const shortcutsRef = useRef<Map<string, { shortcut: KeyboardShortcut; callback: (shortcut: KeyboardShortcut) => void }>>(new Map());
  const pressedKeysRef = useRef<Set<string>>(new Set());

  const createShortcutKey = useCallback((shortcut: KeyboardShortcut): string => {
    const modifiers = [];
    if (shortcut.ctrlKey) modifiers.push('ctrl');
    if (shortcut.shiftKey) modifiers.push('shift');
    if (shortcut.altKey) modifiers.push('alt');
    if (shortcut.metaKey) modifiers.push('meta');
    return [...modifiers, shortcut.key.toLowerCase()].join('+');
  }, []);

  const matchesShortcut = useCallback((event: KeyboardEvent, shortcut: KeyboardShortcut): boolean => {
    const keyMatches = event.key.toLowerCase() === shortcut.key.toLowerCase();
    const ctrlMatches = !!event.ctrlKey === !!shortcut.ctrlKey;
    const shiftMatches = !!event.shiftKey === !!shortcut.shiftKey;
    const altMatches = !!event.altKey === !!shortcut.altKey;
    const metaMatches = !!event.metaKey === !!shortcut.metaKey;

    return keyMatches && ctrlMatches && shiftMatches && altMatches && metaMatches;
  }, []);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    pressedKeysRef.current.add(event.key.toLowerCase());

    for (const [, { shortcut, callback }] of shortcutsRef.current) {
      if (matchesShortcut(event, shortcut)) {
        if (shortcut.preventDefault !== false) {
          event.preventDefault();
        }
        callback(shortcut);
        break;
      }
    }
  }, [matchesShortcut]);

  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    pressedKeysRef.current.delete(event.key.toLowerCase());
  }, []);

  const register = useCallback((shortcuts: KeyboardShortcut[], callback: (shortcut: KeyboardShortcut) => void): (() => void) => {
    shortcuts.forEach(shortcut => {
      const key = createShortcutKey(shortcut);
      shortcutsRef.current.set(key, { shortcut, callback });
    });

    return () => {
      shortcuts.forEach(shortcut => {
        const key = createShortcutKey(shortcut);
        shortcutsRef.current.delete(key);
      });
    };
  }, [createShortcutKey]);

  const unregister = useCallback((shortcuts: KeyboardShortcut[]) => {
    shortcuts.forEach(shortcut => {
      const key = createShortcutKey(shortcut);
      shortcutsRef.current.delete(key);
    });
  }, [createShortcutKey]);

  const isPressed = useCallback((key: string): boolean => {
    return pressedKeysRef.current.has(key.toLowerCase());
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  return {
    register,
    unregister,
    isPressed
  };
};

export default useKeyboardShortcut;