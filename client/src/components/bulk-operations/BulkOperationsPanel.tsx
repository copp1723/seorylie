import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useLoadingContext } from '../../contexts/LoadingContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useAnalytics } from '../../hooks/useAnalytics';
import { useFeatureFlag } from '../../hooks/useFeatureFlag';
import useKeyboardShortcut from '../../hooks/useKeyboardShortcut';

// Types and interfaces
export interface BulkOperationItem {
  id: string;
  name: string;
  type: string;
  status: string;
  lastUpdated: Date;
  metadata?: Record<string, any>;
  [key: string]: any;
}

export type BulkOperationType = 
  | 'activate'
  | 'deactivate'
  | 'delete'
  | 'tag'
  | 'untag'
  | 'assign'
  | 'unassign'
  | 'update'
  | 'archive'
  | 'restore'
  | 'custom';

export interface BulkOperationAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  type: BulkOperationType;
  confirmationRequired?: boolean;
  confirmationMessage?: string;
  disabled?: boolean | ((selectedItems: BulkOperationItem[]) => boolean);
  hidden?: boolean | ((selectedItems: BulkOperationItem[]) => boolean);
  action: (selectedItems: BulkOperationItem[]) => Promise<BulkOperationResult>;
  progressText?: string;
  batchSize?: number;
  maxItems?: number;
  dangerLevel?: 'none' | 'low' | 'medium' | 'high';
}

export interface BulkOperationResult {
  success: boolean;
  successCount: number;
  failureCount: number;
  errors?: Record<string, Error>;
  warnings?: string[];
  details?: any;
}

export interface BulkOperationsFilter {
  id: string;
  label: string;
  predicate: (item: BulkOperationItem) => boolean;
  icon?: React.ReactNode;
}

interface BulkOperationsPanelProps {
  items: BulkOperationItem[];
  actions: BulkOperationAction[];
  filters?: BulkOperationsFilter[];
  itemKeyField?: string;
  maxSelectableItems?: number;
  onSelectionChange?: (selectedItems: BulkOperationItem[]) => void;
  onOperationComplete?: (result: BulkOperationResult, action: BulkOperationType, items: BulkOperationItem[]) => void;
  onOperationStart?: (action: BulkOperationType, items: BulkOperationItem[]) => void;
  onOperationError?: (error: Error, action: BulkOperationType, items: BulkOperationItem[]) => void;
  onOperationCancel?: (action: BulkOperationType, items: BulkOperationItem[]) => void;
  renderItem?: (item: BulkOperationItem, isSelected: boolean, onSelect: (selected: boolean) => void) => React.ReactNode;
  renderEmptyState?: () => React.ReactNode;
  className?: string;
  analyticsCategory?: string;
}

// Main component
export const BulkOperationsPanel: React.FC<BulkOperationsPanelProps> = ({
  items,
  actions,
  filters = [],
  itemKeyField = 'id',
  maxSelectableItems = 100,
  onSelectionChange,
  onOperationComplete,
  onOperationStart,
  onOperationError,
  onOperationCancel,
  renderItem,
  renderEmptyState,
  className = '',
  analyticsCategory = 'bulk_operations'
}) => {
  // Get loading context for integration with loading states
  const { startLoading, stopLoading, setProgress } = useLoadingContext();
  
  // Get theme context for dark/light mode support
  const { theme } = useTheme();
  
  // Analytics for performance monitoring
  const { trackEvent, trackTiming } = useAnalytics();
  
  // Feature flag for progressive rollout
  const isEnabled = useFeatureFlag('bulk_operations_enabled', true);
  
  // Local state
  const [selectedItems, setSelectedItems] = useState<BulkOperationItem[]>([]);
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isOperationInProgress, setIsOperationInProgress] = useState(false);
  const [currentOperation, setCurrentOperation] = useState<BulkOperationType | null>(null);
  const [operationProgress, setOperationProgress] = useState(0);
  const [confirmationDialog, setConfirmationDialog] = useState<{
    isOpen: boolean;
    message: string;
    action: BulkOperationType;
    items: BulkOperationItem[];
    onConfirm: () => void;
    onCancel: () => void;
  }>({
    isOpen: false,
    message: '',
    action: 'custom',
    items: [],
    onConfirm: () => {},
    onCancel: () => {}
  });
  
  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const cancelOperationRef = useRef<boolean>(false);
  const operationTimeoutRef = useRef<number | null>(null);
  const lastClickTimeRef = useRef<number>(0);
  
  // Memoized filtered items
  const processedItems = useMemo(() => {
    // Start timing for performance tracking
    const startTime = performance.now();
    
    // Apply search filter
    let result = searchQuery 
      ? items.filter(item => 
          item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.id.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : [...items];
    
    // Apply active filter
    if (activeFilter) {
      const filter = filters.find(f => f.id === activeFilter);
      if (filter) {
        result = result.filter(filter.predicate);
      }
    }
    
    // End timing and track performance
    const endTime = performance.now();
    trackTiming('bulk_operations_data_processing', endTime - startTime);
    
    return result;
  }, [items, searchQuery, activeFilter, filters, trackTiming]);
  
  // Notify parent component when selection changes
  useEffect(() => {
    onSelectionChange?.(selectedItems);
    
    // Track selection changes
    trackEvent(`${analyticsCategory}_selection_changed`, {
      count: selectedItems.length
    });
  }, [selectedItems, onSelectionChange, trackEvent, analyticsCategory]);
  
  // Handle keyboard shortcuts
  useKeyboardShortcut(['Meta+a', 'Control+a'], (e) => {
    if (isEnabled && containerRef.current?.contains(document.activeElement)) {
      e.preventDefault();
      handleSelectAll();
      trackEvent(`${analyticsCategory}_shortcut_select_all`);
    }
  });
  
  useKeyboardShortcut(['Escape'], () => {
    if (isEnabled && selectedItems.length > 0) {
      handleClearSelection();
      trackEvent(`${analyticsCategory}_shortcut_clear_selection`);
    }
  });
  
  // Handle select all
  const handleSelectAll = useCallback(() => {
    const newSelection = processedItems.slice(0, maxSelectableItems);
    setSelectedItems(newSelection);
    setLastSelectedIndex(null);
    
    // Track analytics
    trackEvent(`${analyticsCategory}_select_all`, {
      count: newSelection.length,
      max_reached: newSelection.length === maxSelectableItems
    });
  }, [processedItems, maxSelectableItems, trackEvent, analyticsCategory]);
  
  // Handle clear selection
  const handleClearSelection = useCallback(() => {
    setSelectedItems([]);
    setLastSelectedIndex(null);
    
    // Track analytics
    trackEvent(`${analyticsCategory}_clear_selection`);
  }, [trackEvent, analyticsCategory]);
  
  // Handle item selection
  const handleItemSelect = useCallback((item: BulkOperationItem, index: number, isShiftKey: boolean) => {
    // Start timing for performance tracking
    const startTime = performance.now();
    
    setSelectedItems(prevSelected => {
      const itemKey = item[itemKeyField];
      const isSelected = prevSelected.some(i => i[itemKeyField] === itemKey);
      
      // Handle shift+click for range selection
      if (isShiftKey && lastSelectedIndex !== null && lastSelectedIndex !== index) {
        const start = Math.min(lastSelectedIndex, index);
        const end = Math.max(lastSelectedIndex, index);
        const rangeItems = processedItems.slice(start, end + 1);
        
        // Determine if we're selecting or deselecting the range
        if (isSelected) {
          // Deselect the range
          const rangeItemKeys = new Set(rangeItems.map(i => i[itemKeyField]));
          return prevSelected.filter(i => !rangeItemKeys.has(i[itemKeyField]));
        } else {
          // Select the range, respecting the maximum limit
          const existingKeys = new Set(prevSelected.map(i => i[itemKeyField]));
          const newItems = rangeItems.filter(i => !existingKeys.has(i[itemKeyField]));
          
          // Check if adding would exceed the limit
          if (prevSelected.length + newItems.length > maxSelectableItems) {
            // Take only what we can fit
            const itemsToAdd = newItems.slice(0, maxSelectableItems - prevSelected.length);
            
            // Show warning about max limit
            console.warn(`Maximum selection limit of ${maxSelectableItems} items reached.`);
            
            // Track analytics
            trackEvent(`${analyticsCategory}_max_selection_limit_reached`, {
              attempted: prevSelected.length + newItems.length,
              limit: maxSelectableItems
            });
            
            return [...prevSelected, ...itemsToAdd];
          }
          
          return [...prevSelected, ...newItems];
        }
      }
      
      // Normal toggle selection
      if (isSelected) {
        return prevSelected.filter(i => i[itemKeyField] !== itemKey);
      } else {
        // Check if adding would exceed the limit
        if (prevSelected.length >= maxSelectableItems) {
          // Show warning about max limit
          console.warn(`Maximum selection limit of ${maxSelectableItems} items reached.`);
          
          // Track analytics
          trackEvent(`${analyticsCategory}_max_selection_limit_reached`, {
            attempted: prevSelected.length + 1,
            limit: maxSelectableItems
          });
          
          return prevSelected;
        }
        
        return [...prevSelected, item];
      }
    });
    
    setLastSelectedIndex(index);
    
    // End timing and track performance
    const endTime = performance.now();
    trackTiming('bulk_operations_selection', endTime - startTime);
    
    // Track analytics
    trackEvent(`${analyticsCategory}_item_selected`, {
      with_shift: isShiftKey
    });
  }, [lastSelectedIndex, processedItems, itemKeyField, maxSelectableItems, trackEvent, trackTiming, analyticsCategory]);
  
  // Check if an item is selected
  const isItemSelected = useCallback((item: BulkOperationItem) => {
    return selectedItems.some(i => i[itemKeyField] === item[itemKeyField]);
  }, [selectedItems, itemKeyField]);
  
  // Handle search input changes
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    
    // Track analytics
    if (e.target.value) {
      trackEvent(`${analyticsCategory}_search`, {
        query_length: e.target.value.length
      });
    }
  }, [trackEvent, analyticsCategory]);
  
  // Handle filter changes
  const handleFilterChange = useCallback((filterId: string) => {
    setActiveFilter(prev => prev === filterId ? null : filterId);
    
    // Track analytics
    trackEvent(`${analyticsCategory}_filter_changed`, {
      filter: filterId
    });
  }, [trackEvent, analyticsCategory]);
  
  // Execute bulk operation
  const executeBulkOperation = useCallback(async (action: BulkOperationAction, items: BulkOperationItem[]) => {
    // Validate items count
    if (items.length === 0) {
      console.warn('No items selected for bulk operation');
      return;
    }
    
    if (action.maxItems && items.length > action.maxItems) {
      console.warn(`This operation supports a maximum of ${action.maxItems} items`);
      items = items.slice(0, action.maxItems);
    }
    
    // Start operation
    setIsOperationInProgress(true);
    setCurrentOperation(action.type);
    setOperationProgress(0);
    cancelOperationRef.current = false;
    
    // Start loading indicator
    const loadingKey = `bulk_operation_${action.id}`;
    startLoading(loadingKey);
    
    // Notify operation start
    onOperationStart?.(action.type, items);
    
    // Track analytics
    trackEvent(`${analyticsCategory}_operation_started`, {
      action: action.type,
      item_count: items.length
    });
    
    try {
      // Determine batch size
      const batchSize = action.batchSize || 20;
      const totalItems = items.length;
      const batches = Math.ceil(totalItems / batchSize);
      
      let result: BulkOperationResult = {
        success: true,
        successCount: 0,
        failureCount: 0,
        errors: {},
        warnings: []
      };
      
      // Process in batches
      for (let i = 0; i < batches; i++) {
        // Check if operation was cancelled
        if (cancelOperationRef.current) {
          result.warnings = [...(result.warnings || []), 'Operation cancelled by user'];
          break;
        }
        
        const start = i * batchSize;
        const end = Math.min(start + batchSize, totalItems);
        const batchItems = items.slice(start, end);
        
        try {
          // Execute batch
          const batchResult = await action.action(batchItems);
          
          // Merge results
          result.successCount += batchResult.successCount;
          result.failureCount += batchResult.failureCount;
          result.errors = { ...(result.errors || {}), ...(batchResult.errors || {}) };
          result.warnings = [...(result.warnings || []), ...(batchResult.warnings || [])];
          
          // Update progress
          const progress = Math.round(((i + 1) * batchSize / totalItems) * 100);
          setOperationProgress(Math.min(progress, 100));
          setProgress(loadingKey, Math.min(progress, 100));
        } catch (error) {
          console.error(`Error processing batch ${i + 1}/${batches}:`, error);
          
          // Update failure count for this batch
          result.failureCount += batchItems.length;
          result.success = false;
          
          // Add batch error
          if (result.errors) {
            result.errors[`batch_${i}`] = error as Error;
          }
          
          // Notify error
          onOperationError?.(error as Error, action.type, batchItems);
          
          // Track error
          trackEvent(`${analyticsCategory}_operation_batch_error`, {
            action: action.type,
            batch: i,
            error: (error as Error).message
          });
        }
        
        // Small delay between batches for UI responsiveness
        if (i < batches - 1 && !cancelOperationRef.current) {
          await new Promise(resolve => {
            operationTimeoutRef.current = window.setTimeout(resolve, 50) as unknown as number;
          });
        }
      }
      
      // Determine overall success
      result.success = result.failureCount === 0 && !cancelOperationRef.current;
      
      // Notify operation complete
      onOperationComplete?.(result, action.type, items);
      
      // Track completion
      trackEvent(`${analyticsCategory}_operation_completed`, {
        action: action.type,
        success: result.success,
        success_count: result.successCount,
        failure_count: result.failureCount,
        cancelled: cancelOperationRef.current
      });
      
      // Clear selection if operation was successful
      if (result.success) {
        setSelectedItems([]);
      }
      
      return result;
    } catch (error) {
      console.error('Error executing bulk operation:', error);
      
      // Notify error
      onOperationError?.(error as Error, action.type, items);
      
      // Track error
      trackEvent(`${analyticsCategory}_operation_error`, {
        action: action.type,
        error: (error as Error).message
      });
      
      return {
        success: false,
        successCount: 0,
        failureCount: items.length,
        errors: { global: error as Error }
      };
    } finally {
      // Cleanup
      setIsOperationInProgress(false);
      setCurrentOperation(null);
      setOperationProgress(0);
      stopLoading(loadingKey);
      
      if (operationTimeoutRef.current) {
        clearTimeout(operationTimeoutRef.current);
        operationTimeoutRef.current = null;
      }
    }
  }, [
    startLoading, 
    stopLoading, 
    setProgress, 
    onOperationStart, 
    onOperationComplete, 
    onOperationError, 
    trackEvent,
    analyticsCategory
  ]);
  
  // Handle action click
  const handleActionClick = useCallback((action: BulkOperationAction) => {
    // Check if action is disabled
    const isDisabled = typeof action.disabled === 'function' 
      ? action.disabled(selectedItems)
      : action.disabled;
    
    if (isDisabled) {
      return;
    }
    
    // Check if confirmation is required
    if (action.confirmationRequired) {
      setConfirmationDialog({
        isOpen: true,
        message: action.confirmationMessage || `Are you sure you want to ${action.label.toLowerCase()} ${selectedItems.length} items?`,
        action: action.type,
        items: selectedItems,
        onConfirm: () => {
          setConfirmationDialog(prev => ({ ...prev, isOpen: false }));
          executeBulkOperation(action, selectedItems);
        },
        onCancel: () => {
          setConfirmationDialog(prev => ({ ...prev, isOpen: false }));
          
          // Track cancellation
          trackEvent(`${analyticsCategory}_operation_confirmation_cancelled`, {
            action: action.type
          });
        }
      });
      
      // Track confirmation dialog
      trackEvent(`${analyticsCategory}_operation_confirmation_shown`, {
        action: action.type,
        item_count: selectedItems.length
      });
    } else {
      // Execute directly
      executeBulkOperation(action, selectedItems);
    }
  }, [selectedItems, executeBulkOperation, trackEvent, analyticsCategory]);
  
  // Handle cancel operation
  const handleCancelOperation = useCallback(() => {
    cancelOperationRef.current = true;
    
    // Notify cancellation
    if (currentOperation) {
      onOperationCancel?.(currentOperation, selectedItems);
      
      // Track cancellation
      trackEvent(`${analyticsCategory}_operation_cancelled`, {
        action: currentOperation,
        progress: operationProgress
      });
    }
  }, [currentOperation, selectedItems, operationProgress, onOperationCancel, trackEvent, analyticsCategory]);
  
  // Double-click detection for item selection
  const handleItemClick = useCallback((item: BulkOperationItem, index: number, e: React.MouseEvent) => {
    const now = Date.now();
    const isDoubleClick = now - lastClickTimeRef.current < 300;
    lastClickTimeRef.current = now;
    
    if (isDoubleClick) {
      // Handle double-click (e.g., open details)
      trackEvent(`${analyticsCategory}_item_double_clicked`, {
        item_id: item.id
      });
      return;
    }
    
    // Handle single click (selection)
    handleItemSelect(item, index, e.shiftKey);
  }, [handleItemSelect, trackEvent, analyticsCategory]);
  
  // Render nothing if disabled
  if (!isEnabled) return null;
  
  // Render bulk operations panel
  return (
    <div 
      ref={containerRef}
      className={`bulk-operations-panel ${theme} ${className}`}
      role="region"
      aria-label="Bulk Operations"
    >
      <div className="bulk-operations-header">
        <div className="bulk-operations-selection-info">
          <div className="bulk-operations-count">
            {selectedItems.length > 0 ? (
              <>
                <span className="bulk-operations-count-number">{selectedItems.length}</span>
                <span className="bulk-operations-count-text"> items selected</span>
                {selectedItems.length === maxSelectableItems && (
                  <span className="bulk-operations-count-limit"> (maximum)</span>
                )}
              </>
            ) : (
              <span className="bulk-operations-count-text">No items selected</span>
            )}
          </div>
          
          {selectedItems.length > 0 && (
            <div className="bulk-operations-selection-actions">
              <button
                type="button"
                className="bulk-operations-selection-action"
                onClick={handleClearSelection}
                aria-label="Clear selection"
              >
                Clear
              </button>
            </div>
          )}
        </div>
        
        <div className="bulk-operations-filters">
          <div className="bulk-operations-search">
            <input
              type="text"
              placeholder="Search items..."
              value={searchQuery}
              onChange={handleSearchChange}
              aria-label="Search items"
            />
            {searchQuery && (
              <button
                type="button"
                className="bulk-operations-search-clear"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>
          
          {filters.length > 0 && (
            <div className="bulk-operations-filter-buttons">
              {filters.map(filter => (
                <button
                  key={filter.id}
                  type="button"
                  className={`bulk-operations-filter-button ${activeFilter === filter.id ? 'active' : ''}`}
                  onClick={() => handleFilterChange(filter.id)}
                  aria-label={`Filter by ${filter.label}`}
                  aria-pressed={activeFilter === filter.id}
                >
                  {filter.icon && <span className="bulk-operations-filter-icon">{filter.icon}</span>}
                  {filter.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {selectedItems.length > 0 && (
        <div className="bulk-operations-toolbar">
          <div className="bulk-operations-actions">
            {actions.map(action => {
              // Check if action should be hidden
              const isHidden = typeof action.hidden === 'function' 
                ? action.hidden(selectedItems)
                : action.hidden;
              
              if (isHidden) return null;
              
              // Check if action is disabled
              const isDisabled = typeof action.disabled === 'function' 
                ? action.disabled(selectedItems)
                : action.disabled;
              
              return (
                <button
                  key={action.id}
                  type="button"
                  className={`bulk-operations-action ${action.dangerLevel ? `danger-${action.dangerLevel}` : ''}`}
                  onClick={() => handleActionClick(action)}
                  disabled={isDisabled}
                  aria-label={action.label}
                >
                  {action.icon && <span className="bulk-operations-action-icon">{action.icon}</span>}
                  {action.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
      
      <div className="bulk-operations-content">
        {processedItems.length === 0 ? (
          <div className="bulk-operations-empty">
            {renderEmptyState ? renderEmptyState() : (
              <>
                <div className="bulk-operations-empty-icon">📋</div>
                <div className="bulk-operations-empty-text">No items found</div>
                {searchQuery && (
                  <div className="bulk-operations-empty-subtext">
                    Try adjusting your search or filters
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div 
            className="bulk-operations-items"
            role="grid"
            aria-multiselectable="true"
            aria-label="Selectable items"
          >
            {processedItems.map((item, index) => {
              const isSelected = isItemSelected(item);
              
              return (
                <div
                  key={item[itemKeyField]}
                  className={`bulk-operations-item ${isSelected ? 'selected' : ''}`}
                  onClick={(e) => handleItemClick(item, index, e)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleItemSelect(item, index, e.shiftKey);
                    }
                  }}
                  role="row"
                  aria-selected={isSelected}
                  tabIndex={0}
                  data-testid={`bulk-item-${item[itemKeyField]}`}
                >
                  {renderItem ? (
                    renderItem(item, isSelected, (selected) => {
                      if (selected && !isSelected) {
                        handleItemSelect(item, index, false);
                      } else if (!selected && isSelected) {
                        handleItemSelect(item, index, false);
                      }
                    })
                  ) : (
                    <>
                      <div className="bulk-operations-item-checkbox">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleItemSelect(item, index, false);
                          }}
                          aria-label={`Select ${item.name}`}
                        />
                      </div>
                      <div className="bulk-operations-item-content">
                        <div className="bulk-operations-item-title">
                          {item.name}
                        </div>
                        <div className="bulk-operations-item-details">
                          <span className="bulk-operations-item-id">{item.id}</span>
                          <span className="bulk-operations-item-type">{item.type}</span>
                          <span className="bulk-operations-item-status">{item.status}</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      {isOperationInProgress && (
        <div className="bulk-operations-progress-overlay">
          <div className="bulk-operations-progress-container">
            <div className="bulk-operations-progress-title">
              {currentOperation && (
                `${currentOperation.charAt(0).toUpperCase() + currentOperation.slice(1)} in progress...`
              )}
            </div>
            
            <div className="bulk-operations-progress-bar-container">
              <div 
                className="bulk-operations-progress-bar"
                style={{ width: `${operationProgress}%` }}
                role="progressbar"
                aria-valuenow={operationProgress}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
            
            <div className="bulk-operations-progress-status">
              {operationProgress}% complete
            </div>
            
            <button
              type="button"
              className="bulk-operations-progress-cancel"
              onClick={handleCancelOperation}
              aria-label="Cancel operation"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      
      {confirmationDialog.isOpen && createPortal(
        <div 
          className={`bulk-operations-confirmation-overlay ${theme}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirmation-title"
        >
          <div className="bulk-operations-confirmation">
            <div className="bulk-operations-confirmation-header" id="confirmation-title">
              Confirm Action
            </div>
            
            <div className="bulk-operations-confirmation-content">
              {confirmationDialog.message}
            </div>
            
            <div className="bulk-operations-confirmation-actions">
              <button
                type="button"
                className="bulk-operations-confirmation-cancel"
                onClick={confirmationDialog.onCancel}
                aria-label="Cancel"
              >
                Cancel
              </button>
              <button
                type="button"
                className="bulk-operations-confirmation-confirm"
                onClick={confirmationDialog.onConfirm}
                aria-label="Confirm"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      
      <style jsx>{`
        .bulk-operations-panel {
          display: flex;
          flex-direction: column;
          border: 1px solid var(--border-color, #e0e0e0);
          border-radius: 4px;
          overflow: hidden;
          height: 100%;
          background-color: var(--panel-bg, #ffffff);
        }
        
        .bulk-operations-panel.dark {
          --panel-bg: #1e1e1e;
          --panel-text: #ffffff;
          --border-color: #444444;
          --item-bg: #2c2c2c;
          --item-hover-bg: #333333;
          --item-selected-bg: #2b4f76;
          --item-selected-border: #4d8bff;
          --button-bg: #333333;
          --button-text: #ffffff;
          --button-hover-bg: #444444;
          --danger-low-bg: #4d3a3a;
          --danger-medium-bg: #5c3030;
          --danger-high-bg: #6b2020;
          --progress-bar-bg: #2b4f76;
          --input-bg: #333333;
          --input-text: #ffffff;
          --input-border: #555555;
        }
        
        .bulk-operations-panel.light {
          --panel-bg: #ffffff;
          --panel-text: #333333;
          --border-color: #e0e0e0;
          --item-bg: #ffffff;
          --item-hover-bg: #f5f5f5;
          --item-selected-bg: #e6f0ff;
          --item-selected-border: #4d8bff;
          --button-bg: #f5f5f5;
          --button-text: #333333;
          --button-hover-bg: #e8e8e8;
          --danger-low-bg: #fff1f0;
          --danger-medium-bg: #ffccc7;
          --danger-high-bg: #ff7875;
          --progress-bar-bg: #4d8bff;
          --input-bg: #ffffff;
          --input-text: #333333;
          --input-border: #d9d9d9;
        }
        
        .bulk-operations-header {
          padding: 12px 16px;
          border-bottom: 1px solid var(--border-color);
        }
        
        .bulk-operations-selection-info {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        
        .bulk-operations-count {
          font-size: 14px;
          color: var(--panel-text);
        }
        
        .bulk-operations-count-number {
          font-weight: 600;
        }
        
        .bulk-operations-count-limit {
          color: #ff7875;
          font-size: 12px;
        }
        
        .bulk-operations-selection-action {
          background: none;
          border: none;
          color: #4d8bff;
          cursor: pointer;
          font-size: 13px;
          padding: 4px 8px;
          border-radius: 4px;
        }
        
        .bulk-operations-filters {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
        }
        
        .bulk-operations-search {
          position: relative;
          flex: 1;
          min-width: 200px;
        }
        
        .bulk-operations-search input {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid var(--input-border);
          border-radius: 4px;
          font-size: 14px;
          background-color: var(--input-bg);
          color: var(--input-text);
        }
        
        .bulk-operations-search-clear {
          position: absolute;
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: #999999;
          cursor: pointer;
          padding: 4px;
          font-size: 12px;
          border-radius: 50%;
        }
        
        .bulk-operations-filter-buttons {
          display: flex;
          gap: 4px;
        }
        
        .bulk-operations-filter-button {
          background-color: var(--button-bg);
          border: 1px solid var(--border-color);
          color: var(--button-text);
          padding: 6px 10px;
          font-size: 13px;
          border-radius: 4px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        
        .bulk-operations-filter-button.active {
          background-color: #4d8bff;
          border-color: #4d8bff;
          color: #ffffff;
        }
        
        .bulk-operations-toolbar {
          padding: 12px 16px;
          border-bottom: 1px solid var(--border-color);
          background-color: var(--item-selected-bg);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .bulk-operations-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        
        .bulk-operations-action {
          background-color: var(--button-bg);
          border: 1px solid var(--border-color);
          color: var(--button-text);
          padding: 8px 12px;
          font-size: 13px;
          border-radius: 4px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        
        .bulk-operations-action:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .bulk-operations-action.danger-high {
          background-color: var(--danger-high-bg);
          border-color: var(--danger-high-bg);
          color: #ffffff;
        }
        
        .bulk-operations-content {
          flex: 1;
          overflow-y: auto;
        }
        
        .bulk-operations-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 48px 16px;
          color: var(--panel-text);
        }
        
        .bulk-operations-empty-icon {
          font-size: 32px;
          margin-bottom: 16px;
        }
        
        .bulk-operations-empty-text {
          font-size: 16px;
          font-weight: 500;
          margin-bottom: 8px;
        }
        
        .bulk-operations-items {
          display: flex;
          flex-direction: column;
        }
        
        .bulk-operations-item {
          display: flex;
          align-items: center;
          padding: 12px 16px;
          border-bottom: 1px solid var(--border-color);
          cursor: pointer;
          background-color: var(--item-bg);
          transition: background-color 0.1s ease;
          border-left: 3px solid transparent;
        }
        
        .bulk-operations-item:hover {
          background-color: var(--item-hover-bg);
        }
        
        .bulk-operations-item.selected {
          background-color: var(--item-selected-bg);
          border-left-color: var(--item-selected-border);
        }
        
        .bulk-operations-item-checkbox {
          margin-right: 12px;
        }
        
        .bulk-operations-item-content {
          flex: 1;
          min-width: 0;
        }
        
        .bulk-operations-item-title {
          font-size: 14px;
          font-weight: 500;
          color: var(--panel-text);
          margin-bottom: 4px;
        }
        
        .bulk-operations-item-details {
          display: flex;
          gap: 12px;
          font-size: 12px;
          color: #999999;
        }
        
        .bulk-operations-progress-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        
        .bulk-operations-progress-container {
          background-color: var(--panel-bg);
          border-radius: 8px;
          padding: 24px;
          width: 400px;
          max-width: 90%;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
        
        .bulk-operations-progress-title {
          font-size: 16px;
          font-weight: 500;
          color: var(--panel-text);
          margin-bottom: 16px;
          text-align: center;
        }
        
        .bulk-operations-progress-bar-container {
          height: 8px;
          background-color: var(--border-color);
          border-radius: 4px;
          overflow: hidden;
          margin-bottom: 8px;
        }
        
        .bulk-operations-progress-bar {
          height: 100%;
          background-color: var(--progress-bar-bg);
          transition: width 0.3s ease;
        }
        
        .bulk-operations-progress-status {
          font-size: 14px;
          color: var(--panel-text);
          text-align: center;
          margin-bottom: 16px;
        }
        
        .bulk-operations-progress-cancel {
          display: block;
          width: 100%;
          padding: 8px 12px;
          background-color: var(--button-bg);
          border: 1px solid var(--border-color);
          color: var(--button-text);
          border-radius: 4px;
          font-size: 14px;
          cursor: pointer;
        }
        
        .bulk-operations-confirmation-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1001;
        }
        
        .bulk-operations-confirmation {
          background-color: var(--panel-bg);
          border-radius: 8px;
          padding: 24px;
          width: 400px;
          max-width: 90%;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
        
        .bulk-operations-confirmation-header {
          font-size: 18px;
          font-weight: 600;
          color: var(--panel-text);
          margin-bottom: 16px;
        }
        
        .bulk-operations-confirmation-content {
          font-size: 14px;
          color: var(--panel-text);
          margin-bottom: 24px;
        }
        
        .bulk-operations-confirmation-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
        }
        
        .bulk-operations-confirmation-cancel,
        .bulk-operations-confirmation-confirm {
          padding: 8px 16px;
          border-radius: 4px;
          font-size: 14px;
          cursor: pointer;
        }
        
        .bulk-operations-confirmation-cancel {
          background-color: var(--button-bg);
          border: 1px solid var(--border-color);
          color: var(--button-text);
        }
        
        .bulk-operations-confirmation-confirm {
          background-color: #ff4d4f;
          border: 1px solid #ff4d4f;
          color: #ffffff;
        }
        
        @media (max-width: 768px) {
          .bulk-operations-selection-info {
            flex-direction: column;
            align-items: flex-start;
            gap: 8px;
          }
          
          .bulk-operations-filters {
            flex-direction: column;
            align-items: stretch;
          }
          
          .bulk-operations-toolbar {
            flex-direction: column;
            gap: 12px;
            align-items: stretch;
          }
        }
      `}</style>
    </div>
  );
};

export default BulkOperationsPanel;
