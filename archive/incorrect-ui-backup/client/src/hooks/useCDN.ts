import { useMemo } from 'react';

interface CDNOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'webp' | 'jpg' | 'png';
}

// CDN configuration from environment
const CDN_BASE_URL = process.env.REACT_APP_CDN_URL || '';
const CDN_PROVIDER = process.env.REACT_APP_CDN_PROVIDER || 'supabase';

export function useCDN() {
  const getCDNUrl = useMemo(() => {
    return (path: string, options?: CDNOptions): string => {
      // In development, use local assets
      if (process.env.NODE_ENV === 'development' || !CDN_BASE_URL) {
        return path;
      }

      // Clean the path
      const cleanPath = path.startsWith('/') ? path.slice(1) : path;
      
      // Build CDN URL based on provider
      switch (CDN_PROVIDER) {
        case 'cloudflare':
          return buildCloudflareUrl(cleanPath, options);
        case 'supabase':
          return buildSupabaseUrl(cleanPath, options);
        default:
          return `${CDN_BASE_URL}/${cleanPath}`;
      }
    };
  }, []);

  const buildCloudflareUrl = (path: string, options?: CDNOptions): string => {
    if (!options) {
      return `${CDN_BASE_URL}/${path}`;
    }

    const params = [];
    if (options.width) params.push(`w=${options.width}`);
    if (options.height) params.push(`h=${options.height}`);
    if (options.quality) params.push(`q=${options.quality}`);
    if (options.format) params.push(`f=${options.format}`);

    return `${CDN_BASE_URL}/cdn-cgi/image/${params.join(',')}/${path}`;
  };

  const buildSupabaseUrl = (path: string, options?: CDNOptions): string => {
    if (!options) {
      return `${CDN_BASE_URL}/${path}`;
    }

    const transforms = [];
    if (options.width) transforms.push(`width=${options.width}`);
    if (options.height) transforms.push(`height=${options.height}`);
    if (options.quality) transforms.push(`quality=${options.quality}`);
    if (options.format) transforms.push(`format=${options.format}`);

    if (transforms.length > 0) {
      return `${CDN_BASE_URL}/${path}?${transforms.join('&')}`;
    }

    return `${CDN_BASE_URL}/${path}`;
  };

  // Helper for responsive images
  const getResponsiveImageUrl = (path: string, size: 'thumb' | 'small' | 'medium' | 'large' | 'full'): string => {
    const sizes: Record<string, CDNOptions> = {
      thumb: { width: 150, height: 150, quality: 80 },
      small: { width: 300, quality: 85 },
      medium: { width: 600, quality: 85 },
      large: { width: 1200, quality: 90 },
      full: { quality: 95 }
    };

    return getCDNUrl(path, sizes[size]);
  };

  // Helper for optimized deliverable URLs
  const getDeliverableUrl = (deliverable: { file_url?: string; file_path?: string }): string => {
    const url = deliverable.file_url || deliverable.file_path || '';
    
    // If it's already a full URL, return as is
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }

    // For PDFs and documents, don't apply image optimizations
    if (url.match(/\.(pdf|doc|docx|txt)$/i)) {
      return getCDNUrl(url);
    }

    // For images, apply optimization
    if (url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
      return getCDNUrl(url, { quality: 85, format: 'webp' });
    }

    return getCDNUrl(url);
  };

  return {
    getCDNUrl,
    getResponsiveImageUrl,
    getDeliverableUrl,
    cdnBaseUrl: CDN_BASE_URL,
    isEnabled: !!CDN_BASE_URL && process.env.NODE_ENV === 'production'
  };
}

// Standalone utility functions for use outside of React components
export const cdnUrl = (path: string, options?: CDNOptions): string => {
  if (process.env.NODE_ENV === 'development' || !CDN_BASE_URL) {
    return path;
  }

  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  
  if (CDN_PROVIDER === 'supabase' && options) {
    const transforms = [];
    if (options.width) transforms.push(`width=${options.width}`);
    if (options.height) transforms.push(`height=${options.height}`);
    if (options.quality) transforms.push(`quality=${options.quality}`);
    if (options.format) transforms.push(`format=${options.format}`);

    if (transforms.length > 0) {
      return `${CDN_BASE_URL}/${cleanPath}?${transforms.join('&')}`;
    }
  }

  return `${CDN_BASE_URL}/${cleanPath}`;
};