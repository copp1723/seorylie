import React, { useEffect } from 'react';

export function EmergencyCSSFix() {
  useEffect(() => {
    // Inject emergency CSS to make content visible
    const style = document.createElement('style');
    style.id = 'emergency-css-fix';
    style.textContent = `
      /* Emergency CSS Fix - Force Visibility */
      
      /* Reset everything to be visible */
      * {
        color: #000 !important;
        background-color: transparent !important;
      }
      
      /* Set proper body background */
      body {
        background-color: #f5f5f5 !important;
        color: #000 !important;
        font-family: Arial, sans-serif !important;
      }
      
      /* Make sure root container is visible */
      #root {
        background-color: #f5f5f5 !important;
        color: #000 !important;
        min-height: 100vh !important;
        padding: 20px !important;
      }
      
      /* Force show all main content */
      [class*="layout"],
      [class*="dashboard"],
      [class*="container"],
      main,
      section,
      article,
      div {
        background-color: #fff !important;
        color: #000 !important;
        border: 1px solid #ddd !important;
        margin: 2px !important;
        padding: 8px !important;
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
      }
      
      /* Style buttons to be visible and clickable */
      button {
        background-color: #007acc !important;
        color: #fff !important;
        border: 1px solid #005a9e !important;
        padding: 8px 16px !important;
        border-radius: 4px !important;
        cursor: pointer !important;
        display: inline-block !important;
        margin: 4px !important;
      }
      
      button:hover {
        background-color: #005a9e !important;
      }
      
      /* Style links */
      a {
        color: #007acc !important;
        text-decoration: underline !important;
      }
      
      /* Style headings */
      h1, h2, h3, h4, h5, h6 {
        color: #333 !important;
        font-weight: bold !important;
        margin: 10px 0 !important;
      }
      
      h1 { font-size: 24px !important; }
      h2 { font-size: 20px !important; }
      h3 { font-size: 18px !important; }
      
      /* Style inputs */
      input, textarea, select {
        background-color: #fff !important;
        color: #000 !important;
        border: 1px solid #ccc !important;
        padding: 8px !important;
        border-radius: 4px !important;
      }
      
      /* Style cards/panels */
      [class*="card"],
      [class*="panel"] {
        background-color: #fff !important;
        border: 1px solid #ddd !important;
        border-radius: 8px !important;
        padding: 16px !important;
        margin: 8px !important;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1) !important;
      }
      
      /* Keep debug panels visible */
      .debug-panel {
        background-color: #000 !important;
        color: #fff !important;
        border: 2px solid #333 !important;
        position: fixed !important;
        z-index: 99999 !important;
      }
      
      /* Navigation styles */
      nav, [class*="nav"] {
        background-color: #333 !important;
        color: #fff !important;
        padding: 10px !important;
      }
      
      nav a, [class*="nav"] a {
        color: #fff !important;
        padding: 8px 12px !important;
        text-decoration: none !important;
      }
      
      nav a:hover, [class*="nav"] a:hover {
        background-color: #555 !important;
      }
      
      /* Table styles */
      table {
        border-collapse: collapse !important;
        width: 100% !important;
        background-color: #fff !important;
      }
      
      th, td {
        border: 1px solid #ddd !important;
        padding: 8px !important;
        text-align: left !important;
      }
      
      th {
        background-color: #f5f5f5 !important;
        font-weight: bold !important;
      }
      
      /* Form styles */
      form {
        background-color: #fff !important;
        padding: 20px !important;
        border: 1px solid #ddd !important;
        border-radius: 8px !important;
      }
      
      /* Status indicators */
      [class*="status"] {
        padding: 4px 8px !important;
        border-radius: 4px !important;
        font-size: 12px !important;
        font-weight: bold !important;
      }
      
      /* Override any hidden elements */
      [style*="display: none"],
      [style*="visibility: hidden"],
      [style*="opacity: 0"] {
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
      }
    `;
    
    document.head.appendChild(style);
    
    console.log('🚨 Emergency CSS Fix Applied - Content should now be visible');
    
    // Remove after 30 seconds to allow normal styling to take over
    setTimeout(() => {
      const existingStyle = document.getElementById('emergency-css-fix');
      if (existingStyle) {
        console.log('🔧 Removing emergency CSS fix');
        existingStyle.remove();
      }
    }, 30000);
    
    return () => {
      const existingStyle = document.getElementById('emergency-css-fix');
      if (existingStyle) {
        existingStyle.remove();
      }
    };
  }, []);

  return null; // This component doesn't render anything
}

export default EmergencyCSSFix;
