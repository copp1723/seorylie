#!/bin/bash

# GA4 Service Account Setup Helper Script
# This script guides users through the GA4 service account setup process

set -e

echo "========================================="
echo "  GA4 Service Account Setup Assistant"
echo "========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check if npm dependencies are installed
if [ ! -d "node_modules" ]; then
    print_warning "Node modules not found. Installing dependencies..."
    npm install
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        print_warning ".env file not found. Creating from .env.example..."
        cp .env.example .env
        print_success ".env file created. Please update it with your GA4 configuration."
    else
        print_error ".env.example file not found. Cannot create .env file."
        exit 1
    fi
fi

# Main menu
echo ""
echo "What would you like to do?"
echo ""
echo "1) View GA4 Setup Documentation"
echo "2) Verify GA4 Configuration"
echo "3) Create credentials directory"
echo "4) Open Google Cloud Console"
echo "5) Open Google Analytics"
echo "6) Exit"
echo ""

read -p "Enter your choice (1-6): " choice

case $choice in
    1)
        # View documentation
        if [ -f "docs/GA4_SETUP.md" ]; then
            if command -v mdcat &> /dev/null; then
                mdcat docs/GA4_SETUP.md | less -R
            elif command -v glow &> /dev/null; then
                glow docs/GA4_SETUP.md
            else
                less docs/GA4_SETUP.md
            fi
        else
            print_error "Documentation file not found at docs/GA4_SETUP.md"
            exit 1
        fi
        ;;
    
    2)
        # Verify configuration
        echo ""
        print_warning "Checking GA4 configuration..."
        echo ""
        npm run setup:ga4:verify
        ;;
    
    3)
        # Create credentials directory
        echo ""
        print_warning "Creating credentials directory..."
        mkdir -p config/credentials
        print_success "Created directory: config/credentials/"
        echo ""
        echo "Place your GA4 service account JSON file in this directory."
        echo "Remember to update the GA4_SERVICE_ACCOUNT_KEY_PATH in your .env file."
        echo ""
        
        # Add to .gitignore if not already present
        if ! grep -q "config/credentials/" .gitignore 2>/dev/null; then
            echo "" >> .gitignore
            echo "# GA4 Service Account Credentials" >> .gitignore
            echo "config/credentials/" >> .gitignore
            print_success "Added config/credentials/ to .gitignore"
        fi
        ;;
    
    4)
        # Open Google Cloud Console
        echo ""
        print_warning "Opening Google Cloud Console..."
        if command -v open &> /dev/null; then
            open "https://console.cloud.google.com/"
        elif command -v xdg-open &> /dev/null; then
            xdg-open "https://console.cloud.google.com/"
        else
            echo "Please open: https://console.cloud.google.com/"
        fi
        ;;
    
    5)
        # Open Google Analytics
        echo ""
        print_warning "Opening Google Analytics..."
        if command -v open &> /dev/null; then
            open "https://analytics.google.com/"
        elif command -v xdg-open &> /dev/null; then
            xdg-open "https://analytics.google.com/"
        else
            echo "Please open: https://analytics.google.com/"
        fi
        ;;
    
    6)
        echo ""
        print_success "Goodbye!"
        exit 0
        ;;
    
    *)
        print_error "Invalid choice. Please run the script again."
        exit 1
        ;;
esac

echo ""
echo "========================================="
print_success "Setup assistant completed!"
echo ""
echo "Next steps:"
echo "1. Follow the documentation in docs/GA4_SETUP.md"
echo "2. Update your .env file with GA4 credentials"
echo "3. Run 'npm run setup:ga4:verify' to test the connection"
echo "========================================="