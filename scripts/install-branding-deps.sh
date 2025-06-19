#!/bin/bash

# Install dependencies for branding transformer service

echo "Installing dependencies for branding transformer..."

# Install required packages
npm install --save \
  cheerio@^1.0.0 \
  pizzip@^3.1.4 \
  docxtemplater@^3.42.0 \
  multer@^1.4.5-lts.1 \
  @types/multer@^1.4.11 \
  @supabase/supabase-js@^2.39.0

echo "Dependencies installed successfully!"
echo ""
echo "The following packages were installed:"
echo "- cheerio: HTML parsing and manipulation"
echo "- pizzip: ZIP file manipulation for DOCX"
echo "- docxtemplater: DOCX template processing"
echo "- multer: File upload handling"
echo "- @supabase/supabase-js: Supabase client for storage"
echo ""
echo "pdf-lib was already installed for PDF manipulation"