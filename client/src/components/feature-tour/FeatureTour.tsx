import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useLoadingContext } from '../../contexts/LoadingContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useAnalytics } from '../../hooks/useAnalytics';
import { useFeatureFlag } from '../../hooks/useFeatureFlag';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import useKeyboardShortcut from '../../hooks/useKeyboardShortcut';

// Types and interfaces
export interface TourStep {
  id: string;
  title: string;
  content: React.ReactNode;
  target: string | HTMLElement | null;
  position?: 'top' | 'right' | 'bottom' | 'left' | 'center';
  arrow?: boolean;
  highlight?: boolean;
  highlightPadding?: number;
  scrollToTarget?: boolean;
  scrollOptions?: ScrollIntoViewOptions;
  disableOverlay?: boolean;
  disableInteraction?: boolean;
  showSkip?: boolean;
  showProgress?: boolean;
  onBeforeShow?: () => Promise<boolean> | boolean;
  onAfterShow?: () => void;
  onBeforeHide?: () => Promise<boolean> | boolean;
  onAfterHide?: () => void;
}

export interface TourTheme {
  backgroundColor: string;
  textColor: string;
  primaryColor: string;
  overlayColor: string;
  highlightColor: string;
  tooltipBorderRadius: string;
  buttonBackgroundColor: string;
  buttonTextColor: string;
  buttonHoverBackgroundColor: string;
  fontFamily: string;
}

export interface FeatureTourProps {
  steps?: TourStep[];
  isOpen?: boolean;
  onClose?: () => void;
  onComplete?: () => void;
  onSkip?: () => void;
  onStepChange?: (step: number) => void;
  showProgress?: boolean;
  showSkip?: boolean;
  showClose?: boolean;
  disableKeyboardNavigation?: boolean;
  disableOverlay?: boolean;
  disableInteraction?: boolean;
  highlightPadding?: number;
  scrollToSteps?: boolean;
  scrollOptions?: ScrollIntoViewOptions;
  className?: string;
  theme?: Partial<TourTheme>;
  tourId?: string;
  autoStart?: boolean;
  startAt?: number;
  debug?: boolean;
  analyticsCategory?: string;
}

// Default command palette tour steps
export const commandPaletteTourSteps: TourStep[] = [
  {
    id: 'command-palette-intro',
    title: 'Command Palette',
    content: (
      <div>
        <p>The Command Palette gives you quick access to all platform features with just a keyboard shortcut.</p>
        <p>Press <kbd>⌘K</kbd> (Mac) or <kbd>Ctrl+K</kbd> (Windows/Linux) to open it anytime.</p>
      </div>
    ),
    target: 'body',
    position: 'center',
    arrow: false,
    highlight: false,
    showSkip: true,
    showProgress: true
  },
  {
    id: 'command-palette-shortcut',
    title: 'Keyboard Shortcut',
    content: (
      <div>
        <p>Try opening the Command Palette now with <kbd>⌘K</kbd> or <kbd>Ctrl+K</kbd>.</p>
        <p>You can search for any command, navigate to any page, or perform actions without using your mouse.</p>
      </div>
    ),
    target: '.app-header',
    position: 'bottom',
    arrow: true,
    highlight: true,
    highlightPadding: 8,
    scrollToTarget: true
  },
  {
    id: 'command-palette-search',
    title: 'Fuzzy Search',
    content: (
      <div>
        <p>The Command Palette uses fuzzy search to find what you need quickly.</p>
        <p>Just start typing and results will appear instantly - even with typos!</p>
      </div>
    ),
    target: '.command-palette-search',
    position: 'bottom',
    arrow: true,
    highlight: true,
    highlightPadding: 4,
    disableOverlay: true,
    onBeforeShow: () => {
      // Try to open command palette if not already open
      const isOpen = document.querySelector('.command-palette') !== null;
      if (!isOpen) {
        // Simulate keyboard shortcut
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const event = new KeyboardEvent('keydown', {
          key: 'k',
          code: 'KeyK',
          metaKey: isMac,
          ctrlKey: !isMac
        });
        document.dispatchEvent(event);
        
        // Wait for command palette to open
        return new Promise<boolean>(resolve => {
          let attempts = 0;
          const checkInterval = setInterval(() => {
            const isNowOpen = document.querySelector('.command-palette') !== null;
            attempts++;
            
            if (isNowOpen || attempts > 10) {
              clearInterval(checkInterval);
              resolve(isNowOpen);
            }
          }, 100);
        });
      }
      return true;
    }
  },
  {
    id: 'command-palette-navigation',
    title: 'Keyboard Navigation',
    content: (
      <div>
        <p>Use <kbd>↑</kbd> and <kbd>↓</kbd> arrows to navigate between results.</p>
        <p>Press <kbd>Enter</kbd> to select a command or <kbd>Esc</kbd> to close the palette.</p>
      </div>
    ),
    target: '.command-palette-commands',
    position: 'right',
    arrow: true,
    highlight: true,
    disableOverlay: true
  }
];

// Default bulk operations tour steps
export const bulkOperationsTourSteps: TourStep[] = [
  {
    id: 'bulk-operations-intro',
    title: 'Bulk Operations',
    content: (
      <div>
        <p>Bulk Operations let you perform actions on multiple items at once, saving you time and effort.</p>
        <p>Let's explore the powerful selection features available to you.</p>
      </div>
    ),
    target: 'body',
    position: 'center',
    arrow: false,
    highlight: false,
    showSkip: true,
    showProgress: true
  },
  {
    id: 'bulk-operations-checkbox',
    title: 'Item Selection',
    content: (
      <div>
        <p>Click the checkbox next to any item to select it.</p>
        <p>You can select up to 100 items at once for bulk operations.</p>
      </div>
    ),
    target: '.bulk-operations-item-checkbox',
    position: 'right',
    arrow: true,
    highlight: true,
    highlightPadding: 8,
    scrollToTarget: true
  },
  {
    id: 'bulk-operations-shift-click',
    title: 'Range Selection',
    content: (
      <div>
        <p>Hold <kbd>Shift</kbd> and click to select a range of items.</p>
        <p>This is perfect for quickly selecting many consecutive items.</p>
      </div>
    ),
    target: '.bulk-operations-items',
    position: 'left',
    arrow: true,
    highlight: true,
    highlightPadding: 4
  },
  {
    id: 'bulk-operations-actions',
    title: 'Bulk Actions',
    content: (
      <div>
        <p>Once items are selected, use these action buttons to perform operations on all selected items at once.</p>
        <p>Actions are intelligently enabled based on your selection.</p>
      </div>
    ),
    target: '.bulk-operations-actions',
    position: 'bottom',
    arrow: true,
    highlight: true,
    highlightPadding: 4,
    onBeforeShow: () => {
      // Check if any items are selected
      const selectedItems = document.querySelectorAll('.bulk-operations-item.selected');
      if (selectedItems.length === 0) {
        // Try to select the first item
        const firstCheckbox = document.querySelector('.bulk-operations-item-checkbox input') as HTMLInputElement;
        if (firstCheckbox) {
          firstCheckbox.click();
          return true;
        }
        return false;
      }
      return true;
    }
  },
  {
    id: 'bulk-operations-filters',
    title: 'Quick Filters',
    content: (
      <div>
        <p>Use these filter buttons to quickly find the items you need.</p>
        <p>Combine with search for even more precise results.</p>
      </div>
    ),
    target: '.bulk-operations-filter-buttons',
    position: 'bottom',
    arrow: true,
    highlight: true,
    highlightPadding: 4
  }
];

// Default themes
const defaultThemes = {
  light: {
    backgroundColor: '#ffffff',
    textColor: '#333333',
    primaryColor: '#4d8bff',
    overlayColor: 'rgba(0, 0, 0, 0.5)',
    highlightColor: 'rgba(77, 139, 255, 0.3)',
    tooltipBorderRadius: '8px',
    buttonBackgroundColor: '#4d8bff',
    buttonTextColor: '#ffffff',
    buttonHoverBackgroundColor: '#3a7ae0',
    fontFamily: 'inherit'
  },
  dark: {
    backgroundColor: '#1e1e1e',
    textColor: '#ffffff',
    primaryColor: '#4d8bff',
    overlayColor: 'rgba(0, 0, 0, 0.7)',
    highlightColor: 'rgba(77, 139, 255, 0.3)',
    tooltipBorderRadius: '8px',
    buttonBackgroundColor: '#4d8bff',
    buttonTextColor: '#ffffff',
    buttonHoverBackgroundColor: '#3a7ae0',
    fontFamily: 'inherit'
  }
};

// Helper component: Highlight
const Highlight: React.FC<{
  target: HTMLElement;
  padding?: number;
  disableInteraction?: boolean;
  highlightColor: string;
}> = ({ target, padding = 8, disableInteraction, highlightColor }) => {
  const [position, setPosition] = useState({
    top: 0,
    left: 0,
    width: 0,
    height: 0
  });
  
  useEffect(() => {
    const updatePosition = () => {
      if (!target) return;
      
      const rect = target.getBoundingClientRect();
      setPosition({
        top: rect.top + window.scrollY - padding,
        left: rect.left + window.scrollX - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2
      });
    };
    
    updatePosition();
    
    // Update position on resize and scroll
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition);
    
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition);
    };
  }, [target, padding]);
  
  return (
    <div
      className="feature-tour-highlight"
      style={{
        position: 'absolute',
        top: position.top,
        left: position.left,
        width: position.width,
        height: position.height,
        boxShadow: `0 0 0 9999px ${highlightColor}`,
        borderRadius: '4px',
        zIndex: 9998,
        pointerEvents: disableInteraction ? 'none' : 'auto'
      }}
      aria-hidden="true"
    />
  );
};

// Main component
export const FeatureTour: React.FC<FeatureTourProps> = ({
  steps = [],
  isOpen: propIsOpen,
  onClose,
  onComplete,
  onSkip,
  onStepChange,
  showProgress = true,
  showSkip = true,
  showClose = true,
  disableKeyboardNavigation = false,
  disableOverlay = false,
  disableInteraction = false,
  highlightPadding = 8,
  scrollToSteps = true,
  scrollOptions = { behavior: 'smooth', block: 'center' },
  className = '',
  theme: customTheme = {},
  tourId = 'default-tour',
  autoStart = false,
  startAt = 0,
  debug = false,
  analyticsCategory = 'feature_tour'
}) => {
  // Get loading context for loading states
  const { startLoading, stopLoading } = useLoadingContext();
  
  // Get theme context for dark/light mode support
  const { theme: appTheme } = useTheme();
  
  // Analytics for tracking
  const { trackEvent } = useAnalytics();
  
  // Feature flag for progressive rollout
  const isEnabled = useFeatureFlag('feature_tour_enabled');
  
  // Store completed tours in local storage
  const [completedTours, setCompletedTours] = useLocalStorage<string[]>(
    'feature-tour-completed',
    []
  );
  
  // Store current step in local storage for resuming tours
  const [tourProgress, setTourProgress] = useLocalStorage<Record<string, number>>(
    'feature-tour-progress',
    {}
  );
  
  // Local state
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(startAt);
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({
    top: 0,
    left: 0
  });
  const [isVisible, setIsVisible] = useState(false);
  
  // Refs
  const tooltipRef = useRef<HTMLDivElement>(null);
  
  // Computed values
  const isTourCompleted = useMemo(() => {
    return completedTours.includes(tourId);
  }, [completedTours, tourId]);
  
  // Merge themes
  const mergedTheme: TourTheme = useMemo(() => {
    const baseTheme = appTheme.mode === 'dark' ? defaultThemes.dark : defaultThemes.light;
    return { ...baseTheme, ...customTheme };
  }, [appTheme, customTheme]);
  
  // Current step data
  const currentStepData = useMemo(() => {
    return steps[currentStep] || null;
  }, [steps, currentStep]);
  
  // Handle keyboard navigation
  useKeyboardShortcut(['Escape'], () => {
    if (!disableKeyboardNavigation && isOpen) {
      handleClose();
      trackEvent(`${analyticsCategory}_keyboard_escape`);
    }
  });
  
  useKeyboardShortcut(['ArrowRight'], () => {
    if (!disableKeyboardNavigation && isOpen && currentStep < steps.length - 1) {
      handleNext();
      trackEvent(`${analyticsCategory}_keyboard_next`);
    }
  });
  
  useKeyboardShortcut(['ArrowLeft'], () => {
    if (!disableKeyboardNavigation && isOpen && currentStep > 0) {
      handlePrevious();
      trackEvent(`${analyticsCategory}_keyboard_previous`);
    }
  });
  
  // Find target element
  const findTargetElement = useCallback((target: string | HTMLElement | null): HTMLElement | null => {
    if (!target) return null;
    if (target === 'body') return document.body;
    if (typeof target === 'string') {
      return document.querySelector(target) as HTMLElement;
    }
    return target;
  }, []);
  
  // Calculate tooltip position
  const calculateTooltipPosition = useCallback((
    targetEl: HTMLElement,
    position: TourStep['position'] = 'bottom',
    tooltipEl: HTMLElement | null
  ) => {
    if (!targetEl || !tooltipEl) return { top: 0, left: 0 };
    
    const targetRect = targetEl.getBoundingClientRect();
    const tooltipRect = tooltipEl.getBoundingClientRect();
    
    const scrollY = window.scrollY;
    const scrollX = window.scrollX;
    
    let top = 0;
    let left = 0;
    
    switch (position) {
      case 'top':
        top = targetRect.top + scrollY - tooltipRect.height - 16;
        left = targetRect.left + scrollX + (targetRect.width / 2) - (tooltipRect.width / 2);
        break;
      case 'right':
        top = targetRect.top + scrollY + (targetRect.height / 2) - (tooltipRect.height / 2);
        left = targetRect.right + scrollX + 16;
        break;
      case 'bottom':
        top = targetRect.bottom + scrollY + 16;
        left = targetRect.left + scrollX + (targetRect.width / 2) - (tooltipRect.width / 2);
        break;
      case 'left':
        top = targetRect.top + scrollY + (targetRect.height / 2) - (tooltipRect.height / 2);
        left = targetRect.left + scrollX - tooltipRect.width - 16;
        break;
      case 'center':
        top = window.innerHeight / 2 - tooltipRect.height / 2 + scrollY;
        left = window.innerWidth / 2 - tooltipRect.width / 2 + scrollX;
        break;
    }
    
    // Ensure tooltip stays within viewport
    const padding = 10;
    
    // Check right edge
    if (left + tooltipRect.width > window.innerWidth - padding) {
      left = window.innerWidth - tooltipRect.width - padding;
    }
    
    // Check left edge
    if (left < padding) {
      left = padding;
    }
    
    // Check bottom edge
    if (top + tooltipRect.height > window.innerHeight + scrollY - padding) {
      top = window.innerHeight + scrollY - tooltipRect.height - padding;
    }
    
    // Check top edge
    if (top < scrollY + padding) {
      top = scrollY + padding;
    }
    
    return { top, left };
  }, []);
  
  // Update tooltip position
  const updateTooltipPosition = useCallback(() => {
    if (!currentStepData || !targetElement || !tooltipRef.current) return;
    
    const position = currentStepData.position || 'bottom';
    const newPosition = calculateTooltipPosition(targetElement, position, tooltipRef.current);
    
    setTooltipPosition(newPosition);
  }, [currentStepData, targetElement, calculateTooltipPosition]);
  
  // Scroll to target
  const scrollToTarget = useCallback((targetEl: HTMLElement | null) => {
    if (!targetEl || targetEl === document.body) return;
    
    targetEl.scrollIntoView(scrollOptions);
  }, [scrollOptions]);
  
  // Show step
  const showStep = useCallback(async (stepIndex: number) => {
    if (stepIndex < 0 || stepIndex >= steps.length) return;
    
    const step = steps[stepIndex];
    
    // Check if step should be shown
    if (step.onBeforeShow) {
      const shouldShow = await step.onBeforeShow();
      if (!shouldShow) {
        // Skip this step
        if (stepIndex < steps.length - 1) {
          showStep(stepIndex + 1);
        } else {
          handleComplete();
        }
        return;
      }
    }
    
    // Find target element
    const targetEl = findTargetElement(step.target);
    setTargetElement(targetEl);
    
    // Scroll to target if needed
    const shouldScroll = step.scrollToTarget !== undefined ? step.scrollToTarget : scrollToSteps;
    if (shouldScroll && targetEl) {
      scrollToTarget(targetEl);
    }
    
    // Update current step
    setCurrentStep(stepIndex);
    
    // Save progress
    setTourProgress(prev => ({
      ...prev,
      [tourId]: stepIndex
    }));
    
    // Notify step change
    onStepChange?.(stepIndex);
    
    // Track step view
    trackEvent(`${analyticsCategory}_step_view`, {
      tour_id: tourId,
      step_id: step.id,
      step_index: stepIndex
    });
    
    // Call after show callback
    step.onAfterShow?.();
    
    // Set visible after a small delay to ensure positioning is correct
    setTimeout(() => {
      setIsVisible(true);
    }, 100);
  }, [
    steps,
    findTargetElement,
    scrollToSteps,
    scrollToTarget,
    tourId,
    setTourProgress,
    onStepChange,
    trackEvent,
    analyticsCategory
  ]);
  
  // Handle next step
  const handleNext = useCallback(async () => {
    if (currentStep >= steps.length - 1) {
      handleComplete();
      return;
    }
    
    // Hide current step
    setIsVisible(false);
    
    // Check if current step allows navigation
    if (currentStepData?.onBeforeHide) {
      const canProceed = await currentStepData.onBeforeHide();
      if (!canProceed) return;
    }
    
    // Call after hide callback
    currentStepData?.onAfterHide?.();
    
    // Track step completion
    trackEvent(`${analyticsCategory}_step_complete`, {
      tour_id: tourId,
      step_id: currentStepData?.id,
      step_index: currentStep
    });
    
    // Show next step after a small delay
    setTimeout(() => {
      showStep(currentStep + 1);
    }, 300);
  }, [currentStep, steps.length, currentStepData, showStep, trackEvent, analyticsCategory, tourId]);
  
  // Handle previous step
  const handlePrevious = useCallback(() => {
    if (currentStep <= 0) return;
    
    // Hide current step
    setIsVisible(false);
    
    // Track step navigation
    trackEvent(`${analyticsCategory}_step_back`, {
      tour_id: tourId,
      step_id: currentStepData?.id,
      step_index: currentStep
    });
    
    // Show previous step after a small delay
    setTimeout(() => {
      showStep(currentStep - 1);
    }, 300);
  }, [currentStep, showStep, currentStepData, trackEvent, analyticsCategory, tourId]);
  
  // Handle close
  const handleClose = useCallback(() => {
    setIsOpen(false);
    setIsVisible(false);
    
    // Track tour close
    trackEvent(`${analyticsCategory}_close`, {
      tour_id: tourId,
      step_id: currentStepData?.id,
      step_index: currentStep,
      completed_steps: currentStep
    });
    
    // Notify close
    onClose?.();
  }, [onClose, currentStepData, currentStep, trackEvent, analyticsCategory, tourId]);
  
  // Handle skip
  const handleSkip = useCallback(() => {
    setIsOpen(false);
    setIsVisible(false);
    
    // Track tour skip
    trackEvent(`${analyticsCategory}_skip`, {
      tour_id: tourId,
      step_id: currentStepData?.id,
      step_index: currentStep,
      completed_steps: currentStep
    });
    
    // Notify skip
    onSkip?.();
  }, [onSkip, currentStepData, currentStep, trackEvent, analyticsCategory, tourId]);
  
  // Handle complete
  const handleComplete = useCallback(() => {
    setIsOpen(false);
    setIsVisible(false);
    
    // Mark tour as completed
    setCompletedTours(prev => {
      if (prev.includes(tourId)) return prev;
      return [...prev, tourId];
    });
    
    // Track tour complete
    trackEvent(`${analyticsCategory}_complete`, {
      tour_id: tourId,
      total_steps: steps.length
    });
    
    // Notify complete
    onComplete?.();
  }, [onComplete, tourId, setCompletedTours, steps.length, trackEvent, analyticsCategory]);
  
  // Start tour
  const startTour = useCallback(() => {
    if (!isEnabled || isTourCompleted) return;
    
    // Start loading
    startLoading(`feature_tour_${tourId}`);
    
    // Get starting step (resume from saved progress if available)
    const savedProgress = tourProgress[tourId];
    const initialStep = savedProgress !== undefined ? savedProgress : startAt;
    
    setIsOpen(true);
    setCurrentStep(initialStep);
    
    // Track tour start
    trackEvent(`${analyticsCategory}_start`, {
      tour_id: tourId,
      initial_step: initialStep,
      is_resumed: savedProgress !== undefined
    });
    
    // Show first step
    showStep(initialStep);
    
    // Stop loading
    stopLoading(`feature_tour_${tourId}`);
  }, [
    isEnabled,
    isTourCompleted,
    tourId,
    tourProgress,
    startAt,
    showStep,
    startLoading,
    stopLoading,
    trackEvent,
    analyticsCategory
  ]);
  
  // Handle controlled open state
  useEffect(() => {
    if (propIsOpen !== undefined) {
      if (propIsOpen && !isOpen) {
        startTour();
      } else if (!propIsOpen && isOpen) {
        handleClose();
      }
    }
  }, [propIsOpen, isOpen, startTour, handleClose]);
  
  // Auto start tour
  useEffect(() => {
    if (autoStart && !isTourCompleted) {
      startTour();
    }
  }, [autoStart, isTourCompleted, startTour]);
  
  // Update tooltip position when target or step changes
  useEffect(() => {
    if (isOpen && targetElement && tooltipRef.current) {
      updateTooltipPosition();
    }
  }, [isOpen, targetElement, updateTooltipPosition]);
  
  // Update tooltip position on resize and scroll
  useEffect(() => {
    if (!isOpen) return;
    
    const handleResize = () => {
      updateTooltipPosition();
    };
    
    const handleScroll = () => {
      updateTooltipPosition();
    };
    
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [isOpen, updateTooltipPosition]);
  
  // Log debug info
  useEffect(() => {
    if (debug) {
      console.log('FeatureTour Debug:', {
        tourId,
        isOpen,
        currentStep,
        currentStepData,
        targetElement,
        isTourCompleted,
        tooltipPosition
      });
    }
  }, [debug, tourId, isOpen, currentStep, currentStepData, targetElement, isTourCompleted, tooltipPosition]);
  
  // Don't render if not enabled or not open
  if (!isEnabled || !isOpen) return null;
  
  // Render tour
  return createPortal(
    <>
      {/* Overlay */}
      {!disableOverlay && !currentStepData?.disableOverlay && (
        <div
          className="feature-tour-overlay"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: mergedTheme.overlayColor,
            zIndex: 9997,
            transition: 'opacity 0.3s ease',
            opacity: isVisible ? 1 : 0
          }}
          onClick={handleClose}
          role="presentation"
          aria-hidden="true"
        />
      )}
      
      {/* Highlight */}
      {targetElement && (currentStepData?.highlight ?? true) && (
        <Highlight
          target={targetElement}
          padding={currentStepData?.highlightPadding ?? highlightPadding}
          disableInteraction={currentStepData?.disableInteraction ?? disableInteraction}
          highlightColor={mergedTheme.highlightColor}
        />
      )}
      
      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className={`feature-tour-tooltip ${className}`}
        style={{
          position: 'absolute',
          top: tooltipPosition.top,
          left: tooltipPosition.left,
          maxWidth: '350px',
          backgroundColor: mergedTheme.backgroundColor,
          color: mergedTheme.textColor,
          borderRadius: mergedTheme.tooltipBorderRadius,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          zIndex: 9999,
          transition: 'opacity 0.3s ease, transform 0.3s ease',
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? 'translateY(0)' : 'translateY(10px)',
          fontFamily: mergedTheme.fontFamily
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`feature-tour-title-${currentStepData?.id}`}
        aria-describedby={`feature-tour-content-${currentStepData?.id}`}
      >
        {/* Tooltip Content */}
        <div className="feature-tour-tooltip-content" style={{ padding: '16px' }}>
          {/* Title */}
          <div
            id={`feature-tour-title-${currentStepData?.id}`}
            className="feature-tour-tooltip-title"
            style={{
              fontSize: '18px',
              fontWeight: 600,
              marginBottom: '8px',
              color: mergedTheme.textColor
            }}
          >
            {currentStepData?.title}
          </div>
          
          {/* Content */}
          <div
            id={`feature-tour-content-${currentStepData?.id}`}
            className="feature-tour-tooltip-body"
            style={{
              fontSize: '14px',
              lineHeight: 1.5,
              marginBottom: '16px',
              color: mergedTheme.textColor
            }}
          >
            {currentStepData?.content}
          </div>
          
          {/* Footer */}
          <div
            className="feature-tour-tooltip-footer"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            {/* Progress */}
            {(currentStepData?.showProgress ?? showProgress) && (
              <div
                className="feature-tour-tooltip-progress"
                style={{
                  fontSize: '12px',
                  color: mergedTheme.textColor
                }}
              >
                {currentStep + 1} of {steps.length}
              </div>
            )}
            
            {/* Buttons */}
            <div
              className="feature-tour-tooltip-buttons"
              style={{
                display: 'flex',
                gap: '8px'
              }}
            >
              {/* Skip Button */}
              {(currentStepData?.showSkip ?? showSkip) && currentStep < steps.length - 1 && (
                <button
                  type="button"
                  className="feature-tour-tooltip-skip"
                  onClick={handleSkip}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: mergedTheme.textColor,
                    padding: '8px 12px',
                    fontSize: '14px',
                    cursor: 'pointer',
                    borderRadius: '4px'
                  }}
                  aria-label="Skip tour"
                >
                  Skip
                </button>
              )}
              
              {/* Previous Button */}
              {currentStep > 0 && (
                <button
                  type="button"
                  className="feature-tour-tooltip-prev"
                  onClick={handlePrevious}
                  style={{
                    background: 'none',
                    border: `1px solid ${mergedTheme.primaryColor}`,
                    color: mergedTheme.primaryColor,
                    padding: '8px 12px',
                    fontSize: '14px',
                    cursor: 'pointer',
                    borderRadius: '4px'
                  }}
                  aria-label="Previous step"
                >
                  Previous
                </button>
              )}
              
              {/* Next/Finish Button */}
              <button
                type="button"
                className="feature-tour-tooltip-next"
                onClick={handleNext}
                style={{
                  backgroundColor: mergedTheme.buttonBackgroundColor,
                  border: 'none',
                  color: mergedTheme.buttonTextColor,
                  padding: '8px 16px',
                  fontSize: '14px',
                  cursor: 'pointer',
                  borderRadius: '4px'
                }}
                aria-label={currentStep < steps.length - 1 ? 'Next step' : 'Finish tour'}
              >
                {currentStep < steps.length - 1 ? 'Next' : 'Finish'}
              </button>
              
              {/* Close Button */}
              {showClose && (
                <button
                  type="button"
                  className="feature-tour-tooltip-close"
                  onClick={handleClose}
                  style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    background: 'none',
                    border: 'none',
                    color: mergedTheme.textColor,
                    fontSize: '16px',
                    cursor: 'pointer',
                    padding: '4px',
                    lineHeight: 1
                  }}
                  aria-label="Close tour"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>
        
        {/* Arrow */}
        {(currentStepData?.arrow ?? true) && currentStepData?.position !== 'center' && targetElement && (
          <div
            className={`feature-tour-tooltip-arrow feature-tour-tooltip-arrow-${currentStepData?.position || 'bottom'}`}
            style={{
              position: 'absolute',
              width: '12px',
              height: '12px',
              backgroundColor: mergedTheme.backgroundColor,
              transform: 'rotate(45deg)',
              ...(currentStepData?.position === 'top' && {
                bottom: '-6px',
                left: '50%',
                marginLeft: '-6px'
              }),
              ...(currentStepData?.position === 'right' && {
                left: '-6px',
                top: '50%',
                marginTop: '-6px'
              }),
              ...(currentStepData?.position === 'bottom' && {
                top: '-6px',
                left: '50%',
                marginLeft: '-6px'
              }),
              ...(currentStepData?.position === 'left' && {
                right: '-6px',
                top: '50%',
                marginTop: '-6px'
              })
            }}
            aria-hidden="true"
          />
        )}
      </div>
      
      {/* Mobile Responsive Styles */}
      <style>{`
        @media (max-width: 768px) {
          .feature-tour-tooltip {
            max-width: 90vw !important;
            width: 90vw !important;
            left: 5vw !important;
            right: 5vw !important;
          }
          
          .feature-tour-tooltip-footer {
            flex-direction: column;
            gap: 12px;
          }
          
          .feature-tour-tooltip-buttons {
            width: 100%;
            justify-content: space-between;
          }
        }
      `}</style>
    </>,
    document.body
  );
};

export default FeatureTour;
