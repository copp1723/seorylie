import { Request, Response, NextFunction } from 'express';
import { getCacheHeaders, cdnConfig, getCDNUrl } from '../config/cdn';
import path from 'path';

// Determine asset type from file extension
function getAssetType(filePath: string): 'image' | 'document' | 'style' | 'script' | null {
  const ext = path.extname(filePath).toLowerCase();
  
  const assetTypes: Record<string, 'image' | 'document' | 'style' | 'script'> = {
    // Images
    '.jpg': 'image',
    '.jpeg': 'image',
    '.png': 'image',
    '.gif': 'image',
    '.webp': 'image',
    '.svg': 'image',
    '.ico': 'image',
    
    // Documents
    '.pdf': 'document',
    '.doc': 'document',
    '.docx': 'document',
    '.txt': 'document',
    
    // Styles
    '.css': 'style',
    '.scss': 'style',
    '.sass': 'style',
    
    // Scripts
    '.js': 'script',
    '.mjs': 'script',
    '.ts': 'script',
    '.jsx': 'script',
    '.tsx': 'script'
  };
  
  return assetTypes[ext] || null;
}

// CDN asset middleware
export function cdnAssetMiddleware(req: Request, res: Response, next: NextFunction) {
  // Skip in development
  if (process.env.NODE_ENV === 'development') {
    return next();
  }

  // Check if this is a static asset request
  const assetPaths = ['/assets/', '/images/', '/fonts/', '/static/'];
  const isAsset = assetPaths.some(path => req.path.startsWith(path));
  
  if (!isAsset) {
    return next();
  }

  // Get asset type
  const assetType = getAssetType(req.path);
  
  if (!assetType) {
    return next();
  }

  // Set cache headers
  const headers = getCacheHeaders(assetType);
  Object.entries(headers).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  // Add security headers
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // If using external CDN, redirect to CDN URL
  if (cdnConfig.provider !== 'supabase' && cdnConfig.customDomain) {
    const cdnUrl = getCDNUrl(req.path);
    return res.redirect(301, cdnUrl);
  }

  // Otherwise, continue with normal static serving
  next();
}

// Image optimization middleware
export function imageOptimizationMiddleware(req: Request, res: Response, next: NextFunction) {
  // Skip if not an image
  const assetType = getAssetType(req.path);
  if (assetType !== 'image') {
    return next();
  }

  // Extract query parameters for image transformation
  const { w, h, q, fm } = req.query;
  
  if (w || h || q || fm) {
    // If using CDN with image optimization, redirect
    if (cdnConfig.settings.imageOptimization) {
      const cdnUrl = getCDNUrl(req.path, {
        width: w ? parseInt(w as string) : undefined,
        height: h ? parseInt(h as string) : undefined,
        quality: q ? parseInt(q as string) : undefined,
        format: fm as 'webp' | 'jpg' | 'png' | undefined
      });
      
      return res.redirect(301, cdnUrl);
    }
  }

  next();
}

// Preload headers middleware
export function preloadAssetsMiddleware(req: Request, res: Response, next: NextFunction) {
  // Only add preload headers for HTML responses
  if (req.path === '/' || req.path.endsWith('.html')) {
    const preloadLinks = [
      `<${getCDNUrl('/assets/css/main.css')}>; rel=preload; as=style`,
      `<${getCDNUrl('/assets/js/app.js')}>; rel=preload; as=script`,
      `<${getCDNUrl('/assets/fonts/inter-var.woff2')}>; rel=preload; as=font; type=font/woff2; crossorigin`
    ];
    
    res.setHeader('Link', preloadLinks.join(', '));
  }
  
  next();
}