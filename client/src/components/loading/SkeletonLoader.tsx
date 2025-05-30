import React, { useMemo, CSSProperties, ReactNode } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useWindowSize } from '../../hooks/useWindowSize';

// Animation types
export type SkeletonAnimation = 'wave' | 'pulse' | 'shimmer' | 'none';

// Base skeleton props
export interface SkeletonBaseProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  animation?: SkeletonAnimation;
  animationDuration?: number;
  backgroundColor?: string;
  highlightColor?: string;
  preserveAspectRatio?: boolean;
  className?: string;
  style?: CSSProperties;
  'aria-label'?: string;
  testId?: string;
}

// Props for skeleton variants
export interface SkeletonCardProps extends SkeletonBaseProps {
  header?: boolean;
  footer?: boolean;
  imageTop?: boolean;
  imageHeight?: string | number;
  lines?: number;
  lineHeight?: string | number;
  lineWidths?: (string | number)[];
  actionButtons?: number;
}

export interface SkeletonListProps extends SkeletonBaseProps {
  items?: number;
  itemHeight?: string | number;
  itemGap?: string | number;
  avatar?: boolean;
  avatarSize?: string | number;
  lines?: number;
  lineHeight?: string | number;
  lineWidths?: (string | number)[];
  actions?: boolean;
}

export interface SkeletonTableProps extends SkeletonBaseProps {
  rows?: number;
  columns?: number;
  headerHeight?: string | number;
  rowHeight?: string | number;
  cellWidths?: (string | number)[];
  showHeader?: boolean;
  showFooter?: boolean;
  showPagination?: boolean;
}

export interface SkeletonFormProps extends SkeletonBaseProps {
  rows?: number;
  rowGap?: string | number;
  labelWidth?: string | number;
  inputHeight?: string | number;
  showButtons?: boolean;
  buttonWidth?: string | number;
  buttonHeight?: string | number;
  fieldTypes?: ('text' | 'select' | 'checkbox' | 'radio' | 'textarea')[];
}

export interface SkeletonDashboardProps extends SkeletonBaseProps {
  layout?: 'grid' | 'flex';
  cards?: number;
  cardWidth?: string | number;
  cardHeight?: string | number;
  cardGap?: string | number;
  showCharts?: boolean;
  showTables?: boolean;
  showStats?: boolean;
}

export interface SkeletonConversationProps extends SkeletonBaseProps {
  messages?: number;
  messageGap?: string | number;
  alternating?: boolean;
  avatars?: boolean;
  avatarSize?: string | number;
  inputBar?: boolean;
  timestamps?: boolean;
  bubbleStyle?: boolean;
}

export interface SkeletonAnalyticsProps extends SkeletonBaseProps {
  charts?: number;
  chartTypes?: ('bar' | 'line' | 'pie' | 'area' | 'scatter')[];
  chartHeight?: string | number;
  showLegend?: boolean;
  showAxis?: boolean;
  showGrid?: boolean;
  showTooltip?: boolean;
  dataPoints?: number;
}

// Helper function to create keyframes
const createKeyframes = (name: string, frames: Record<string, CSSProperties>): string => {
  const keyframeString = Object.entries(frames)
    .map(([key, value]) => {
      const cssProps = Object.entries(value)
        .map(([prop, val]) => `${prop.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${val};`)
        .join(' ');
      return `${key} { ${cssProps} }`;
    })
    .join(' ');
  return `@keyframes ${name} { ${keyframeString} }`;
};

// Base Skeleton Component
export const SkeletonLoader: React.FC<SkeletonBaseProps> = ({
  width = '100%',
  height = '1.2em',
  borderRadius = '4px',
  animation = 'wave',
  animationDuration = 1.5,
  backgroundColor,
  highlightColor,
  preserveAspectRatio = true,
  className = '',
  style = {},
  'aria-label': ariaLabel = 'Loading content',
  testId = 'skeleton-loader',
}) => {
  const theme = useTheme();
  
  // Default colors based on theme
  const defaultBgColor = theme.colors.skeleton?.base || theme.colors.border || '#e0e0e0';
  const defaultHighlightColor = theme.colors.skeleton?.highlight || theme.colors.borderLight || '#f0f0f0';
  
  // Use provided colors or fallback to theme defaults
  const bgColor = backgroundColor || defaultBgColor;
  const hlColor = highlightColor || defaultHighlightColor;
  
  // Animation styles
  const animationStyles = useMemo(() => {
    if (animation === 'none') return {};
    
    const animationName = `skeleton-${animation}`;
    let keyframes = '';
    
    switch (animation) {
      case 'wave':
        keyframes = createKeyframes(animationName, {
          '0%': { transform: 'translateX(-100%)' },
          '50%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(100%)' },
        });
        return {
          position: 'relative',
          overflow: 'hidden',
          '&::after': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: `linear-gradient(90deg, transparent, ${hlColor}, transparent)`,
            animation: `${animationName} ${animationDuration}s ease-in-out infinite`,
          },
        };
        
      case 'pulse':
        keyframes = createKeyframes(animationName, {
          '0%': { opacity: 0.6 },
          '50%': { opacity: 0.8 },
          '100%': { opacity: 0.6 },
        });
        return {
          animation: `${animationName} ${animationDuration}s ease-in-out infinite`,
        };
        
      case 'shimmer':
        keyframes = createKeyframes(animationName, {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        });
        return {
          background: `linear-gradient(90deg, ${bgColor} 25%, ${hlColor} 50%, ${bgColor} 75%)`,
          backgroundSize: '200% 100%',
          animation: `${animationName} ${animationDuration}s infinite`,
        };
        
      default:
        return {};
    }
  }, [animation, animationDuration, bgColor, hlColor]);
  
  // Combine all styles
  const combinedStyles: CSSProperties = {
    width,
    height,
    borderRadius: typeof borderRadius === 'number' ? `${borderRadius}px` : borderRadius,
    backgroundColor: bgColor,
    display: 'block',
    ...style,
  };
  
  // Add animation styles as inline styles
  if (animation !== 'none') {
    if (animation === 'wave') {
      combinedStyles.position = 'relative';
      combinedStyles.overflow = 'hidden';
    } else if (animation === 'shimmer') {
      combinedStyles.backgroundImage = `linear-gradient(90deg, ${bgColor} 25%, ${hlColor} 50%, ${bgColor} 75%)`;
      combinedStyles.backgroundSize = '200% 100%';
      combinedStyles.animation = `skeleton-${animation} ${animationDuration}s infinite`;
    } else if (animation === 'pulse') {
      combinedStyles.animation = `skeleton-${animation} ${animationDuration}s ease-in-out infinite`;
    }
  }
  
  return (
    <>
      <style jsx global>{`
        @keyframes skeleton-wave {
          0% { transform: translateX(-100%); }
          50%, 100% { transform: translateX(100%); }
        }
        
        @keyframes skeleton-pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 0.8; }
        }
        
        @keyframes skeleton-shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        
        .skeleton-wave {
          position: relative;
          overflow: hidden;
        }
        
        .skeleton-wave::after {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(90deg, transparent, ${hlColor}, transparent);
          animation: skeleton-wave ${animationDuration}s ease-in-out infinite;
        }
      `}</style>
      <div
        className={`skeleton-loader ${animation !== 'none' ? `skeleton-${animation}` : ''} ${className}`}
        style={combinedStyles}
        aria-label={ariaLabel}
        aria-busy="true"
        aria-hidden="true"
        data-testid={testId}
        role="progressbar"
      />
    </>
  );
};

// Card Skeleton
export const SkeletonCard: React.FC<SkeletonCardProps> = ({
  width = '100%',
  height = 'auto',
  borderRadius = '8px',
  animation = 'wave',
  header = true,
  footer = false,
  imageTop = false,
  imageHeight = '180px',
  lines = 3,
  lineHeight = '1em',
  lineWidths = [],
  actionButtons = 0,
  ...rest
}) => {
  const theme = useTheme();
  const cardStyle: CSSProperties = {
    padding: '16px',
    boxShadow: theme.shadows?.card || '0 2px 8px rgba(0, 0, 0, 0.1)',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    backgroundColor: theme.colors.cardBackground || theme.colors.background || '#fff',
  };
  
  // Generate random widths for lines if not provided
  const calculatedLineWidths = useMemo(() => {
    if (lineWidths.length === lines) return lineWidths;
    return Array(lines).fill(0).map((_, i) => {
      if (lineWidths[i]) return lineWidths[i];
      // Last line is typically shorter
      if (i === lines - 1) return '60%';
      return `${Math.floor(70 + Math.random() * 30)}%`;
    });
  }, [lines, lineWidths]);
  
  return (
    <div
      className="skeleton-card"
      style={{
        width,
        height,
        borderRadius: typeof borderRadius === 'number' ? `${borderRadius}px` : borderRadius,
        overflow: 'hidden',
        ...cardStyle,
      }}
      aria-label="Loading card content"
      role="progressbar"
      aria-busy="true"
    >
      {imageTop && (
        <SkeletonLoader
          width="100%"
          height={imageHeight}
          animation={animation}
          aria-label="Loading card image"
          {...rest}
        />
      )}
      
      {header && (
        <div className="skeleton-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <SkeletonLoader
            width="60%"
            height="1.5em"
            animation={animation}
            aria-label="Loading card title"
            {...rest}
          />
          {actionButtons > 0 && (
            <div style={{ display: 'flex', gap: '8px' }}>
              {Array(actionButtons).fill(0).map((_, i) => (
                <SkeletonLoader
                  key={`header-action-${i}`}
                  width="24px"
                  height="24px"
                  borderRadius="50%"
                  animation={animation}
                  aria-label={`Loading action button ${i + 1}`}
                  {...rest}
                />
              ))}
            </div>
          )}
        </div>
      )}
      
      <div className="skeleton-card-content" style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
        {Array(lines).fill(0).map((_, i) => (
          <SkeletonLoader
            key={`line-${i}`}
            width={calculatedLineWidths[i]}
            height={lineHeight}
            animation={animation}
            aria-label={`Loading text line ${i + 1}`}
            {...rest}
          />
        ))}
      </div>
      
      {footer && (
        <div className="skeleton-card-footer" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
          <SkeletonLoader
            width="40%"
            height="1em"
            animation={animation}
            aria-label="Loading card footer"
            {...rest}
          />
          {actionButtons > 0 && (
            <div style={{ display: 'flex', gap: '8px' }}>
              {Array(actionButtons).fill(0).map((_, i) => (
                <SkeletonLoader
                  key={`footer-action-${i}`}
                  width="80px"
                  height="32px"
                  animation={animation}
                  aria-label={`Loading action button ${i + 1}`}
                  {...rest}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// List Skeleton
export const SkeletonList: React.FC<SkeletonListProps> = ({
  width = '100%',
  height = 'auto',
  borderRadius = '4px',
  animation = 'wave',
  items = 5,
  itemHeight = '60px',
  itemGap = '8px',
  avatar = false,
  avatarSize = '40px',
  lines = 2,
  lineHeight = '0.9em',
  lineWidths = [],
  actions = false,
  ...rest
}) => {
  const theme = useTheme();
  
  // Generate random widths for lines if not provided
  const calculatedLineWidths = useMemo(() => {
    if (lineWidths.length === lines) return lineWidths;
    return Array(lines).fill(0).map((_, i) => {
      if (lineWidths[i]) return lineWidths[i];
      // First line is typically longer (title)
      if (i === 0) return '70%';
      return `${Math.floor(30 + Math.random() * 40)}%`;
    });
  }, [lines, lineWidths]);
  
  return (
    <div
      className="skeleton-list"
      style={{
        width,
        height,
        display: 'flex',
        flexDirection: 'column',
        gap: itemGap,
      }}
      aria-label="Loading list content"
      role="progressbar"
      aria-busy="true"
    >
      {Array(items).fill(0).map((_, i) => (
        <div
          key={`item-${i}`}
          className="skeleton-list-item"
          style={{
            display: 'flex',
            padding: '12px',
            borderRadius,
            height: itemHeight,
            backgroundColor: theme.colors.cardBackground || theme.colors.background || '#fff',
            boxShadow: theme.shadows?.card || '0 1px 3px rgba(0, 0, 0, 0.1)',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          {avatar && (
            <SkeletonLoader
              width={avatarSize}
              height={avatarSize}
              borderRadius="50%"
              animation={animation}
              aria-label={`Loading avatar for item ${i + 1}`}
              {...rest}
            />
          )}
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
            {Array(lines).fill(0).map((_, j) => (
              <SkeletonLoader
                key={`item-${i}-line-${j}`}
                width={calculatedLineWidths[j]}
                height={lineHeight}
                animation={animation}
                aria-label={`Loading text line ${j + 1} for item ${i + 1}`}
                {...rest}
              />
            ))}
          </div>
          
          {actions && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <SkeletonLoader
                width="24px"
                height="24px"
                borderRadius="4px"
                animation={animation}
                aria-label={`Loading action for item ${i + 1}`}
                {...rest}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

// Table Skeleton
export const SkeletonTable: React.FC<SkeletonTableProps> = ({
  width = '100%',
  height = 'auto',
  borderRadius = '4px',
  animation = 'wave',
  rows = 5,
  columns = 4,
  headerHeight = '48px',
  rowHeight = '52px',
  cellWidths = [],
  showHeader = true,
  showFooter = false,
  showPagination = true,
  ...rest
}) => {
  const theme = useTheme();
  
  // Calculate cell widths if not provided
  const calculatedCellWidths = useMemo(() => {
    if (cellWidths.length === columns) return cellWidths;
    
    // Default distribution: first column wider (often contains name/title)
    return Array(columns).fill(0).map((_, i) => {
      if (cellWidths[i]) return cellWidths[i];
      if (i === 0) return '25%';
      return `${Math.floor(100 / (columns + (columns > 3 ? 1 : 0)))}%`;
    });
  }, [columns, cellWidths]);
  
  return (
    <div
      className="skeleton-table"
      style={{
        width,
        height,
        display: 'flex',
        flexDirection: 'column',
        borderRadius,
        overflow: 'hidden',
        border: `1px solid ${theme.colors.border || '#e0e0e0'}`,
      }}
      aria-label="Loading table content"
      role="progressbar"
      aria-busy="true"
    >
      {showHeader && (
        <div
          className="skeleton-table-header"
          style={{
            display: 'flex',
            height: headerHeight,
            backgroundColor: theme.colors.tableHeader || theme.colors.backgroundAlt || '#f5f5f5',
            borderBottom: `1px solid ${theme.colors.border || '#e0e0e0'}`,
          }}
        >
          {calculatedCellWidths.map((width, i) => (
            <div
              key={`header-cell-${i}`}
              style={{
                width,
                padding: '0 16px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <SkeletonLoader
                width="80%"
                height="1.2em"
                animation={animation}
                aria-label={`Loading table header ${i + 1}`}
                {...rest}
              />
            </div>
          ))}
        </div>
      )}
      
      <div className="skeleton-table-body">
        {Array(rows).fill(0).map((_, rowIndex) => (
          <div
            key={`row-${rowIndex}`}
            className="skeleton-table-row"
            style={{
              display: 'flex',
              height: rowHeight,
              borderBottom: `1px solid ${theme.colors.border || '#e0e0e0'}`,
              backgroundColor: rowIndex % 2 === 1 
                ? theme.colors.tableRowAlt || theme.colors.backgroundAlt || '#f9f9f9'
                : theme.colors.tableRow || theme.colors.background || '#fff',
            }}
          >
            {calculatedCellWidths.map((width, colIndex) => (
              <div
                key={`cell-${rowIndex}-${colIndex}`}
                style={{
                  width,
                  padding: '0 16px',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <SkeletonLoader
                  width={colIndex === 0 ? '70%' : '60%'}
                  height="1em"
                  animation={animation}
                  aria-label={`Loading cell content row ${rowIndex + 1}, column ${colIndex + 1}`}
                  {...rest}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
      
      {showFooter && (
        <div
          className="skeleton-table-footer"
          style={{
            display: 'flex',
            height: headerHeight,
            backgroundColor: theme.colors.tableHeader || theme.colors.backgroundAlt || '#f5f5f5',
            borderTop: `1px solid ${theme.colors.border || '#e0e0e0'}`,
          }}
        >
          {calculatedCellWidths.map((width, i) => (
            <div
              key={`footer-cell-${i}`}
              style={{
                width,
                padding: '0 16px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <SkeletonLoader
                width="60%"
                height="1em"
                animation={animation}
                aria-label={`Loading table footer ${i + 1}`}
                {...rest}
              />
            </div>
          ))}
        </div>
      )}
      
      {showPagination && (
        <div
          className="skeleton-table-pagination"
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            padding: '12px 16px',
            gap: '8px',
            borderTop: `1px solid ${theme.colors.border || '#e0e0e0'}`,
            backgroundColor: theme.colors.background || '#fff',
          }}
        >
          <SkeletonLoader
            width="100px"
            height="1em"
            animation={animation}
            aria-label="Loading pagination text"
            {...rest}
          />
          <div style={{ display: 'flex', gap: '4px' }}>
            {Array(4).fill(0).map((_, i) => (
              <SkeletonLoader
                key={`pagination-${i}`}
                width="32px"
                height="32px"
                borderRadius="4px"
                animation={animation}
                aria-label={`Loading pagination button ${i + 1}`}
                {...rest}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Form Skeleton
export const SkeletonForm: React.FC<SkeletonFormProps> = ({
  width = '100%',
  height = 'auto',
  borderRadius = '4px',
  animation = 'wave',
  rows = 4,
  rowGap = '20px',
  labelWidth = '120px',
  inputHeight = '40px',
  showButtons = true,
  buttonWidth = '120px',
  buttonHeight = '40px',
  fieldTypes = [],
  ...rest
}) => {
  const theme = useTheme();
  
  // Determine field types if not provided
  const calculatedFieldTypes = useMemo(() => {
    if (fieldTypes.length === rows) return fieldTypes;
    
    // Default distribution with common field types
    const defaultTypes: ('text' | 'select' | 'checkbox' | 'radio' | 'textarea')[] = [
      'text', 'text', 'select', 'text', 'textarea', 'checkbox', 'radio'
    ];
    
    return Array(rows).fill(0).map((_, i) => {
      if (fieldTypes[i]) return fieldTypes[i];
      return defaultTypes[i % defaultTypes.length];
    });
  }, [rows, fieldTypes]);
  
  return (
    <div
      className="skeleton-form"
      style={{
        width,
        height,
        display: 'flex',
        flexDirection: 'column',
        gap: rowGap,
      }}
      aria-label="Loading form content"
      role="progressbar"
      aria-busy="true"
    >
      {Array(rows).fill(0).map((_, i) => {
        const fieldType = calculatedFieldTypes[i];
        
        // Special rendering for checkbox and radio
        if (fieldType === 'checkbox' || fieldType === 'radio') {
          return (
            <div
              key={`form-row-${i}`}
              className="skeleton-form-row"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <SkeletonLoader
                width="20px"
                height="20px"
                borderRadius={fieldType === 'checkbox' ? '4px' : '50%'}
                animation={animation}
                aria-label={`Loading ${fieldType} input`}
                {...rest}
              />
              <SkeletonLoader
                width="200px"
                height="1em"
                animation={animation}
                aria-label={`Loading ${fieldType} label`}
                {...rest}
              />
            </div>
          );
        }
        
        // Special rendering for textarea
        if (fieldType === 'textarea') {
          return (
            <div
              key={`form-row-${i}`}
              className="skeleton-form-row"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <SkeletonLoader
                width={labelWidth}
                height="1em"
                animation={animation}
                aria-label="Loading textarea label"
                {...rest}
              />
              <SkeletonLoader
                width="100%"
                height="100px"
                animation={animation}
                aria-label="Loading textarea input"
                {...rest}
              />
            </div>
          );
        }
        
        // Default rendering for text and select
        return (
          <div
            key={`form-row-${i}`}
            className="skeleton-form-row"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <SkeletonLoader
              width={labelWidth}
              height="1em"
              animation={animation}
              aria-label={`Loading ${fieldType} label`}
              {...rest}
            />
            <SkeletonLoader
              width="100%"
              height={inputHeight}
              animation={animation}
              aria-label={`Loading ${fieldType} input`}
              {...rest}
            />
          </div>
        );
      })}
      
      {showButtons && (
        <div
          className="skeleton-form-buttons"
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
            marginTop: '12px',
          }}
        >
          <SkeletonLoader
            width={buttonWidth}
            height={buttonHeight}
            animation={animation}
            aria-label="Loading cancel button"
            {...rest}
          />
          <SkeletonLoader
            width={buttonWidth}
            height={buttonHeight}
            animation={animation}
            aria-label="Loading submit button"
            {...rest}
          />
        </div>
      )}
    </div>
  );
};

// Dashboard Skeleton
export const SkeletonDashboard: React.FC<SkeletonDashboardProps> = ({
  width = '100%',
  height = 'auto',
  borderRadius = '8px',
  animation = 'wave',
  layout = 'grid',
  cards = 4,
  cardWidth = '100%',
  cardHeight = '200px',
  cardGap = '16px',
  showCharts = true,
  showTables = true,
  showStats = true,
  ...rest
}) => {
  const theme = useTheme();
  const { width: windowWidth } = useWindowSize();
  
  // Responsive adjustments
  const isSmallScreen = windowWidth < 768;
  const isMediumScreen = windowWidth >= 768 && windowWidth < 1024;
  
  // Adjust layout based on screen size
  const responsiveLayout = isSmallScreen ? 'flex' : layout;
  const responsiveCardWidth = isSmallScreen 
    ? '100%' 
    : (isMediumScreen && layout === 'grid' ? 'calc(50% - 16px)' : cardWidth);
  
  return (
    <div
      className="skeleton-dashboard"
      style={{
        width,
        height,
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
      }}
      aria-label="Loading dashboard content"
      role="progressbar"
      aria-busy="true"
    >
      {/* Stats Row */}
      {showStats && (
        <div
          className="skeleton-dashboard-stats"
          style={{
            display: 'flex',
            flexDirection: isSmallScreen ? 'column' : 'row',
            gap: '16px',
            width: '100%',
          }}
        >
          {Array(isSmallScreen ? 2 : 4).fill(0).map((_, i) => (
            <div
              key={`stat-${i}`}
              style={{
                flex: isSmallScreen ? 'none' : 1,
                backgroundColor: theme.colors.cardBackground || theme.colors.background || '#fff',
                borderRadius,
                padding: '16px',
                boxShadow: theme.shadows?.card || '0 2px 8px rgba(0, 0, 0, 0.1)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <SkeletonLoader
                width="60%"
                height="1em"
                animation={animation}
                aria-label={`Loading stat title ${i + 1}`}
                {...rest}
              />
              <SkeletonLoader
                width="40%"
                height="2em"
                animation={animation}
                aria-label={`Loading stat value ${i + 1}`}
                {...rest}
              />
              <SkeletonLoader
                width="80%"
                height="0.8em"
                animation={animation}
                aria-label={`Loading stat description ${i + 1}`}
                {...rest}
              />
            </div>
          ))}
        </div>
      )}
      
      {/* Charts Section */}
      {showCharts && (
        <div
          className="skeleton-dashboard-charts"
          style={{
            display: responsiveLayout === 'grid' ? 'grid' : 'flex',
            gridTemplateColumns: responsiveLayout === 'grid' 
              ? `repeat(${isSmallScreen ? 1 : isMediumScreen ? 2 : 3}, 1fr)` 
              : undefined,
            flexDirection: responsiveLayout === 'flex' ? 'column' : undefined,
            gap: cardGap,
            width: '100%',
          }}
        >
          {Array(isSmallScreen ? 2 : isMediumScreen ? 4 : cards).fill(0).map((_, i) => (
            <div
              key={`chart-${i}`}
              style={{
                width: responsiveCardWidth,
                height: cardHeight,
                backgroundColor: theme.colors.cardBackground || theme.colors.background || '#fff',
                borderRadius,
                padding: '16px',
                boxShadow: theme.shadows?.card || '0 2px 8px rgba(0, 0, 0, 0.1)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <SkeletonLoader
                width="70%"
                height="1.2em"
                animation={animation}
                aria-label={`Loading chart title ${i + 1}`}
                {...rest}
              />
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {/* Different chart types */}
                {i % 3 === 0 && (
                  <div style={{ width: '100%', height: '80%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                    <div style={{ display: 'flex', height: '100%', alignItems: 'flex-end', gap: '6px' }}>
                      {Array(8).fill(0).map((_, j) => (
                        <SkeletonLoader
                          key={`bar-${j}`}
                          width={`${100 / 10}%`}
                          height={`${20 + Math.random() * 80}%`}
                          animation={animation}
                          aria-label={`Loading bar chart column ${j + 1}`}
                          {...rest}
                        />
                      ))}
                    </div>
                  </div>
                )}
                {i % 3 === 1 && (
                  <div style={{ width: '100%', height: '80%', position: 'relative' }}>
                    <SkeletonLoader
                      width="100%"
                      height="100%"
                      borderRadius="50%"
                      animation={animation}
                      aria-label="Loading pie chart"
                      {...rest}
                    />
                    <div 
                      style={{ 
                        position: 'absolute', 
                        top: '50%', 
                        left: '50%', 
                        transform: 'translate(-50%, -50%)',
                        width: '40%',
                        height: '40%',
                        borderRadius: '50%',
                        backgroundColor: theme.colors.cardBackground || theme.colors.background || '#fff',
                      }} 
                    />
                  </div>
                )}
                {i % 3 === 2 && (
                  <div style={{ width: '100%', height: '80%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <svg width="100%" height="100%" viewBox="0 0 100 50">
                      <path 
                        d="M0,25 Q10,10 20,20 T40,15 T60,30 T80,5 T100,25" 
                        fill="none" 
                        stroke={theme.colors.border || '#e0e0e0'} 
                        strokeWidth="2"
                      />
                    </svg>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <SkeletonLoader
                  width="30%"
                  height="0.8em"
                  animation={animation}
                  aria-label={`Loading chart legend ${i + 1}`}
                  {...rest}
                />
                <div style={{ display: 'flex', gap: '8px' }}>
                  {Array(3).fill(0).map((_, j) => (
                    <SkeletonLoader
                      key={`legend-item-${j}`}
                      width="16px"
                      height="16px"
                      borderRadius="4px"
                      animation={animation}
                      aria-label={`Loading legend item ${j + 1}`}
                      {...rest}
                    />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Table Section */}
      {showTables && (
        <div
          className="skeleton-dashboard-table"
          style={{
            width: '100%',
            backgroundColor: theme.colors.cardBackground || theme.colors.background || '#fff',
            borderRadius,
            padding: '16px',
            boxShadow: theme.shadows?.card || '0 2px 8px rgba(0, 0, 0, 0.1)',
          }}
        >
          <div style={{ marginBottom: '16px' }}>
            <SkeletonLoader
              width="200px"
              height="1.5em"
              animation={animation}
              aria-label="Loading table title"
              {...rest}
            />
          </div>
          <SkeletonTable
            rows={isSmallScreen ? 3 : 5}
            columns={isSmallScreen ? 3 : 5}
            animation={animation}
            showPagination={!isSmallScreen}
            {...rest}
          />
        </div>
      )}
    </div>
  );
};

// Conversation Skeleton
export const SkeletonConversation: React.FC<SkeletonConversationProps> = ({
  width = '100%',
  height = 'auto',
  borderRadius = '8px',
  animation = 'wave',
  messages = 4,
  messageGap = '16px',
  alternating = true,
  avatars = true,
  avatarSize = '40px',
  inputBar = true,
  timestamps = true,
  bubbleStyle = true,
  ...rest
}) => {
  const theme = useTheme();
  
  return (
    <div
      className="skeleton-conversation"
      style={{
        width,
        height,
        display: 'flex',
        flexDirection: 'column',
        gap: messageGap,
      }}
      aria-label="Loading conversation content"
      role="progressbar"
      aria-busy="true"
    >
      <div className="skeleton-conversation-messages" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: messageGap }}>
        {Array(messages).fill(0).map((_, i) => {
          const isUser = alternating ? i % 2 === 0 : false;
          const messageWidth = `${40 + Math.floor(Math.random() * 40)}%`;
          
          return (
            <div
              key={`message-${i}`}
              className="skeleton-conversation-message"
              style={{
                display: 'flex',
                flexDirection: isUser ? 'row-reverse' : 'row',
                gap: '12px',
                alignItems: 'flex-start',
              }}
            >
              {avatars && (
                <SkeletonLoader
                  width={avatarSize}
                  height={avatarSize}
                  borderRadius="50%"
                  animation={animation}
                  aria-label={`Loading ${isUser ? 'user' : 'assistant'} avatar`}
                  {...rest}
                />
              )}
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '70%' }}>
                {bubbleStyle ? (
                  <div
                    style={{
                      backgroundColor: isUser 
                        ? theme.colors.userMessage || theme.colors.primary + '33' || '#e3f2fd'
                        : theme.colors.assistantMessage || theme.colors.backgroundAlt || '#f5f5f5',
                      borderRadius: '12px',
                      padding: '12px 16px',
                      position: 'relative',
                    }}
                  >
                    <SkeletonLoader
                      width={messageWidth}
                      height="1em"
                      animation={animation}
                      backgroundColor="transparent"
                      aria-label={`Loading message content line 1`}
                      {...rest}
                    />
                    {i % 2 === 0 && (
                      <SkeletonLoader
                        width={`${parseInt(messageWidth) * 0.8}%`}
                        height="1em"
                        animation={animation}
                        backgroundColor="transparent"
                        style={{ marginTop: '8px' }}
                        aria-label={`Loading message content line 2`}
                        {...rest}
                      />
                    )}
                  </div>
                ) : (
                  <div>
                    <SkeletonLoader
                      width={messageWidth}
                      height="1em"
                      animation={animation}
                      aria-label={`Loading message content line 1`}
                      {...rest}
                    />
                    {i % 2 === 0 && (
                      <SkeletonLoader
                        width={`${parseInt(messageWidth) * 0.8}%`}
                        height="1em"
                        animation={animation}
                        style={{ marginTop: '8px' }}
                        aria-label={`Loading message content line 2`}
                        {...rest}
                      />
                    )}
                  </div>
                )}
                
                {timestamps && (
                  <SkeletonLoader
                    width="80px"
                    height="0.8em"
                    animation={animation}
                    style={{ 
                      alignSelf: isUser ? 'flex-end' : 'flex-start',
                      marginTop: '4px',
                    }}
                    aria-label={`Loading message timestamp`}
                    {...rest}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      {inputBar && (
        <div
          className="skeleton-conversation-input"
          style={{
            display: 'flex',
            gap: '12px',
            padding: '16px',
            borderTop: `1px solid ${theme.colors.border || '#e0e0e0'}`,
            backgroundColor: theme.colors.background || '#fff',
            marginTop: '16px',
            alignItems: 'center',
          }}
        >
          <SkeletonLoader
            width="calc(100% - 100px)"
            height="40px"
            borderRadius="20px"
            animation={animation}
            aria-label="Loading message input"
            {...rest}
          />
          <SkeletonLoader
            width="40px"
            height="40px"
            borderRadius="50%"
            animation={animation}
            aria-label="Loading send button"
            {...rest}
          />
          <SkeletonLoader
            width="40px"
            height="40px"
            borderRadius="50%"
            animation={animation}
            aria-label="Loading attachment button"
            {...rest}
          />
        </div>
      )}
    </div>
  );
};

// Analytics Skeleton
export const SkeletonAnalytics: React.FC<SkeletonAnalyticsProps> = ({
  width = '100%',
  height = 'auto',
  borderRadius = '8px',
  animation = 'wave',
  charts = 3,
  chartTypes = ['bar', 'line', 'pie', 'area'],
  chartHeight = '300px',
  showLegend = true,
  showAxis = true,
  showGrid = true,
  showTooltip = false,
  dataPoints = 8,
  ...rest
}) => {
  const theme = useTheme();
  const { width: windowWidth } = useWindowSize();
  
  // Responsive adjustments
  const isSmallScreen = windowWidth < 768;
  const isMediumScreen = windowWidth >= 768 && windowWidth < 1024;
  
  // Adjust layout based on screen size
  const responsiveCharts = isSmallScreen ? Math.min(2, charts) : charts;
  
  return (
    <div
      className="skeleton-analytics"
      style={{
        width,
        height,
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
      }}
      aria-label="Loading analytics content"
      role="progressbar"
      aria-busy="true"
    >
      {/* Filters and Controls */}
      <div
        className="skeleton-analytics-controls"
        style={{
          display: 'flex',
          flexDirection: isSmallScreen ? 'column' : 'row',
          justifyContent: 'space-between',
          alignItems: isSmallScreen ? 'stretch' : 'center',
          gap: '16px',
          padding: '16px',
          backgroundColor: theme.colors.cardBackground || theme.colors.background || '#fff',
          borderRadius,
          boxShadow: theme.shadows?.card || '0 2px 8px rgba(0, 0, 0, 0.1)',
        }}
      >
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <SkeletonLoader
            width="120px"
            height="32px"
            animation={animation}
            aria-label="Loading date range selector"
            {...rest}
          />
          <SkeletonLoader
            width="100px"
            height="32px"
            animation={animation}
            aria-label="Loading filter dropdown"
            {...rest}
          />
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {Array(isSmallScreen ? 2 : 3).fill(0).map((_, i) => (
            <SkeletonLoader
              key={`control-${i}`}
              width="32px"
              height="32px"
              borderRadius="4px"
              animation={animation}
              aria-label={`Loading control button ${i + 1}`}
              {...rest}
            />
          ))}
        </div>
      </div>
      
      {/* Key Metrics */}
      <div
        className="skeleton-analytics-metrics"
        style={{
          display: 'grid',
          gridTemplateColumns: isSmallScreen 
            ? '1fr' 
            : isMediumScreen 
              ? 'repeat(2, 1fr)' 
              : 'repeat(4, 1fr)',
          gap: '16px',
        }}
      >
        {Array(isSmallScreen ? 2 : 4).fill(0).map((_, i) => (
          <div
            key={`metric-${i}`}
            style={{
              backgroundColor: theme.colors.cardBackground || theme.colors.background || '#fff',
              borderRadius,
              padding: '16px',
              boxShadow: theme.shadows?.card || '0 2px 8px rgba(0, 0, 0, 0.1)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <SkeletonLoader
              width="60%"
              height="1em"
              animation={animation}
              aria-label={`Loading metric title ${i + 1}`}
              {...rest}
            />
            <SkeletonLoader
              width="40%"
              height="2em"
              animation={animation}
              aria-label={`Loading metric value ${i + 1}`}
              {...rest}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <SkeletonLoader
                width="16px"
                height="16px"
                animation={animation}
                aria-label={`Loading trend indicator ${i + 1}`}
                {...rest}
              />
              <SkeletonLoader
                width="30%"
                height="0.8em"
                animation={animation}
                aria-label={`Loading trend value ${i + 1}`}
                {...rest}
              />
            </div>
          </div>
        ))}
      </div>
      
      {/* Charts */}
      <div
        className="skeleton-analytics-charts"
        style={{
          display: 'grid',
          gridTemplateColumns: isSmallScreen 
            ? '1fr' 
            : isMediumScreen 
              ? 'repeat(2, 1fr)' 
              : 'repeat(auto-fit, minmax(400px, 1fr))',
          gap: '24px',
        }}
      >
        {Array(responsiveCharts).fill(0).map((_, i) => {
          const chartType = chartTypes[i % chartTypes.length];
          
          return (
            <div
              key={`chart-${i}`}
              style={{
                backgroundColor: theme.colors.cardBackground || theme.colors.background || '#fff',
                borderRadius,
                padding: '16px',
                boxShadow: theme.shadows?.card || '0 2px 8px rgba(0, 0, 0, 0.1)',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <SkeletonLoader
                  width="40%"
                  height="1.2em"
                  animation={animation}
                  aria-label={`Loading chart title ${i + 1}`}
                  {...rest}
                />
                <div style={{ display: 'flex', gap: '8px' }}>
                  {Array(3).fill(0).map((_, j) => (
                    <SkeletonLoader
                      key={`chart-control-${j}`}
                      width="24px"
                      height="24px"
                      borderRadius="4px"
                      animation={animation}
                      aria-label={`Loading chart control ${j + 1}`}
                      {...rest}
                    />
                  ))}
                </div>
              </div>
              
              <div style={{ height: chartHeight, position: 'relative' }}>
                {/* Different chart types */}
                {chartType === 'bar' && (
                  <div style={{ display: 'flex', height: '100%', alignItems: 'flex-end', gap: '6px', paddingBottom: showAxis ? '24px' : '0' }}>
                    {Array(dataPoints).fill(0).map((_, j) => (
                      <div
                        key={`bar-${j}`}
                        style={{
                          flex: 1,
                          display: 'flex',
                          flexDirection: 'column',
                          height: '100%',
                          justifyContent: 'flex-end',
                        }}
                      >
                        <SkeletonLoader
                          width="100%"
                          height={`${20 + Math.random() * 80}%`}
                          animation={animation}
                          aria-label={`Loading bar chart column ${j + 1}`}
                          {...rest}
                        />
                        {showAxis && (
                          <SkeletonLoader
                            width="80%"
                            height="0.8em"
                            animation={animation}
                            style={{ marginTop: '8px', alignSelf: 'center' }}
                            aria-label={`Loading x-axis label ${j + 1}`}
                            {...rest}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
                
                {chartType === 'line' && (
                  <div style={{ height: '100%', position: 'relative', paddingBottom: showAxis ? '24px' : '0' }}>
                    {showGrid && (
                      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: showAxis ? '24px' : 0, display: 'flex', flexDirection: 'column' }}>
                        {Array(5).fill(0).map((_, j) => (
                          <div
                            key={`grid-line-${j}`}
                            style={{
                              borderBottom: j < 4 ? `1px dashed ${theme.colors.border || '#e0e0e0'}` : 'none',
                              flex: 1,
                            }}
                          />
                        ))}
                      </div>
                    )}
                    
                    <svg width="100%" height={showAxis ? 'calc(100% - 24px)' : '100%'} viewBox="0 0 100 50" preserveAspectRatio="none">
                      <path 
                        d="M0,35 Q10,20 20,25 T40,15 T60,30 T80,5 T100,20" 
                        fill="none" 
                        stroke={theme.colors.border || '#e0e0e0'} 
                        strokeWidth="2"
                      />
                      {showTooltip && (
                        <circle 
                          cx="60" 
                          cy="30" 
                          r="3" 
                          fill={theme.colors.primary || '#2196f3'} 
                        />
                      )}
                    </svg>
                    
                    {showAxis && (
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '24px', display: 'flex', justifyContent: 'space-between' }}>
                        {Array(6).fill(0).map((_, j) => (
                          <SkeletonLoader
                            key={`x-axis-${j}`}
                            width="30px"
                            height="0.8em"
                            animation={animation}
                            aria-label={`Loading x-axis label ${j + 1}`}
                            {...rest}
                          />
                        ))}
                      </div>
                    )}
                    
                    {showTooltip && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '30%',
                          left: '60%',
                          transform: 'translate(-50%, -100%)',
                          backgroundColor: theme.colors.tooltipBackground || theme.colors.background || '#fff',
                          boxShadow: theme.shadows?.tooltip || '0 2px 10px rgba(0, 0, 0, 0.2)',
                          borderRadius: '4px',
                          padding: '8px 12px',
                          zIndex: 1,
                        }}
                      >
                        <SkeletonLoader
                          width="80px"
                          height="0.9em"
                          animation={animation}
                          aria-label="Loading tooltip value"
                          {...rest}
                        />
                      </div>
                    )}
                  </div>
                )}
                
                {chartType === 'pie' && (
                  <div style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <div style={{ width: '70%', height: '70%', position: 'relative' }}>
                      <SkeletonLoader
                        width="100%"
                        height="100%"
                        borderRadius="50%"
                        animation={animation}
                        aria-label="Loading pie chart"
                        {...rest}
                      />
                      <div 
                        style={{ 
                          position: 'absolute', 
                          top: '50%', 
                          left: '50%', 
                          transform: 'translate(-50%, -50%)',
                          width: '40%',
                          height: '40%',
                          borderRadius: '50%',
                          backgroundColor: theme.colors.cardBackground || theme.colors.background || '#fff',
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center',
                          flexDirection: 'column',
                          gap: '4px',
                        }} 
                      >
                        <SkeletonLoader
                          width="60%"
                          height="1em"
                          animation={animation}
                          aria-label="Loading pie chart center value"
                          {...rest}
                        />
                        <SkeletonLoader
                          width="40%"
                          height="0.8em"
                          animation={animation}
                          aria-label="Loading pie chart center label"
                          {...rest}
                        />
                      </div>
                    </div>
                  </div>
                )}
                
                {chartType === 'area' && (
                  <div style={{ height: '100%', position: 'relative', paddingBottom: showAxis ? '24px' : '0' }}>
                    {showGrid && (
                      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: showAxis ? '24px' : 0, display: 'flex', flexDirection: 'column' }}>
                        {Array(5).fill(0).map((_, j) => (
                          <div
                            key={`grid-line-${j}`}
                            style={{
                              borderBottom: j < 4 ? `1px dashed ${theme.colors.border || '#e0e0e0'}` : 'none',
                              flex: 1,
                            }}
                          />
                        ))}
                      </div>
                    )}
                    
                    <svg width="100%" height={showAxis ? 'calc(100% - 24px)' : '100%'} viewBox="0 0 100 50" preserveAspectRatio="none">
                      <path 
                        d="M0,35 Q10,20 20,25 T40,15 T60,30 T80,5 T100,20 V50 H0 Z" 
                        fill={`${theme.colors.primary || '#2196f3'}20`}
                        stroke="none"
                      />
                      <path 
                        d="M0,35 Q10,20 20,25 T40,15 T60,30 T80,5 T100,20" 
                        fill="none" 
                        stroke={theme.colors.primary || '#2196f3'} 
                        strokeWidth="2"
                      />
                    </svg>
                    
                    {showAxis && (
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '24px', display: 'flex', justifyContent: 'space-between' }}>
                        {Array(6).fill(0).map((_, j) => (
                          <SkeletonLoader
                            key={`x-axis-${j}`}
                            width="30px"
                            height="0.8em"
                            animation={animation}
                            aria-label={`Loading x-axis label ${j + 1}`}
                            {...rest}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {showLegend && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '8px' }}>
                  {Array(4).fill(0).map((_, j) => (
                    <div key={`legend-${j}`} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <SkeletonLoader
                        width="16px"
                        height="16px"
                        borderRadius="4px"
                        animation={animation}
                        aria-label={`Loading legend color ${j + 1}`}
                        {...rest}
                      />
                      <SkeletonLoader
                        width="60px"
                        height="0.8em"
                        animation={animation}
                        aria-label={`Loading legend label ${j + 1}`}
                        {...rest}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Data Table */}
      <div
        className="skeleton-analytics-table"
        style={{
          backgroundColor: theme.colors.cardBackground || theme.colors.background || '#fff',
          borderRadius,
          padding: '16px',
          boxShadow: theme.shadows?.card || '0 2px 8px rgba(0, 0, 0, 0.1)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <SkeletonLoader
            width="200px"
            height="1.2em"
            animation={animation}
            aria-label="Loading data table title"
            {...rest}
          />
          <SkeletonLoader
            width="120px"
            height="32px"
            animation={animation}
            aria-label="Loading export button"
            {...rest}
          />
        </div>
        
        <SkeletonTable
          rows={isSmallScreen ? 3 : 5}
          columns={isSmallScreen ? 3 : 6}
          animation={animation}
          {...rest}
        />
      </div>
    </div>
  );
};

// Export all components
export default {
  SkeletonLoader,
  SkeletonCard,
  SkeletonList,
  SkeletonTable,
  SkeletonForm,
  SkeletonDashboard,
  SkeletonConversation,
  SkeletonAnalytics,
};
