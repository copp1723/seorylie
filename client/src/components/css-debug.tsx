import React, { useState, useEffect } from 'react';

export function CSSDebug() {
  const [elementCount, setElementCount] = useState(0);
  const [hiddenElements, setHiddenElements] = useState(0);
  const [cssLoaded, setCssLoaded] = useState(false);

  useEffect(() => {
    // Check if CSS is loaded
    const checkCSS = () => {
      const testElement = document.createElement('div');
      testElement.className = 'test-css-loaded';
      testElement.style.position = 'absolute';
      testElement.style.left = '-9999px';
      document.body.appendChild(testElement);
      
      const computed = window.getComputedStyle(testElement);
      setCssLoaded(computed.position === 'absolute');
      document.body.removeChild(testElement);
    };

    // Count DOM elements
    const countElements = () => {
      const allElements = document.querySelectorAll('*');
      setElementCount(allElements.length);
      
      let hidden = 0;
      allElements.forEach(el => {
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || 
            style.visibility === 'hidden' || 
            style.opacity === '0' ||
            parseInt(style.width) === 0 ||
            parseInt(style.height) === 0) {
          hidden++;
        }
      });
      setHiddenElements(hidden);
    };

    checkCSS();
    countElements();
    
    const interval = setInterval(countElements, 2000);
    return () => clearInterval(interval);
  }, []);

  const highlightElements = () => {
    // Add colorful borders to all elements to see layout
    const style = document.createElement('style');
    style.textContent = `
      * { 
        border: 1px solid red !important; 
        background: rgba(255,0,0,0.1) !important;
        color: black !important;
      }
      .debug-panel { 
        border: 3px solid blue !important; 
        background: black !important;
        color: white !important;
      }
    `;
    document.head.appendChild(style);
    
    setTimeout(() => {
      document.head.removeChild(style);
    }, 5000);
  };

  const showLayout = () => {
    // Force show all elements
    const style = document.createElement('style');
    style.textContent = `
      * { 
        display: block !important; 
        visibility: visible !important;
        opacity: 1 !important;
        position: static !important;
        background: white !important;
        color: black !important;
        border: 1px solid #ccc !important;
        margin: 2px !important;
        padding: 2px !important;
      }
      .debug-panel { 
        position: fixed !important;
        top: 10px !important;
        right: 10px !important;
        background: black !important;
        color: white !important;
        z-index: 99999 !important;
      }
    `;
    document.head.appendChild(style);
  };

  const inspectMainContent = () => {
    const root = document.getElementById('root');
    const layout = root?.querySelector('[class*="layout"]');
    const dashboard = root?.querySelector('[class*="dashboard"]');
    
    console.group('🔍 Main Content Inspection');
    console.log('Root element:', root);
    console.log('Root innerHTML length:', root?.innerHTML.length || 0);
    console.log('Layout element:', layout);
    console.log('Dashboard element:', dashboard);
    
    if (root) {
      const rootStyle = window.getComputedStyle(root);
      console.log('Root styles:', {
        display: rootStyle.display,
        visibility: rootStyle.visibility,
        opacity: rootStyle.opacity,
        width: rootStyle.width,
        height: rootStyle.height,
        background: rootStyle.background,
        color: rootStyle.color
      });
    }
    console.groupEnd();
  };

  return (
    <div 
      className="debug-panel"
      style={{
        position: 'fixed',
        top: '10px',
        left: '10px',
        background: '#000',
        color: '#fff',
        padding: '15px',
        borderRadius: '8px',
        border: '2px solid #333',
        zIndex: 99999,
        fontFamily: 'monospace',
        fontSize: '11px',
        maxWidth: '250px'
      }}
    >
      <h3 style={{ margin: '0 0 10px 0', color: '#ff0' }}>🎨 CSS Debug</h3>
      
      <div style={{ marginBottom: '8px' }}>
        <strong>Elements:</strong> {elementCount}
      </div>
      
      <div style={{ marginBottom: '8px' }}>
        <strong>Hidden:</strong> {hiddenElements}
      </div>
      
      <div style={{ marginBottom: '8px' }}>
        <strong>CSS:</strong> {cssLoaded ? '✅' : '❌'}
      </div>
      
      <div style={{ marginBottom: '10px' }}>
        <button 
          onClick={highlightElements}
          style={{
            background: '#ff6600',
            color: 'white',
            border: 'none',
            padding: '4px 8px',
            borderRadius: '3px',
            cursor: 'pointer',
            fontSize: '10px',
            marginRight: '5px'
          }}
        >
          Highlight (5s)
        </button>
        
        <button 
          onClick={showLayout}
          style={{
            background: '#0066ff',
            color: 'white',
            border: 'none',
            padding: '4px 8px',
            borderRadius: '3px',
            cursor: 'pointer',
            fontSize: '10px',
            marginRight: '5px'
          }}
        >
          Force Show
        </button>
      </div>
      
      <button 
        onClick={inspectMainContent}
        style={{
          background: '#00aa00',
          color: 'white',
          border: 'none',
          padding: '4px 8px',
          borderRadius: '3px',
          cursor: 'pointer',
          fontSize: '10px',
          width: '100%'
        }}
      >
        Inspect Main (Console)
      </button>
    </div>
  );
}

export default CSSDebug;
