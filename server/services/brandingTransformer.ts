/**
 * Branding Transformer Service
 * Handles the transformation of SEOWerks-branded content to agency-branded content
 * Supports PDF, HTML, and DOCX file types
 */

import fs from 'fs';
import path from 'path';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as cheerio from 'cheerio';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { supabase } from '../supabase';

interface BrandingConfig {
  agencyId: string;
  agencyName: string;
  agencyLogo?: string;
  primaryColor: string;
  secondaryColor: string;
  contactEmail: string;
  contactPhone: string;
  website: string;
}

/**
 * Fetch agency branding configuration from database
 */
export async function getAgencyBranding(agencyId: string): Promise<BrandingConfig | null> {
  try {
    const { data, error } = await supabase
      .from('agency_branding')
      .select('*')
      .eq('agency_id', agencyId)
      .single();

    if (error || !data) {
      console.error('Failed to fetch agency branding:', error);
      return null;
    }

    // Fetch agency details
    const { data: agency } = await supabase
      .from('agencies')
      .select('name, contact_email, contact_phone, website')
      .eq('id', agencyId)
      .single();

    return {
      agencyId,
      agencyName: agency?.name || 'Agency',
      agencyLogo: data.logo_url,
      primaryColor: data.primary_color || '#000000',
      secondaryColor: data.secondary_color || '#666666',
      contactEmail: agency?.contact_email || '',
      contactPhone: agency?.contact_phone || '',
      website: agency?.website || ''
    };
  } catch (error) {
    console.error('Error fetching agency branding:', error);
    return null;
  }
}

/**
 * Transform PDF files by replacing SEOWerks branding with agency branding
 */
export async function transformPDF(
  inputPath: string,
  outputPath: string,
  branding: BrandingConfig
): Promise<void> {
  try {
    const existingPdfBytes = fs.readFileSync(inputPath);
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const pages = pdfDoc.getPages();
    
    // Load fonts
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Process each page
    for (const page of pages) {
      const { width, height } = page.getSize();
      
      // Cover SEOWerks branding with white rectangles (header and footer areas)
      // Header area (top 60 pixels)
      page.drawRectangle({
        x: 0,
        y: height - 60,
        width: width,
        height: 60,
        color: rgb(1, 1, 1),
      });
      
      // Footer area (bottom 50 pixels)
      page.drawRectangle({
        x: 0,
        y: 0,
        width: width,
        height: 50,
        color: rgb(1, 1, 1),
      });
      
      // Add agency header
      page.drawText(branding.agencyName, {
        x: 50,
        y: height - 40,
        size: 16,
        font: helveticaBold,
        color: rgb(
          parseInt(branding.primaryColor.slice(1, 3), 16) / 255,
          parseInt(branding.primaryColor.slice(3, 5), 16) / 255,
          parseInt(branding.primaryColor.slice(5, 7), 16) / 255
        ),
      });
      
      // Add agency contact info in footer
      const footerText = `${branding.contactEmail} | ${branding.contactPhone} | ${branding.website}`;
      page.drawText(footerText, {
        x: 50,
        y: 20,
        size: 10,
        font: helveticaFont,
        color: rgb(0.4, 0.4, 0.4),
      });
      
      // Add page number
      const pageNumber = pages.indexOf(page) + 1;
      const pageText = `Page ${pageNumber} of ${pages.length}`;
      page.drawText(pageText, {
        x: width - 100,
        y: 20,
        size: 10,
        font: helveticaFont,
        color: rgb(0.4, 0.4, 0.4),
      });
    }
    
    // Update document metadata
    pdfDoc.setTitle(pdfDoc.getTitle()?.replace(/SEOWerks/gi, branding.agencyName) || '');
    pdfDoc.setAuthor(branding.agencyName);
    pdfDoc.setCreator(branding.agencyName);
    
    // Save the modified PDF
    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync(outputPath, pdfBytes);
    
    console.log(`PDF transformed successfully: ${outputPath}`);
  } catch (error) {
    console.error('Error transforming PDF:', error);
    throw new Error(`Failed to transform PDF: ${error.message}`);
  }
}

/**
 * Transform HTML files by replacing SEOWerks branding with agency branding
 */
export async function transformHTML(
  inputPath: string,
  outputPath: string,
  branding: BrandingConfig
): Promise<void> {
  try {
    const html = fs.readFileSync(inputPath, 'utf-8');
    const $ = cheerio.load(html);
    
    // Replace all instances of SEOWerks text
    $('*').each((_, elem) => {
      const $elem = $(elem);
      const text = $elem.text();
      if (text.includes('SEOWerks')) {
        const newText = text.replace(/SEOWerks/gi, branding.agencyName);
        $elem.text(newText);
      }
    });
    
    // Update meta tags
    $('meta[name="author"]').attr('content', branding.agencyName);
    $('meta[name="description"]').each((_, elem) => {
      const $elem = $(elem);
      const content = $elem.attr('content') || '';
      $elem.attr('content', content.replace(/SEOWerks/gi, branding.agencyName));
    });
    
    // Replace logo images
    $('img[src*="seoworks-logo"], img[alt*="SEOWerks"]').each((_, elem) => {
      const $elem = $(elem);
      if (branding.agencyLogo) {
        $elem.attr('src', branding.agencyLogo);
      }
      $elem.attr('alt', `${branding.agencyName} Logo`);
    });
    
    // Update header if exists
    $('header').each((_, elem) => {
      const $header = $(elem);
      
      // Remove existing SEOWerks branding
      $header.find('*:contains("SEOWerks")').each((_, brandElem) => {
        const $brandElem = $(brandElem);
        const text = $brandElem.text();
        $brandElem.text(text.replace(/SEOWerks/gi, branding.agencyName));
      });
      
      // Update colors using inline styles
      $header.attr('style', `background-color: ${branding.primaryColor}; color: white;`);
    });
    
    // Update footer
    $('footer').each((_, elem) => {
      const $footer = $(elem);
      
      // Clear existing content
      $footer.empty();
      
      // Add agency branding
      $footer.html(`
        <div style="padding: 20px; text-align: center; background-color: #f5f5f5;">
          <h3 style="color: ${branding.primaryColor}; margin-bottom: 10px;">${branding.agencyName}</h3>
          <p style="color: #666; margin: 5px 0;">
            <a href="mailto:${branding.contactEmail}" style="color: ${branding.secondaryColor};">${branding.contactEmail}</a> | 
            <a href="tel:${branding.contactPhone}" style="color: ${branding.secondaryColor};">${branding.contactPhone}</a>
          </p>
          <p style="color: #666; margin: 5px 0;">
            <a href="${branding.website}" style="color: ${branding.secondaryColor};">${branding.website}</a>
          </p>
        </div>
      `);
    });
    
    // Add custom CSS for branding colors
    const customCSS = `
      <style>
        :root {
          --primary-color: ${branding.primaryColor};
          --secondary-color: ${branding.secondaryColor};
        }
        .btn-primary, .button-primary {
          background-color: var(--primary-color) !important;
          border-color: var(--primary-color) !important;
        }
        a {
          color: var(--secondary-color);
        }
        .brand-name {
          color: var(--primary-color);
        }
      </style>
    `;
    $('head').append(customCSS);
    
    // Save transformed HTML
    fs.writeFileSync(outputPath, $.html());
    
    console.log(`HTML transformed successfully: ${outputPath}`);
  } catch (error) {
    console.error('Error transforming HTML:', error);
    throw new Error(`Failed to transform HTML: ${error.message}`);
  }
}

/**
 * Transform DOCX files by replacing SEOWerks branding with agency branding
 */
export async function transformDOCX(
  inputPath: string,
  outputPath: string,
  branding: BrandingConfig
): Promise<void> {
  try {
    // Read the DOCX file
    const content = fs.readFileSync(inputPath, 'binary');
    const zip = new PizZip(content);
    
    // Initialize docxtemplater
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });
    
    // Get the full text to perform replacements
    const fullText = doc.getFullText();
    
    // Create a modified version by replacing SEOWerks references
    const modifiedZip = new PizZip(content);
    
    // Process document.xml (main content)
    if (modifiedZip.files['word/document.xml']) {
      let documentXml = modifiedZip.files['word/document.xml'].asText();
      
      // Replace SEOWerks text
      documentXml = documentXml.replace(/SEOWerks/gi, branding.agencyName);
      
      // Replace contact information patterns
      documentXml = documentXml.replace(
        /info@seoworks\.com/gi,
        branding.contactEmail
      );
      documentXml = documentXml.replace(
        /1-800-SEOWORKS/gi,
        branding.contactPhone
      );
      documentXml = documentXml.replace(
        /www\.seoworks\.com/gi,
        branding.website
      );
      
      modifiedZip.file('word/document.xml', documentXml);
    }
    
    // Process headers
    Object.keys(modifiedZip.files).forEach(fileName => {
      if (fileName.startsWith('word/header') && fileName.endsWith('.xml')) {
        let headerXml = modifiedZip.files[fileName].asText();
        headerXml = headerXml.replace(/SEOWerks/gi, branding.agencyName);
        headerXml = headerXml.replace(/info@seoworks\.com/gi, branding.contactEmail);
        modifiedZip.file(fileName, headerXml);
      }
    });
    
    // Process footers
    Object.keys(modifiedZip.files).forEach(fileName => {
      if (fileName.startsWith('word/footer') && fileName.endsWith('.xml')) {
        let footerXml = modifiedZip.files[fileName].asText();
        footerXml = footerXml.replace(/SEOWerks/gi, branding.agencyName);
        footerXml = footerXml.replace(/info@seoworks\.com/gi, branding.contactEmail);
        footerXml = footerXml.replace(/1-800-SEOWORKS/gi, branding.contactPhone);
        footerXml = footerXml.replace(/www\.seoworks\.com/gi, branding.website);
        modifiedZip.file(fileName, footerXml);
      }
    });
    
    // Update document properties
    if (modifiedZip.files['docProps/core.xml']) {
      let coreXml = modifiedZip.files['docProps/core.xml'].asText();
      
      // Update creator and company
      coreXml = coreXml.replace(
        /<dc:creator>.*?<\/dc:creator>/gi,
        `<dc:creator>${branding.agencyName}</dc:creator>`
      );
      coreXml = coreXml.replace(
        /<cp:lastModifiedBy>.*?<\/cp:lastModifiedBy>/gi,
        `<cp:lastModifiedBy>${branding.agencyName}</cp:lastModifiedBy>`
      );
      
      modifiedZip.file('docProps/core.xml', coreXml);
    }
    
    // Generate and save the modified document
    const buf = modifiedZip.generate({
      type: 'nodebuffer',
      compression: 'DEFLATE',
    });
    
    fs.writeFileSync(outputPath, buf);
    
    console.log(`DOCX transformed successfully: ${outputPath}`);
  } catch (error) {
    console.error('Error transforming DOCX:', error);
    throw new Error(`Failed to transform DOCX: ${error.message}`);
  }
}

/**
 * Main transformation function that handles all file types
 */
export async function transformFile(
  inputPath: string,
  outputPath: string,
  agencyId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Fetch agency branding
    const branding = await getAgencyBranding(agencyId);
    if (!branding) {
      return { success: false, error: 'Agency branding not found' };
    }
    
    // Determine file type
    const ext = path.extname(inputPath).toLowerCase();
    
    switch (ext) {
      case '.pdf':
        await transformPDF(inputPath, outputPath, branding);
        break;
      case '.html':
      case '.htm':
        await transformHTML(inputPath, outputPath, branding);
        break;
      case '.docx':
        await transformDOCX(inputPath, outputPath, branding);
        break;
      default:
        // For unsupported file types, just copy the file
        fs.copyFileSync(inputPath, outputPath);
        console.warn(`File type ${ext} not supported for branding transformation, copied as-is`);
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error transforming file:', error);
    return { success: false, error: error.message };
  }
}