import { useState, lazy, Suspense } from 'react';
import { useBranding } from '../contexts/AgencyBrandingContext';
import { Upload, Eye, EyeOff, Save, RotateCcw, Palette, Type, Moon, Sun } from 'lucide-react';

// Lazy load color picker
const HexColorPicker = lazy(() => import('react-colorful').then(m => ({ default: m.HexColorPicker })));

interface BrandingPreviewProps {
  className?: string;
}

export const BrandingPreview: React.FC<BrandingPreviewProps> = ({ className = '' }) => {
  const { branding, updateBranding, previewBranding, resetPreview, isPreviewMode, isUpdating } = useBranding();
  const [localBranding, setLocalBranding] = useState(branding);
  const [showColorPicker, setShowColorPicker] = useState<string | null>(null);
  // File state removed - handled directly in upload handlers

  if (!branding) return null;

  const handleColorChange = (field: string, color: string) => {
    if (!localBranding) return;
    const updates = { ...localBranding, [field]: color };
    setLocalBranding(updates);
    previewBranding(updates);
  };

  const handleInputChange = (field: string, value: any) => {
    if (!localBranding) return;
    const updates = { ...localBranding, [field]: value };
    setLocalBranding(updates);
    previewBranding(updates);
  };

  const handleFileUpload = async (file: File, field: 'logo_url' | 'favicon_url') => {
    // In a real implementation, upload to Supabase Storage
    const mockUrl = URL.createObjectURL(file);
    handleInputChange(field, mockUrl);
  };

  const handleSave = async () => {
    if (!localBranding) return;
    await updateBranding(localBranding);
    resetPreview();
  };

  const handleReset = () => {
    setLocalBranding(branding);
    resetPreview();
  };

  const fonts = [
    'Inter',
    'Arial',
    'Helvetica',
    'Georgia',
    'Times New Roman',
    'Roboto',
    'Open Sans',
    'Lato',
    'Montserrat',
    'Poppins'
  ];

  return (
    <div className={`bg-white dark:bg-gray-900 rounded-lg shadow-lg p-6 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Agency Branding</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => previewBranding(localBranding!)}
            className={`px-4 py-2 rounded-md flex items-center gap-2 transition-colors ${
              isPreviewMode
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300'
            }`}
          >
            {isPreviewMode ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            {isPreviewMode ? 'Preview Active' : 'Preview'}
          </button>
          <button
            onClick={handleReset}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 flex items-center gap-2 transition-colors"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </button>
          <button
            onClick={handleSave}
            disabled={isUpdating}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
          >
            <Save className="h-4 w-4" />
            {isUpdating ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Basic Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Basic Information</h3>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Company Name
            </label>
            <input
              type="text"
              value={localBranding?.company_name || ''}
              onChange={(e) => handleInputChange('company_name', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tagline
            </label>
            <input
              type="text"
              value={localBranding?.tagline || ''}
              onChange={(e) => handleInputChange('tagline', e.target.value)}
              placeholder="Your SEO Success Partner"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Support Email
            </label>
            <input
              type="email"
              value={localBranding?.support_email || ''}
              onChange={(e) => handleInputChange('support_email', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Support Phone
            </label>
            <input
              type="tel"
              value={localBranding?.support_phone || ''}
              onChange={(e) => handleInputChange('support_phone', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
            />
          </div>
        </div>

        {/* Visual Branding */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Visual Branding</h3>
          
          {/* Logo Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Logo
            </label>
            <div className="flex items-center space-x-4">
              {localBranding?.logo_url && (
                <img
                  src={localBranding.logo_url}
                  alt="Logo preview"
                  className="h-12 w-auto object-contain"
                />
              )}
              <label className="cursor-pointer px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 flex items-center gap-2 transition-colors">
                <Upload className="h-4 w-4" />
                Upload Logo
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file, 'logo_url');
                  }}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Color Pickers */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Primary Color
              </label>
              <div className="relative">
                <button
                  onClick={() => setShowColorPicker(showColorPicker === 'primary' ? null : 'primary')}
                  className="w-full h-10 rounded-md border-2 border-gray-300 dark:border-gray-600 flex items-center justify-center gap-2"
                  style={{ backgroundColor: localBranding?.primary_color }}
                >
                  <Palette className="h-4 w-4 text-white mix-blend-difference" />
                  <span className="text-xs font-mono text-white mix-blend-difference">
                    {localBranding?.primary_color}
                  </span>
                </button>
                {showColorPicker === 'primary' && (
                  <div className="absolute z-10 mt-2">
                    <Suspense fallback={<div className="w-[200px] h-[200px] bg-gray-200 animate-pulse rounded" />}>
                      <HexColorPicker
                        color={localBranding?.primary_color || '#000000'}
                        onChange={(color: string) => handleColorChange('primary_color', color)}
                      />
                    </Suspense>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Secondary Color
              </label>
              <div className="relative">
                <button
                  onClick={() => setShowColorPicker(showColorPicker === 'secondary' ? null : 'secondary')}
                  className="w-full h-10 rounded-md border-2 border-gray-300 dark:border-gray-600 flex items-center justify-center gap-2"
                  style={{ backgroundColor: localBranding?.secondary_color }}
                >
                  <Palette className="h-4 w-4 text-white mix-blend-difference" />
                  <span className="text-xs font-mono text-white mix-blend-difference">
                    {localBranding?.secondary_color}
                  </span>
                </button>
                {showColorPicker === 'secondary' && (
                  <div className="absolute z-10 mt-2">
                    <Suspense fallback={<div className="w-[200px] h-[200px] bg-gray-200 animate-pulse rounded" />}>
                      <HexColorPicker
                        color={localBranding?.secondary_color || '#000000'}
                        onChange={(color: string) => handleColorChange('secondary_color', color)}
                      />
                    </Suspense>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Accent Color
              </label>
              <div className="relative">
                <button
                  onClick={() => setShowColorPicker(showColorPicker === 'accent' ? null : 'accent')}
                  className="w-full h-10 rounded-md border-2 border-gray-300 dark:border-gray-600 flex items-center justify-center gap-2"
                  style={{ backgroundColor: localBranding?.accent_color }}
                >
                  <Palette className="h-4 w-4 text-white mix-blend-difference" />
                  <span className="text-xs font-mono text-white mix-blend-difference">
                    {localBranding?.accent_color}
                  </span>
                </button>
                {showColorPicker === 'accent' && (
                  <div className="absolute z-10 mt-2">
                    <Suspense fallback={<div className="w-[200px] h-[200px] bg-gray-200 animate-pulse rounded" />}>
                      <HexColorPicker
                        color={localBranding?.accent_color || '#000000'}
                        onChange={(color: string) => handleColorChange('accent_color', color)}
                      />
                    </Suspense>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Font Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              <Type className="inline h-4 w-4 mr-1" />
              Font Family
            </label>
            <select
              value={localBranding?.font_family || 'Inter'}
              onChange={(e) => handleInputChange('font_family', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
            >
              {fonts.map((font) => (
                <option key={font} value={font} style={{ fontFamily: font }}>
                  {font}
                </option>
              ))}
            </select>
          </div>

          {/* Theme Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Theme
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => handleInputChange('theme', 'light')}
                className={`flex-1 px-4 py-2 rounded-md flex items-center justify-center gap-2 transition-colors ${
                  localBranding?.theme === 'light'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                }`}
              >
                <Sun className="h-4 w-4" />
                Light
              </button>
              <button
                onClick={() => handleInputChange('theme', 'dark')}
                className={`flex-1 px-4 py-2 rounded-md flex items-center justify-center gap-2 transition-colors ${
                  localBranding?.theme === 'dark'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                }`}
              >
                <Moon className="h-4 w-4" />
                Dark
              </button>
              <button
                onClick={() => handleInputChange('theme', 'auto')}
                className={`flex-1 px-4 py-2 rounded-md flex items-center justify-center gap-2 transition-colors ${
                  localBranding?.theme === 'auto'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                }`}
              >
                Auto
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Custom CSS */}
      <div className="mt-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Custom CSS (Advanced)
        </label>
        <textarea
          value={localBranding?.custom_css || ''}
          onChange={(e) => handleInputChange('custom_css', e.target.value)}
          placeholder="/* Add custom CSS overrides here */"
          rows={6}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 font-mono text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white"
        />
      </div>

      {/* Preview Status */}
      {isPreviewMode && (
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            <Eye className="inline h-4 w-4 mr-1" />
            Preview mode is active. Changes are visible but not saved. Click "Save Changes" to persist your customizations.
          </p>
        </div>
      )}
    </div>
  );
};
