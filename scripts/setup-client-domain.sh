#!/bin/bash

# Client Domain Setup Script
# Automates the process of setting up a new client with custom domain

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required parameters are provided
if [ $# -lt 5 ]; then
    echo "Usage: $0 <client_name> <client_domain> <professional_email> <gmail_address> <dealership_id>"
    echo "Example: $0 'Kunes RV Fox' 'kunesrvfox.com' 'kelseyb@kunesrvfox.com' 'rylieai1234@gmail.com' 1"
    exit 1
fi

CLIENT_NAME="$1"
CLIENT_DOMAIN="$2"
PROFESSIONAL_EMAIL="$3"
GMAIL_ADDRESS="$4"
DEALERSHIP_ID="$5"
CLIENT_SLUG=$(echo "$CLIENT_DOMAIN" | cut -d'.' -f1)

print_step "Setting up client: $CLIENT_NAME"
echo "Domain: $CLIENT_DOMAIN"
echo "Professional Email: $PROFESSIONAL_EMAIL"
echo "Gmail (IMAP): $GMAIL_ADDRESS"
echo "Dealership ID: $DEALERSHIP_ID"
echo ""

# Prompt for Gmail app password
echo -n "Enter Gmail App Password for $GMAIL_ADDRESS: "
read -s GMAIL_PASSWORD
echo ""

# Validate inputs
if [ -z "$CLIENT_NAME" ] || [ -z "$CLIENT_DOMAIN" ] || [ -z "$GMAIL_ADDRESS" ] || [ -z "$GMAIL_PASSWORD" ]; then
    print_error "All fields are required"
    exit 1
fi

# Create temporary SQL file
TEMP_SQL=$(mktemp)
sed "s/{CLIENT_NAME}/$CLIENT_NAME/g; s/{CLIENT_DOMAIN}/$CLIENT_DOMAIN/g; s/{CLIENT_SLUG}/$CLIENT_SLUG/g; s|{PROFESSIONAL_EMAIL}|$PROFESSIONAL_EMAIL|g; s/{GMAIL_ADDRESS}/$GMAIL_ADDRESS/g; s/{GMAIL_PASSWORD}/$GMAIL_PASSWORD/g; s/{DEALERSHIP_ID}/$DEALERSHIP_ID/g" scripts/setup-client-domain.sql > "$TEMP_SQL"

print_step "Updating database configuration..."

# Execute SQL (assuming DATABASE_URL is set)
if [ -n "$DATABASE_URL" ]; then
    psql "$DATABASE_URL" -f "$TEMP_SQL"
    print_success "Database updated successfully"
else
    print_warning "DATABASE_URL not set. Please run the following SQL manually:"
    cat "$TEMP_SQL"
fi

# Clean up
rm "$TEMP_SQL"

print_step "Next steps for client setup:"
echo ""
echo "1. SENDGRID DOMAIN AUTHENTICATION:"
echo "   - Go to SendGrid Dashboard → Settings → Sender Authentication"
echo "   - Add domain: $CLIENT_DOMAIN"
echo "   - Get DNS records and send to client"
echo ""
echo "2. CLIENT DNS SETUP:"
echo "   - Client adds SendGrid DNS records to $CLIENT_DOMAIN"
echo "   - Client sets up email forwarding: leads@$CLIENT_DOMAIN → $GMAIL_ADDRESS"
echo ""
echo "3. VERIFICATION:"
echo "   - Verify domain in SendGrid (24-48 hours after DNS setup)"
echo "   - Test email flow: send test ADF to leads@$CLIENT_DOMAIN"
echo ""
echo "4. UPDATE VERIFICATION STATUS:"
echo "   UPDATE dealerships SET email_config = jsonb_set(email_config, '{verified}', 'true') WHERE id = $DEALERSHIP_ID;"
echo ""

print_success "Client setup script completed!"
print_warning "Remember to verify domain authentication in SendGrid before going live."
