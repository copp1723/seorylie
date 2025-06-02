/**
 * @file Main export file for the reporting-transform package
 * @description Exports all transformers and utilities for white-labeling vendor reports
 */

// Import PDF transformer components
import {
  PDFTransformer,
  createPDFTransformer,
  PDFTransformOptions,
  PDFTransformResult
} from './pdf-transformer';

// Import CSV transformer components
import {
  CSVTransformer,
  createCSVTransformer,
  CSVTransformOptions,
  CSVTransformResult
} from './csv-transformer';

// Export all components
export {
  // PDF Transformer
  PDFTransformer,
  createPDFTransformer,
  PDFTransformOptions,
  PDFTransformResult,
  
  // CSV Transformer
  CSVTransformer,
  createCSVTransformer,
  CSVTransformOptions,
  CSVTransformResult
};

/**
 * Transform a report file (PDF or CSV) to apply white-label branding
 * @param options Transformation options including file path/buffer and branding settings
 * @returns Promise with transformation result
 */
export async function transformReport(
  options: {
    filePath?: string;
    fileBuffer?: Buffer;
    s3Key?: string;
    fileType: 'pdf' | 'csv';
    outputPath?: string;
    outputS3Key?: string;
    whiteLabelName: string;
    whiteLabelDomain?: string;
    whiteLabelLogo?: string;
    vendorNames: string[];
    vendorDomains: string[];
  }
): Promise<PDFTransformResult | CSVTransformResult> {
  // Determine file type and create appropriate transformer
  if (options.fileType === 'pdf') {
    const pdfTransformer = createPDFTransformer({
      inputPdfPath: options.filePath,
      inputPdfBuffer: options.fileBuffer,
      inputPdfS3Key: options.s3Key,
      outputPdfPath: options.outputPath,
      outputPdfS3Key: options.outputS3Key,
      whiteLabelName: options.whiteLabelName,
      whiteLabelLogoPath: options.whiteLabelLogo,
      vendorNames: options.vendorNames,
      vendorDomains: options.vendorDomains,
      addCoverPage: true,
      sanitizeMetadata: true,
      replaceText: true,
      replaceImages: true
    });
    
    return await pdfTransformer.transform();
  } else if (options.fileType === 'csv') {
    const csvTransformer = createCSVTransformer({
      inputCsvPath: options.filePath,
      inputCsvBuffer: options.fileBuffer,
      inputCsvS3Key: options.s3Key,
      outputCsvPath: options.outputPath,
      outputCsvS3Key: options.outputS3Key,
      whiteLabelName: options.whiteLabelName,
      whiteLabelDomain: options.whiteLabelDomain || 'rylie-seo.com',
      whiteLabelEmail: `support@${options.whiteLabelDomain || 'rylie-seo.com'}`,
      vendorNames: options.vendorNames,
      vendorDomains: options.vendorDomains,
      sanitizeHeaders: true,
      sanitizeData: true,
      addWhiteLabelColumns: true
    });
    
    return await csvTransformer.transform();
  } else {
    throw new Error(`Unsupported file type: ${options.fileType}`);
  }
}

// Default export
export default {
  PDFTransformer,
  createPDFTransformer,
  CSVTransformer,
  createCSVTransformer,
  transformReport
};
