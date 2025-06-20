import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { useLoadingContext } from "../../contexts/LoadingContext";
import useKeyboardShortcut from "../../hooks/useKeyboardShortcut";
import { useTheme } from "../../contexts/ThemeContext";
import { useAnalytics } from "../../hooks/useAnalytics";
import { useFeatureFlag } from "../../hooks/useFeatureFlag";
import { usePrevious } from "../../hooks/usePrevious";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import { useDebounce } from "../../hooks/useDebounce";

// Command types and interfaces
export interface Command {
  id: string;
  title: string;
  description?: string;
  category: CommandCategory;
  keywords?: string[];
  shortcut?: string;
  icon?: React.ReactNode;
  action: () => Promise<void> | void;
  disabled?: boolean;
  hidden?: boolean;
  preview?: React.ReactNode;
  requiresConfirmation?: boolean;
  confirmationMessage?: string;
  plugin?: string;
}

export type CommandCategory =
  | "navigation"
  | "actions"
  | "settings"
  | "help"
  | "agents"
  | "conversations"
  | "analytics"
  | "admin";

interface CommandPaletteState {
  isOpen: boolean;
  search: string;
  selectedIndex: number;
  commands: Command[];
  filteredCommands: Command[];
  recentCommands: Command[];
  isLoading: boolean;
  error: Error | null;
}

interface CommandPaletteProps {
  commands?: Command[];
  placeholder?: string;
  maxResults?: number;
  maxRecentCommands?: number;
  showRecentCommands?: boolean;
  showShortcuts?: boolean;
  showIcons?: boolean;
  showCategories?: boolean;
  showPreviews?: boolean;
  onOpen?: () => void;
  onClose?: () => void;
  onCommandExecute?: (command: Command) => void;
}

// Command registry for plugin architecture
class CommandRegistry {
  private static instance: CommandRegistry;
  private commands: Map<string, Command> = new Map();
  private listeners: Set<(commands: Command[]) => void> = new Set();

  private constructor() {}

  public static getInstance(): CommandRegistry {
    if (!CommandRegistry.instance) {
      CommandRegistry.instance = new CommandRegistry();
    }
    return CommandRegistry.instance;
  }

  public registerCommand(command: Command): void {
    this.commands.set(command.id, command);
    this.notifyListeners();
  }

  public unregisterCommand(commandId: string): void {
    this.commands.delete(commandId);
    this.notifyListeners();
  }

  public getCommands(): Command[] {
    return Array.from(this.commands.values());
  }

  public subscribe(listener: (commands: Command[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    const commands = this.getCommands();
    this.listeners.forEach((listener) => listener(commands));
  }
}

// Optimized fuzzy search algorithm for <5ms response time
function fuzzySearch(search: string, commands: Command[]): Command[] {
  if (!search || search.length === 0) return commands;

  const searchLower = search.toLowerCase();
  const terms = searchLower.split(" ").filter((term) => term.length > 0);

  // Prepare regex patterns once for performance
  const patterns = terms.map(
    (term) => new RegExp(term.split("").join(".*?"), "i"),
  );

  // Score and filter commands
  return commands
    .map((command) => {
      // Start with base score
      let score = 0;
      const titleLower = command.title.toLowerCase();
      const descLower = command.description?.toLowerCase() || "";
      const keywordsLower = command.keywords?.join(" ").toLowerCase() || "";

      // Check each pattern against title, description, and keywords
      for (const pattern of patterns) {
        // Title match (highest priority)
        if (pattern.test(titleLower)) {
          const match = titleLower.match(pattern);
          // Exact match gets highest score
          if (match && match[0] === titleLower) {
            score += 100;
          } else if (titleLower.startsWith(searchLower)) {
            score += 80;
          } else {
            score += 60;
          }
        }

        // Description match
        if (descLower && pattern.test(descLower)) {
          score += 40;
        }

        // Keywords match
        if (keywordsLower && pattern.test(keywordsLower)) {
          score += 50;
        }

        // Category match
        if (pattern.test(command.category)) {
          score += 30;
        }
      }

      return { command, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.command);
}

// Command palette component
export const CommandPalette: React.FC<CommandPaletteProps> = ({
  commands: propCommands = [],
  placeholder = "Search commands...",
  maxResults = 10,
  maxRecentCommands = 5,
  showRecentCommands = true,
  showShortcuts = true,
  showIcons = true,
  showCategories = true,
  showPreviews = true,
  onOpen,
  onClose,
  onCommandExecute,
}) => {
  // Get loading context for integration with loading states
  const { startLoading, stopLoading } = useLoadingContext();

  // Get theme context for dark/light mode support
  const { theme } = useTheme();

  // Analytics for performance monitoring
  const { trackEvent, trackTiming } = useAnalytics();

  // Feature flag for progressive rollout
  const isEnabled = useFeatureFlag("command_palette_enabled");

  // State management
  const [state, setState] = useState<CommandPaletteState>({
    isOpen: false,
    search: "",
    selectedIndex: 0,
    commands: [],
    filteredCommands: [],
    recentCommands: [],
    isLoading: false,
    error: null,
  });

  // Store recent commands in local storage
  const [storedRecentCommands, setStoredRecentCommands] = useLocalStorage<
    string[]
  >("command-palette-recent-commands", []);

  // Refs
  const inputRef = useRef<HTMLInputElement>(null);
  const commandListRef = useRef<HTMLDivElement>(null);
  const searchTimerRef = useRef<number | null>(null);

  // Debounce search for performance
  const debouncedSearch = useDebounce(state.search, 50);

  // Track previous state
  const prevIsOpen = usePrevious(state.isOpen);

  // Command registry for plugin architecture
  const commandRegistry = useMemo(() => CommandRegistry.getInstance(), []);

  // Initialize commands from props and registry
  useEffect(() => {
    const registryCommands = commandRegistry.getCommands();
    const allCommands = [...propCommands, ...registryCommands];

    setState((prev) => ({
      ...prev,
      commands: allCommands,
      filteredCommands: allCommands,
    }));

    // Subscribe to command registry changes
    const unsubscribe = commandRegistry.subscribe((commands) => {
      setState((prev) => ({
        ...prev,
        commands: [...propCommands, ...commands],
        filteredCommands: prev.search
          ? fuzzySearch(prev.search, [...propCommands, ...commands])
          : [...propCommands, ...commands],
      }));
    });

    return unsubscribe;
  }, [propCommands, commandRegistry]);

  // Load recent commands from storage
  useEffect(() => {
    if (storedRecentCommands.length > 0) {
      const recentCommands = storedRecentCommands
        .map((id) => state.commands.find((cmd) => cmd.id === id))
        .filter(Boolean) as Command[];

      setState((prev) => ({
        ...prev,
        recentCommands: recentCommands.slice(0, maxRecentCommands),
      }));
    }
  }, [storedRecentCommands, state.commands, maxRecentCommands]);

  // Handle keyboard shortcut
  useKeyboardShortcut(["Meta+k", "Control+k"], () => {
    if (isEnabled) {
      toggleCommandPalette();
      trackEvent("command_palette_shortcut_used");
    }
  });

  // Handle search input changes
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const search = e.target.value;

      setState((prev) => ({
        ...prev,
        search,
        selectedIndex: 0,
      }));

      // Clear previous timer
      if (searchTimerRef.current) {
        window.clearTimeout(searchTimerRef.current);
      }

      // Start search timer for performance tracking
      searchTimerRef.current = window.setTimeout(() => {
        const startTime = performance.now();
        const filtered = fuzzySearch(search, state.commands);
        const endTime = performance.now();

        trackTiming("command_palette_search", endTime - startTime);

        setState((prev) => ({
          ...prev,
          filteredCommands: filtered.slice(0, maxResults),
        }));
      }, 0);
    },
    [state.commands, maxResults, trackTiming],
  );

  // Handle debounced search
  useEffect(() => {
    if (debouncedSearch !== state.search) {
      const startTime = performance.now();
      const filtered = fuzzySearch(debouncedSearch, state.commands);
      const endTime = performance.now();

      trackTiming("command_palette_search_debounced", endTime - startTime);

      setState((prev) => ({
        ...prev,
        filteredCommands: filtered.slice(0, maxResults),
      }));
    }
  }, [debouncedSearch, state.commands, maxResults, trackTiming]);

  // Toggle command palette
  const toggleCommandPalette = useCallback(() => {
    setState((prev) => {
      const nextIsOpen = !prev.isOpen;

      if (nextIsOpen) {
        onOpen?.();
        trackEvent("command_palette_opened");
      } else {
        onClose?.();
        trackEvent("command_palette_closed");
      }

      return {
        ...prev,
        isOpen: nextIsOpen,
        search: "",
        selectedIndex: 0,
        filteredCommands: nextIsOpen ? prev.commands : [],
      };
    });
  }, [onOpen, onClose, trackEvent]);

  // Focus input when opened
  useEffect(() => {
    if (state.isOpen && !prevIsOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  }, [state.isOpen, prevIsOpen]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      const { filteredCommands, selectedIndex } = state;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setState((prev) => ({
            ...prev,
            selectedIndex:
              (prev.selectedIndex + 1) % prev.filteredCommands.length,
          }));
          break;

        case "ArrowUp":
          e.preventDefault();
          setState((prev) => ({
            ...prev,
            selectedIndex:
              prev.selectedIndex > 0
                ? prev.selectedIndex - 1
                : prev.filteredCommands.length - 1,
          }));
          break;

        case "Enter":
          e.preventDefault();
          if (filteredCommands.length > 0) {
            executeCommand(filteredCommands[selectedIndex]);
          }
          break;

        case "Escape":
          e.preventDefault();
          toggleCommandPalette();
          break;

        case "Tab":
          e.preventDefault();
          setState((prev) => ({
            ...prev,
            selectedIndex:
              (prev.selectedIndex + 1) % prev.filteredCommands.length,
          }));
          break;
      }
    },
    [state, toggleCommandPalette],
  );

  // Scroll selected command into view
  useEffect(() => {
    if (state.isOpen && commandListRef.current) {
      const selectedElement = commandListRef.current.querySelector(
        `[data-index="${state.selectedIndex}"]`,
      );
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: "nearest" });
      }
    }
  }, [state.isOpen, state.selectedIndex]);

  // Execute command
  const executeCommand = useCallback(
    async (command: Command) => {
      if (command.disabled) return;

      // Add to recent commands
      const newRecentCommands = [
        command.id,
        ...storedRecentCommands.filter((id) => id !== command.id),
      ].slice(0, maxRecentCommands);

      setStoredRecentCommands(newRecentCommands);

      // Close command palette
      setState((prev) => ({
        ...prev,
        isOpen: false,
      }));

      // Track command execution
      trackEvent("command_executed", {
        command_id: command.id,
        command_category: command.category,
      });

      // Notify callback
      onCommandExecute?.(command);

      try {
        // Start loading
        setState((prev) => ({ ...prev, isLoading: true }));
        startLoading(`command_${command.id}`);

        // Execute command action
        await command.action();

        // Track successful execution
        trackEvent("command_execution_success", {
          command_id: command.id,
        });
      } catch (error) {
        // Handle error
        console.error("Error executing command:", error);
        setState((prev) => ({ ...prev, error: error as Error }));

        // Track error
        trackEvent("command_execution_error", {
          command_id: command.id,
          error: (error as Error).message,
        });
      } finally {
        // Stop loading
        setState((prev) => ({ ...prev, isLoading: false }));
        stopLoading(`command_${command.id}`);
      }
    },
    [
      storedRecentCommands,
      setStoredRecentCommands,
      maxRecentCommands,
      startLoading,
      stopLoading,
      trackEvent,
      onCommandExecute,
    ],
  );

  // Render nothing if disabled
  if (!isEnabled) return null;

  // Render command palette
  return state.isOpen
    ? createPortal(
        <div
          className={`command-palette-overlay ${theme}`}
          onClick={() => toggleCommandPalette()}
          role="dialog"
          aria-modal="true"
          aria-label="Command Palette"
        >
          <div
            className="command-palette"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={handleKeyDown}
          >
            <div className="command-palette-header">
              <div className="command-palette-search-container">
                {showIcons && (
                  <svg
                    className="command-palette-search-icon"
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                  >
                    <path
                      fill="currentColor"
                      d="M6.5 1a5.5 5.5 0 0 1 4.383 8.823l3.896 3.896a.75.75 0 0 1-1.06 1.06l-3.896-3.896A5.5 5.5 0 1 1 6.5 1zm0 1.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"
                    />
                  </svg>
                )}
                <input
                  ref={inputRef}
                  type="text"
                  className="command-palette-search"
                  placeholder={placeholder}
                  value={state.search}
                  onChange={handleSearchChange}
                  aria-label="Search commands"
                  autoComplete="off"
                  spellCheck="false"
                />
                {showShortcuts && (
                  <div className="command-palette-kbd">
                    <kbd>ESC</kbd> to close
                  </div>
                )}
              </div>
            </div>

            <div className="command-palette-content">
              {state.isLoading && (
                <div className="command-palette-loading">
                  <div className="command-palette-spinner" />
                  <span>Executing command...</span>
                </div>
              )}

              {!state.isLoading && (
                <div className="command-palette-commands" ref={commandListRef}>
                  {state.filteredCommands.length === 0 && state.search && (
                    <div className="command-palette-no-results">
                      No commands found for "{state.search}"
                    </div>
                  )}

                  {state.filteredCommands.length === 0 &&
                    !state.search &&
                    showRecentCommands &&
                    state.recentCommands.length > 0 && (
                      <>
                        <div className="command-palette-category">
                          Recent Commands
                        </div>
                        {state.recentCommands.map((command, index) => (
                          <div
                            key={command.id}
                            className={`command-palette-item ${index === state.selectedIndex ? "selected" : ""}`}
                            onClick={() => executeCommand(command)}
                            data-index={index}
                            role="option"
                            aria-selected={index === state.selectedIndex}
                            tabIndex={-1}
                          >
                            {showIcons && command.icon && (
                              <div className="command-palette-item-icon">
                                {command.icon}
                              </div>
                            )}
                            <div className="command-palette-item-content">
                              <div className="command-palette-item-title">
                                {command.title}
                              </div>
                              {command.description && (
                                <div className="command-palette-item-description">
                                  {command.description}
                                </div>
                              )}
                            </div>
                            {showCategories && (
                              <div className="command-palette-item-category">
                                {command.category}
                              </div>
                            )}
                            {showShortcuts && command.shortcut && (
                              <div className="command-palette-item-shortcut">
                                {command.shortcut.split("+").map((key, i) => (
                                  <React.Fragment key={i}>
                                    {i > 0 && <span>+</span>}
                                    <kbd>{key}</kbd>
                                  </React.Fragment>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                        <div className="command-palette-separator" />
                      </>
                    )}

                  {state.filteredCommands.length > 0 && (
                    <>
                      {showCategories && (
                        <div className="command-palette-categories">
                          {Array.from(
                            new Set(
                              state.filteredCommands.map((cmd) => cmd.category),
                            ),
                          ).map((category) => (
                            <React.Fragment key={category}>
                              <div className="command-palette-category">
                                {category}
                              </div>
                              {state.filteredCommands
                                .filter((cmd) => cmd.category === category)
                                .map((command, index) => {
                                  const globalIndex =
                                    state.filteredCommands.findIndex(
                                      (cmd) => cmd.id === command.id,
                                    );
                                  return (
                                    <div
                                      key={command.id}
                                      className={`command-palette-item ${globalIndex === state.selectedIndex ? "selected" : ""}`}
                                      onClick={() => executeCommand(command)}
                                      data-index={globalIndex}
                                      role="option"
                                      aria-selected={
                                        globalIndex === state.selectedIndex
                                      }
                                      tabIndex={-1}
                                    >
                                      {showIcons && command.icon && (
                                        <div className="command-palette-item-icon">
                                          {command.icon}
                                        </div>
                                      )}
                                      <div className="command-palette-item-content">
                                        <div className="command-palette-item-title">
                                          {highlightMatch(
                                            command.title,
                                            state.search,
                                          )}
                                        </div>
                                        {command.description && (
                                          <div className="command-palette-item-description">
                                            {highlightMatch(
                                              command.description,
                                              state.search,
                                            )}
                                          </div>
                                        )}
                                      </div>
                                      {showShortcuts && command.shortcut && (
                                        <div className="command-palette-item-shortcut">
                                          {command.shortcut
                                            .split("+")
                                            .map((key, i) => (
                                              <React.Fragment key={i}>
                                                {i > 0 && <span>+</span>}
                                                <kbd>{key}</kbd>
                                              </React.Fragment>
                                            ))}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                            </React.Fragment>
                          ))}
                        </div>
                      )}

                      {!showCategories && (
                        <>
                          {state.filteredCommands.map((command, index) => (
                            <div
                              key={command.id}
                              className={`command-palette-item ${index === state.selectedIndex ? "selected" : ""}`}
                              onClick={() => executeCommand(command)}
                              data-index={index}
                              role="option"
                              aria-selected={index === state.selectedIndex}
                              tabIndex={-1}
                            >
                              {showIcons && command.icon && (
                                <div className="command-palette-item-icon">
                                  {command.icon}
                                </div>
                              )}
                              <div className="command-palette-item-content">
                                <div className="command-palette-item-title">
                                  {highlightMatch(command.title, state.search)}
                                </div>
                                {command.description && (
                                  <div className="command-palette-item-description">
                                    {highlightMatch(
                                      command.description,
                                      state.search,
                                    )}
                                  </div>
                                )}
                              </div>
                              {showCategories && (
                                <div className="command-palette-item-category">
                                  {command.category}
                                </div>
                              )}
                              {showShortcuts && command.shortcut && (
                                <div className="command-palette-item-shortcut">
                                  {command.shortcut.split("+").map((key, i) => (
                                    <React.Fragment key={i}>
                                      {i > 0 && <span>+</span>}
                                      <kbd>{key}</kbd>
                                    </React.Fragment>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </>
                      )}
                    </>
                  )}
                </div>
              )}

              {showPreviews &&
                state.filteredCommands[state.selectedIndex]?.preview && (
                  <div className="command-palette-preview">
                    {state.filteredCommands[state.selectedIndex].preview}
                  </div>
                )}
            </div>

            {state.error && (
              <div className="command-palette-error">
                <div className="command-palette-error-icon">⚠️</div>
                <div className="command-palette-error-message">
                  {state.error.message}
                </div>
              </div>
            )}

            <div className="command-palette-footer">
              <div className="command-palette-tips">
                <span>
                  <kbd>↑</kbd>
                  <kbd>↓</kbd> to navigate
                </span>
                <span>
                  <kbd>Enter</kbd> to select
                </span>
                <span>
                  <kbd>Esc</kbd> to close
                </span>
              </div>
            </div>
          </div>

          <style>{`
        .command-palette-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          animation: fadeIn 0.2s ease-out;
        }
        
        .command-palette {
          width: 600px;
          max-width: 90vw;
          max-height: 80vh;
          background-color: var(--palette-bg, #ffffff);
          border-radius: 8px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: slideIn 0.2s ease-out;
        }
        
        .command-palette.dark {
          --palette-bg: #1e1e1e;
          --palette-text: #ffffff;
          --palette-border: #444444;
          --palette-selected-bg: #2c2c2c;
          --palette-hover-bg: #333333;
          --palette-description: #aaaaaa;
          --palette-shortcut-bg: #333333;
          --palette-shortcut-text: #dddddd;
          --palette-category: #777777;
          --palette-separator: #444444;
        }
        
        .command-palette.light {
          --palette-bg: #ffffff;
          --palette-text: #333333;
          --palette-border: #eeeeee;
          --palette-selected-bg: #f5f5f5;
          --palette-hover-bg: #f9f9f9;
          --palette-description: #777777;
          --palette-shortcut-bg: #f0f0f0;
          --palette-shortcut-text: #555555;
          --palette-category: #999999;
          --palette-separator: #eeeeee;
        }
        
        .command-palette-header {
          padding: 12px 16px;
          border-bottom: 1px solid var(--palette-border);
        }
        
        .command-palette-search-container {
          display: flex;
          align-items: center;
          position: relative;
        }
        
        .command-palette-search-icon {
          position: absolute;
          left: 12px;
          color: var(--palette-description);
        }
        
        .command-palette-search {
          width: 100%;
          padding: 10px 12px 10px 36px;
          border: 1px solid var(--palette-border);
          border-radius: 6px;
          font-size: 16px;
          background-color: transparent;
          color: var(--palette-text);
        }
        
        .command-palette-search:focus {
          outline: none;
          border-color: #007bff;
          box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
        }
        
        .command-palette-kbd {
          position: absolute;
          right: 12px;
          display: flex;
          align-items: center;
          color: var(--palette-description);
          font-size: 12px;
        }
        
        .command-palette-kbd kbd {
          background-color: var(--palette-shortcut-bg);
          border-radius: 4px;
          padding: 2px 4px;
          margin: 0 2px;
          font-size: 11px;
          color: var(--palette-shortcut-text);
        }
        
        .command-palette-content {
          flex: 1;
          overflow-y: auto;
          padding: 8px 0;
        }
        
        .command-palette-commands {
          max-height: 400px;
          overflow-y: auto;
        }
        
        .command-palette-category {
          padding: 6px 16px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          color: var(--palette-category);
        }
        
        .command-palette-item {
          display: flex;
          align-items: center;
          padding: 8px 16px;
          cursor: pointer;
          border-left: 2px solid transparent;
          transition: background-color 0.1s ease;
        }
        
        .command-palette-item:hover {
          background-color: var(--palette-hover-bg);
        }
        
        .command-palette-item.selected {
          background-color: var(--palette-selected-bg);
          border-left-color: #007bff;
        }
        
        .command-palette-item-icon {
          margin-right: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          flex-shrink: 0;
        }
        
        .command-palette-item-content {
          flex: 1;
          min-width: 0;
        }
        
        .command-palette-item-title {
          font-size: 14px;
          font-weight: 500;
          color: var(--palette-text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        .command-palette-item-description {
          font-size: 12px;
          color: var(--palette-description);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin-top: 2px;
        }
        
        .command-palette-item-category {
          font-size: 11px;
          color: var(--palette-category);
          background-color: var(--palette-shortcut-bg);
          padding: 2px 6px;
          border-radius: 4px;
          margin-left: 8px;
        }
        
        .command-palette-item-shortcut {
          display: flex;
          align-items: center;
          margin-left: 8px;
        }
        
        .command-palette-item-shortcut kbd {
          background-color: var(--palette-shortcut-bg);
          border-radius: 4px;
          padding: 2px 4px;
          margin: 0 2px;
          font-size: 11px;
          color: var(--palette-shortcut-text);
        }
        
        .command-palette-separator {
          height: 1px;
          background-color: var(--palette-separator);
          margin: 8px 16px;
        }
        
        .command-palette-no-results {
          padding: 16px;
          text-align: center;
          color: var(--palette-description);
        }
        
        .command-palette-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 32px;
          color: var(--palette-text);
        }
        
        .command-palette-spinner {
          width: 24px;
          height: 24px;
          border: 2px solid rgba(0, 123, 255, 0.3);
          border-radius: 50%;
          border-top-color: #007bff;
          animation: spin 1s linear infinite;
          margin-bottom: 12px;
        }
        
        .command-palette-preview {
          padding: 16px;
          border-top: 1px solid var(--palette-border);
          max-height: 200px;
          overflow-y: auto;
        }
        
        .command-palette-error {
          display: flex;
          align-items: center;
          padding: 12px 16px;
          background-color: #fff1f0;
          border-top: 1px solid #ffccc7;
          color: #cf1322;
        }
        
        .command-palette-error-icon {
          margin-right: 8px;
        }
        
        .command-palette-footer {
          padding: 8px 16px;
          border-top: 1px solid var(--palette-border);
        }
        
        .command-palette-tips {
          display: flex;
          justify-content: center;
          gap: 16px;
          color: var(--palette-description);
          font-size: 12px;
        }
        
        .command-palette-tips span {
          display: flex;
          align-items: center;
        }
        
        .command-palette-tips kbd {
          background-color: var(--palette-shortcut-bg);
          border-radius: 4px;
          padding: 2px 4px;
          margin: 0 2px;
          font-size: 11px;
          color: var(--palette-shortcut-text);
        }
        
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes slideIn {
          from { transform: translateY(-20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        .highlight {
          background-color: rgba(255, 213, 0, 0.3);
          font-weight: 600;
          border-radius: 2px;
        }
      `}</style>
        </div>,
        document.body,
      )
    : null;
};

// Utility function to highlight matched text
function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query) return text;

  const terms = query.toLowerCase().split(" ").filter(Boolean);
  if (terms.length === 0) return text;

  const textLower = text.toLowerCase();
  let result: React.ReactNode[] = [text];

  terms.forEach((term) => {
    result = result.flatMap((part) => {
      if (typeof part !== "string") return part;

      const partLower = part.toLowerCase();
      const index = partLower.indexOf(term);
      if (index === -1) return part;

      return [
        part.substring(0, index),
        <span key={`${part}-${index}`} className="highlight">
          {part.substring(index, index + term.length)}
        </span>,
        part.substring(index + term.length),
      ];
    });
  });

  return result;
}

export default CommandPalette;
