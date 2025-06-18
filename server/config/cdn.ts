/**
 * CDN Configuration for Production Assets
 * Supports multiple CDN providers with fallback options
 */

interface CDNConfig {
  provider: 'cloudflare' | 'cloudfront' | 'fastly' | 'supabase';
  baseUrl: string;
  customDomain?: string;
  settings: {
    cache: {
      images: number; // seconds
      documents: number;
      styles: number;
      scripts: number;
    };
    compression: boolean;
    imageOptimization: boolean;
  };
}

// Environment-based CDN configuration
export const cdnConfig: CDNConfig = {
  provider: (process.env.CDN_PROVIDER as CDNConfig['provider']) || 'supabase',
  baseUrl: process.env.CDN_BASE_URL || 'https://your-project.supabase.co/storage/v1/object/public',
  customDomain: process.env.CDN_CUSTOM_DOMAIN,
  settings: {
    cache: {
      images: 31536000, // 1 year
      documents: 604800, // 1 week
      styles: 2592000, // 30 days
      scripts: 2592000, // 30 days
    },
    compression: true,
    imageOptimization: true
  }
};

// CDN URL builder
export function getCDNUrl(path: string, options?: {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'webp' | 'jpg' | 'png';
}): string {
  const baseUrl = cdnConfig.customDomain || cdnConfig.baseUrl;
  
  if (!path) return '';
  
  // Remove leading slash if present
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  
  // Build URL based on provider
  switch (cdnConfig.provider) {
    case 'cloudflare':
      return buildCloudflareUrl(baseUrl, cleanPath, options);
    case 'cloudfront':
      return buildCloudfrontUrl(baseUrl, cleanPath, options);
    case 'supabase':
      return buildSupabaseUrl(baseUrl, cleanPath, options);
    default:
      return `${baseUrl}/${cleanPath}`;
  }
}

// Cloudflare Images URL builder
function buildCloudflareUrl(baseUrl: string, path: string, options?: any): string {
  if (!options || !cdnConfig.settings.imageOptimization) {
    return `${baseUrl}/${path}`;
  }

  const params = [];
  if (options.width) params.push(`w=${options.width}`);
  if (options.height) params.push(`h=${options.height}`);
  if (options.quality) params.push(`q=${options.quality}`);
  if (options.format) params.push(`f=${options.format}`);

  return `${baseUrl}/cdn-cgi/image/${params.join(',')}/${path}`;
}

// CloudFront URL builder
function buildCloudfrontUrl(baseUrl: string, path: string, options?: any): string {
  if (!options || !cdnConfig.settings.imageOptimization) {
    return `${baseUrl}/${path}`;
  }

  // CloudFront uses Lambda@Edge for image optimization
  const params = new URLSearchParams();
  if (options.width) params.append('w', options.width.toString());
  if (options.height) params.append('h', options.height.toString());
  if (options.quality) params.append('q', options.quality.toString());
  if (options.format) params.append('fm', options.format);

  return `${baseUrl}/${path}?${params.toString()}`;
}

// Supabase Storage URL builder
function buildSupabaseUrl(baseUrl: string, path: string, options?: any): string {
  if (!options || !cdnConfig.settings.imageOptimization) {
    return `${baseUrl}/${path}`;
  }

  // Supabase supports image transformations
  const transforms = [];
  if (options.width) transforms.push(`width=${options.width}`);
  if (options.height) transforms.push(`height=${options.height}`);
  if (options.quality) transforms.push(`quality=${options.quality}`);
  if (options.format) transforms.push(`format=${options.format}`);

  if (transforms.length > 0) {
    return `${baseUrl}/${path}?${transforms.join('&')}`;
  }

  return `${baseUrl}/${path}`;
}

// Get appropriate cache headers for asset type
export function getCacheHeaders(assetType: 'image' | 'document' | 'style' | 'script'): Record<string, string> {
  const cacheTime = cdnConfig.settings.cache[assetType + 's' as keyof typeof cdnConfig.settings.cache] || 3600;
  
  return {
    'Cache-Control': `public, max-age=${cacheTime}, immutable`,
    'X-Content-Type-Options': 'nosniff',
    ...(cdnConfig.settings.compression && { 'Content-Encoding': 'gzip' })
  };
}

// Asset URL helper for frontend
export function assetUrl(path: string): string {
  // In development, serve from local
  if (process.env.NODE_ENV === 'development') {
    return path;
  }
  
  // In production, use CDN
  return getCDNUrl(path);
}

// Preload critical assets
export function getPreloadLinks(): string[] {
  const critical = [
    '/assets/css/main.css',
    '/assets/js/app.js',
    '/assets/fonts/inter-var.woff2'
  ];

  return critical.map(path => getCDNUrl(path));
}