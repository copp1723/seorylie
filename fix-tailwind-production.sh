#!/bin/bash
# fix-tailwind-production.sh
# Comprehensive fix for Tailwind CSS in CleanRylie production environment

set -e
echo "🔧 Starting Tailwind CSS Production Fix..."

# Create a backup directory for original files
BACKUP_DIR="tailwind-fix-backup-$(date +%Y%m%d%H%M%S)"
mkdir -p $BACKUP_DIR
echo "📁 Created backup directory: $BACKUP_DIR"

# Function to backup a file before modifying
backup_file() {
  if [ -f "$1" ]; then
    cp "$1" "$BACKUP_DIR/$(basename $1)"
    echo "💾 Backed up $1"
  fi
}

# Function to check if a npm package is installed
is_package_installed() {
  npm list "$1" >/dev/null 2>&1
  return $?
}

# Step 1: Install required dependencies
echo "📦 Checking and installing required dependencies..."
PACKAGES_TO_INSTALL=()

for pkg in tailwindcss postcss autoprefixer @tailwindcss/typography tailwindcss-animate; do
  if ! is_package_installed $pkg; then
    PACKAGES_TO_INSTALL+=($pkg)
  fi
done

if [ ${#PACKAGES_TO_INSTALL[@]} -gt 0 ]; then
  echo "📦 Installing missing packages: ${PACKAGES_TO_INSTALL[*]}"
  npm install -D "${PACKAGES_TO_INSTALL[@]}"
else
  echo "✅ All required packages are already installed"
fi

# Step 2: Create/update PostCSS config in root
echo "🔧 Creating PostCSS config in root directory..."
backup_file "postcss.config.js"
cat > postcss.config.js << 'EOF'
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
EOF
echo "✅ Created postcss.config.js in root directory"

# Step 3: Create/update Tailwind config in root
echo "🔧 Creating Tailwind config in root directory..."
backup_file "tailwind.config.ts"
cat > tailwind.config.ts << 'EOF'
import type { Config } from 'tailwindcss'
import { fontFamily } from 'tailwindcss/defaultTheme'

const config: Config = {
  darkMode: ['class'],
  content: [
    './client/index.html',
    './client/src/**/*.{js,jsx,ts,tsx}',
    // Explicitly include UI components that might be excluded by TypeScript config
    './client/src/components/ui/**/*.{js,jsx,ts,tsx}'
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
          // RylieAI brand color from PDF
          500: '#4F46E5',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', ...fontFamily.sans],
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [
    require('tailwindcss-animate'),
    require('@tailwindcss/typography'),
  ],
}

export default config
EOF
echo "✅ Created tailwind.config.ts in root directory"

# Step 4: Create/update Vite config in build directory
echo "🔧 Updating Vite config for proper CSS processing..."
mkdir -p config/build
backup_file "config/build/vite.config.ts"
cat > config/build/vite.config.ts << 'EOF'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Enhanced Vite config with explicit Tailwind CSS processing
export default defineConfig({
  root: path.resolve(__dirname, '../../client'),
  plugins: [react()],
  css: {
    postcss: {
      plugins: [
        require('tailwindcss')({
          config: path.resolve(__dirname, '../../tailwind.config.ts')
        }),
        require('autoprefixer')(),
      ],
    },
  },
  build: {
    outDir: path.resolve(__dirname, '../../dist/public'),
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, '../../client/index.html'),
    },
    sourcemap: true,
    // Optimize CSS to ensure Tailwind styles are properly included
    cssCodeSplit: true,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false, // Keep console logs for debugging
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../../client/src'),
      '@shared': path.resolve(__dirname, '../../shared'),
      '@components': path.resolve(__dirname, '../../client/src/components'),
      '@hooks': path.resolve(__dirname, '../../client/src/hooks'),
      '@pages': path.resolve(__dirname, '../../client/src/pages'),
      '@utils': path.resolve(__dirname, '../../client/src/utils'),
    },
  },
  // Enable HMR in development
  server: {
    hmr: true,
    watch: {
      usePolling: true,
    },
  },
  // Ensure proper loading of CSS files
  optimizeDeps: {
    include: ['tailwindcss', 'autoprefixer'],
  },
})
EOF
echo "✅ Updated Vite config for proper CSS processing"

# Step 5: Create PostCSS config in build directory
echo "🔧 Creating PostCSS config in build directory..."
backup_file "config/build/postcss.config.js"
cat > config/build/postcss.config.js << 'EOF'
const path = require('path');

module.exports = {
  plugins: {
    tailwindcss: {
      config: path.resolve(__dirname, '../../tailwind.config.ts')
    },
    autoprefixer: {},
  },
}
EOF
echo "✅ Created PostCSS config in build directory"

# Step 6: Create VerifyCSSLoading component if it doesn't exist
echo "🔧 Creating CSS verification component..."
mkdir -p client/src/components
backup_file "client/src/components/VerifyCSSLoading.tsx"
cat > client/src/components/VerifyCSSLoading.tsx << 'EOF'
import { useEffect, useState } from 'react';

export function VerifyCSSLoading() {
  const [cssStatus, setCssStatus] = useState({
    stylesheets: 0,
    tailwindFound: false,
    primaryColor: '',
    testResults: {} as Record<string, boolean>
  });

  useEffect(() => {
    // Count stylesheets
    const styleSheets = document.querySelectorAll('link[rel="stylesheet"], style');
    
    // Test Tailwind classes
    const tests = {
      'bg-primary': false,
      'text-white': false,
      'rounded-lg': false,
      'shadow-md': false,
      'p-4': false,
    };
    
    // Create test elements
    Object.keys(tests).forEach(className => {
      const testEl = document.createElement('div');
      testEl.className = className;
      document.body.appendChild(testEl);
      const computed = window.getComputedStyle(testEl);
      
      // Check if styles are applied
      if (className === 'bg-primary') {
        tests[className] = computed.backgroundColor === 'rgb(79, 70, 229)'; // #4F46E5
      } else if (className === 'text-white') {
        tests[className] = computed.color === 'rgb(255, 255, 255)';
      } else if (className === 'rounded-lg') {
        tests[className] = computed.borderRadius !== '0px';
      } else if (className === 'shadow-md') {
        tests[className] = computed.boxShadow !== 'none';
      } else if (className === 'p-4') {
        tests[className] = computed.padding === '16px';
      }
      
      document.body.removeChild(testEl);
    });
    
    // Get primary color
    const rootStyles = getComputedStyle(document.documentElement);
    const primaryColor = rootStyles.getPropertyValue('--primary') || 'not set';
    
    setCssStatus({
      stylesheets: styleSheets.length,
      tailwindFound: Object.values(tests).some(v => v),
      primaryColor,
      testResults: tests
    });
  }, []);

  return (
    <div className="fixed bottom-4 left-4 bg-black text-white p-4 rounded-lg max-w-sm z-50">
      <h3 className="font-bold mb-2">CSS Status</h3>
      <div className="text-sm space-y-1">
        <div>Stylesheets: {cssStatus.stylesheets}</div>
        <div>Tailwind: {cssStatus.tailwindFound ? '✅' : '❌'}</div>
        <div>Primary Color: {cssStatus.primaryColor}</div>
        <div className="mt-2">
          <div className="font-semibold">Class Tests:</div>
          {Object.entries(cssStatus.testResults).map(([cls, works]) => (
            <div key={cls} className="ml-2">
              {cls}: {works ? '✅' : '❌'}
            </div>
          ))}
        </div>
      </div>
      
      {/* Visual test of actual Tailwind classes */}
      <div className="mt-4 space-y-2">
        <div className="bg-primary text-white p-2 rounded">
          Primary Button Test
        </div>
        <div className="bg-blue-500 text-white p-2 rounded">
          Blue-500 Test
        </div>
      </div>
    </div>
  );
}
EOF
echo "✅ Created CSS verification component"

# Step 7: Ensure EmergencyCSSFix component exists
echo "🔧 Checking for EmergencyCSSFix component..."
if [ ! -f "client/src/components/emergency-css-fix.tsx" ]; then
  echo "🔧 Creating EmergencyCSSFix component..."
  backup_file "client/src/components/emergency-css-fix.tsx"
  cat > client/src/components/emergency-css-fix.tsx << 'EOF'
import { useEffect } from 'react';

export default function EmergencyCSSFix() {
  useEffect(() => {
    console.log('🚨 Emergency CSS Fix Applied');
    
    // Create emergency style element
    const style = document.createElement('style');
    style.id = 'emergency-css-fix';
    style.innerHTML = `
      /* EMERGENCY CSS OVERRIDE - FORCE VISIBILITY */
      
      /* Force all text to be visible */
      * {
        color: #000 !important;
        opacity: 1 !important;
        visibility: visible !important;
      }
      
      /* Ensure body and html are visible */
      html, body, #root {
        background-color: #ffffff !important;
        color: #000000 !important;
        display: block !important;
        opacity: 1 !important;
        visibility: visible !important;
        min-height: 100vh !important;
      }
      
      /* Force all text elements */
      h1, h2, h3, h4, h5, h6, p, span, div, a, button, li, td, th {
        color: #000000 !important;
        opacity: 1 !important;
        visibility: visible !important;
      }
      
      /* Make links blue */
      a {
        color: #0066cc !important;
        text-decoration: underline !important;
      }
      
      /* Force buttons to be visible */
      button, .btn, [role="button"] {
        background-color: #0066cc !important;
        color: #ffffff !important;
        border: 2px solid #0066cc !important;
        padding: 8px 16px !important;
        cursor: pointer !important;
        display: inline-block !important;
        opacity: 1 !important;
        visibility: visible !important;
      }
      
      button:hover {
        background-color: #0052a3 !important;
        border-color: #0052a3 !important;
      }
      
      /* Force inputs to be visible */
      input, textarea, select {
        background-color: #ffffff !important;
        color: #000000 !important;
        border: 1px solid #cccccc !important;
        padding: 8px !important;
        opacity: 1 !important;
        visibility: visible !important;
      }
      
      /* Add borders to all elements for debugging */
      * {
        outline: 1px solid rgba(255, 0, 0, 0.1) !important;
      }
      
      /* Force navigation visibility */
      nav, header, .nav, .header, .navigation {
        background-color: #f0f0f0 !important;
        border-bottom: 2px solid #cccccc !important;
      }
      
      /* Force card/panel visibility */
      .card, .panel, .box {
        background-color: #ffffff !important;
        border: 1px solid #cccccc !important;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1) !important;
      }
      
      /* Debug info */
      body::before {
        content: "🚨 EMERGENCY CSS ACTIVE - Tailwind may not be loading" !important;
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        background: #ff0000 !important;
        color: #ffffff !important;
        padding: 10px !important;
        text-align: center !important;
        font-size: 14px !important;
        font-weight: bold !important;
        z-index: 999999 !important;
      }
    `;
    
    document.head.appendChild(style);
    
    return () => {
      // Cleanup
      const styleEl = document.getElementById('emergency-css-fix');
      if (styleEl) {
        styleEl.remove();
      }
    };
  }, []);
  
  return null;
}
EOF
  echo "✅ Created EmergencyCSSFix component"
else
  echo "✅ EmergencyCSSFix component already exists"
fi

# Step 8: Update App.tsx to include verification components
echo "🔧 Updating App.tsx to include verification components..."
APP_TSX_PATH="client/src/App.tsx"
backup_file $APP_TSX_PATH

# Use grep to check if the components are already imported
if ! grep -q "import { VerifyCSSLoading }" $APP_TSX_PATH; then
  # Add import for VerifyCSSLoading
  sed -i.bak '/^import/a import { VerifyCSSLoading } from '\''./components/VerifyCSSLoading'\''; // Added CSS verification component' $APP_TSX_PATH
fi

if ! grep -q "import EmergencyCSSFix" $APP_TSX_PATH; then
  # Add import for EmergencyCSSFix
  sed -i.bak '/^import/a import EmergencyCSSFix from '\''./components/emergency-css-fix'\''; // Re-enabled to fix white screen issue' $APP_TSX_PATH
fi

# Check if the components are already rendered
if ! grep -q "<EmergencyCSSFix />" $APP_TSX_PATH; then
  # Find a good spot to add the components (before the first Route or Switch)
  sed -i.bak 's/<Switch>/<EmergencyCSSFix \/>\n          <VerifyCSSLoading \/> {\/\* Added CSS verification component \*\/}\n        <Switch>/' $APP_TSX_PATH
fi

echo "✅ Updated App.tsx to include verification components"

# Step 9: Clean up backup files created by sed
find . -name "*.bak" -type f -delete

# Step 10: Build the project
echo "🔨 Building the project with new Tailwind configuration..."
npm run build

# Step 11: Verify the build output
echo "🔍 Verifying build output..."
if [ -d "dist/public" ] && [ -f "dist/public/index.html" ]; then
  CSS_FILES=$(find dist/public -name "*.css" | wc -l)
  if [ "$CSS_FILES" -gt 0 ]; then
    echo "✅ Build successful! Found CSS files in the output directory."
    echo "   - CSS files: $CSS_FILES"
    
    # Check if Tailwind classes are in the CSS files
    TAILWIND_CLASSES=$(grep -l "bg-primary\|text-white\|p-4" dist/public/*.css | wc -l)
    if [ "$TAILWIND_CLASSES" -gt 0 ]; then
      echo "✅ Tailwind CSS classes found in the build output!"
    else
      echo "⚠️ Warning: Tailwind CSS classes not found in the build output."
    fi
  else
    echo "⚠️ Warning: No CSS files found in the build output."
  fi
else
  echo "❌ Build verification failed. Output directory or index.html not found."
fi

echo ""
echo "🎉 Tailwind CSS Production Fix Complete!"
echo "Next steps:"
echo "1. Deploy the updated build to your production environment"
echo "2. Verify that the UI matches the RylieAI branding from the PDF"
echo "3. If everything works correctly, you can remove the EmergencyCSSFix and VerifyCSSLoading components"
echo "   from App.tsx, but keep the configuration files (postcss.config.js, tailwind.config.ts, etc.)"
echo ""
echo "If issues persist, check the browser console for errors and verify that the CSS files are being loaded correctly."
