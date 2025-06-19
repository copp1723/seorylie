import { useState } from "react";
import {
  Building2,
  Globe,
  Mail,
  Phone,
  MapPin,
  Target,
  Users,
  CheckCircle,
  ArrowRight,
  Car,
  Package,
  AlertCircle
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
// Using native select instead of Radix UI Select for simplicity
import { Alert, AlertDescription } from "../components/ui/alert";

interface OnboardingData {
  // Basic Business Info
  businessName: string;
  websiteUrl: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;

  // Contact Information
  contactName: string;
  contactTitle: string;
  billingEmail: string;

  // SEOWerks Specific
  package: string; // PLATINUM, GOLD, SILVER
  mainBrand: string;
  otherBrand?: string;

  // SEO Targets
  targetVehicleModels: string[];
  targetCities: string[];
  targetDealers: string[];

  // Access Requirements
  siteAccessNotes: string;
  googleBusinessProfileAccess: boolean;
  googleAnalyticsAccess: boolean;
}

const packages = ['PLATINUM', 'GOLD', 'SILVER'];

const automotiveBrands = [
  'Acura', 'Audi', 'BMW', 'Buick', 'Buick Cadillac GMC', 'Buick GMC',
  'Cadillac', 'CDJR', 'Chevrolet', 'Chevrolet Buick', 'Chevrolet Buick GMC',
  'Chevrolet GMC', 'Chrysler', 'Dodge', 'Ford', 'Genesis', 'GMC',
  'Harley-Davidson', 'Honda', 'Honda Powersports', 'Hyundai', 'INFINITI',
  'Jeep', 'Kia', 'Lexus', 'Lincoln', 'Mazda', 'Mercedes-Benz', 'Mitsubishi',
  'Nissan', 'Polaris', 'RAM', 'Subaru', 'Toyota', 'Volkswagen', 'Volvo', 'Other'
];

const usStates = [
  'Alaska', 'Alabama', 'Arkansas', 'Arizona', 'California', 'Colorado',
  'Connecticut', 'District of Columbia', 'Delaware', 'Florida', 'Georgia',
  'Hawaii', 'Iowa', 'Idaho', 'Illinois', 'Indiana', 'Kansas', 'Kentucky',
  'Louisiana', 'Massachusetts', 'Maryland', 'Maine', 'Michigan', 'Minnesota',
  'Missouri', 'Mississippi', 'Montana', 'North Carolina', 'North Dakota',
  'Nebraska', 'New Hampshire', 'New Jersey', 'New Mexico', 'Nevada',
  'New York', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island',
  'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Virginia',
  'Vermont', 'Washington', 'Wisconsin', 'West Virginia', 'Wyoming'
];

export default function PublicOnboarding() {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [formData, setFormData] = useState<OnboardingData>({
    // Basic Business Info
    businessName: '',
    websiteUrl: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',

    // Contact Information
    contactName: '',
    contactTitle: '',
    billingEmail: '',

    // SEOWerks Specific
    package: '',
    mainBrand: '',
    otherBrand: '',

    // SEO Targets
    targetVehicleModels: ['', '', ''],
    targetCities: ['', '', ''],
    targetDealers: ['', '', ''],

    // Access Requirements
    siteAccessNotes: 'Need site access (full access, metadata, seo) and blog access: please provide us a login or create a new one under access@seowerks.ai',
    googleBusinessProfileAccess: false,
    googleAnalyticsAccess: false,
  });

  const totalSteps = 4;

  const handleInputChange = (field: keyof OnboardingData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleArrayItemChange = (field: 'targetVehicleModels' | 'targetCities' | 'targetDealers', index: number, value: string) => {
    const newArray = [...formData[field]];
    newArray[index] = value;
    setFormData(prev => ({
      ...prev,
      [field]: newArray
    }));
  };

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Submit to public API endpoint
      const response = await fetch('/api/public/seoworks-onboarding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Submission failed');
      }

      console.log('Onboarding completed successfully', {
        businessName: formData.businessName,
        package: formData.package
      });

      setIsSubmitted(true);
    } catch (error) {
      console.error('Onboarding submission error:', error);
      setSubmitError(error instanceof Error ? error.message : 'Submission failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isStepValid = () => {
    switch (currentStep) {
      case 1:
        return formData.businessName && formData.websiteUrl && formData.email &&
               formData.phone && formData.contactName && formData.contactTitle;
      case 2:
        return formData.address && formData.city && formData.state && formData.zipCode &&
               formData.billingEmail;
      case 3:
        return formData.package && formData.mainBrand;
      case 4:
        const validModels = formData.targetVehicleModels.filter(Boolean).length >= 3;
        const validCities = formData.targetCities.filter(Boolean).length >= 3;
        const validDealers = formData.targetDealers.filter(Boolean).length >= 3;
        return validModels && validCities && validDealers;
      default:
        return false;
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Welcome to SEOWerks!</h2>
              <p className="text-gray-600 text-center mb-8 max-w-lg">
                Thank you for choosing SEOWerks for your dealership's digital growth. 
                Our expert team will analyze your information and create a customized SEO strategy within 24 hours.
              </p>
              <div className="space-y-4 w-full max-w-md">
                <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                  <span className="text-sm font-medium">Initial SEO Audit</span>
                  <span className="text-sm text-blue-600">Starting now</span>
                </div>
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium">Strategy Document</span>
                  <span className="text-sm text-gray-500">Within 24 hours</span>
                </div>
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium">Onboarding Call</span>
                  <span className="text-sm text-gray-500">Within 48 hours</span>
                </div>
              </div>
              <div className="mt-8 p-4 bg-amber-50 rounded-lg">
                <p className="text-sm text-amber-800">
                  <strong>Next Steps:</strong> Our team will reach out to {formData.email} within 
                  the next business day to schedule your onboarding call and discuss your SEO strategy.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white py-12 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Get Started with SEOWerks</h1>
          <p className="text-xl text-gray-600">
            Drive more traffic and leads to your dealership with proven SEO strategies
          </p>
        </div>

        {/* Progress Indicator */}
        <div className="flex items-center justify-center space-x-4">
          {[1, 2, 3, 4].map((step) => (
            <div key={step} className="flex items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                step <= currentStep 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 text-gray-500'
              }`}>
                {step < currentStep ? <CheckCircle className="h-5 w-5" /> : step}
              </div>
              {step < 4 && (
                <div className={`w-16 h-1 mx-2 ${
                  step < currentStep ? 'bg-blue-600' : 'bg-gray-200'
                }`} />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl">
              {currentStep === 1 && 'Dealership Information'}
              {currentStep === 2 && 'Location & Billing'}
              {currentStep === 3 && 'SEO Package Selection'}
              {currentStep === 4 && 'Target Markets'}
            </CardTitle>
            <CardDescription>
              {currentStep === 1 && 'Tell us about your dealership and primary contact'}
              {currentStep === 2 && 'Where are you located and who handles billing?'}
              {currentStep === 3 && 'Choose the perfect SEO package for your dealership'}
              {currentStep === 4 && 'Define your target vehicles, cities, and competitors'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Step 1: Basic Information */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 flex items-center">
                      <Building2 className="h-4 w-4 mr-2" />
                      Dealership Name *
                    </label>
                    <Input
                      value={formData.businessName}
                      onChange={(e) => handleInputChange('businessName', e.target.value)}
                      placeholder="ABC Motors"
                      required
                      className="w-full"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 flex items-center">
                      <Globe className="h-4 w-4 mr-2" />
                      Website URL *
                    </label>
                    <Input
                      value={formData.websiteUrl}
                      onChange={(e) => handleInputChange('websiteUrl', e.target.value)}
                      placeholder="https://www.abcmotors.com"
                      type="url"
                      required
                      className="w-full"
                    />
                  </div>
                </div>

                <div className="space-y-4 border-t pt-6">
                  <h3 className="font-medium text-gray-900">Primary Contact</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 flex items-center">
                        <Users className="h-4 w-4 mr-2" />
                        Contact Name *
                      </label>
                      <Input
                        value={formData.contactName}
                        onChange={(e) => handleInputChange('contactName', e.target.value)}
                        placeholder="John Smith"
                        required
                        className="w-full"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">
                        Contact Title *
                      </label>
                      <Input
                        value={formData.contactTitle}
                        onChange={(e) => handleInputChange('contactTitle', e.target.value)}
                        placeholder="General Manager"
                        required
                        className="w-full"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 flex items-center">
                        <Mail className="h-4 w-4 mr-2" />
                        Email Address *
                      </label>
                      <Input
                        value={formData.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        placeholder="john@abcmotors.com"
                        type="email"
                        required
                        className="w-full"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 flex items-center">
                        <Phone className="h-4 w-4 mr-2" />
                        Phone Number *
                      </label>
                      <Input
                        value={formData.phone}
                        onChange={(e) => handleInputChange('phone', e.target.value)}
                        placeholder="(555) 123-4567"
                        type="tel"
                        required
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Location & Billing */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="font-medium text-gray-900 flex items-center">
                    <MapPin className="h-4 w-4 mr-2" />
                    Dealership Location
                  </h3>
                  <div className="space-y-4">
                    <Input
                      value={formData.address}
                      onChange={(e) => handleInputChange('address', e.target.value)}
                      placeholder="Street Address"
                      required
                      className="w-full"
                    />
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <Input
                        value={formData.city}
                        onChange={(e) => handleInputChange('city', e.target.value)}
                        placeholder="City"
                        required
                        className="w-full"
                      />
                      <select
                        value={formData.state}
                        onChange={(e) => handleInputChange('state', e.target.value)}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">State</option>
                        {usStates.map((state) => (
                          <option key={state} value={state}>
                            {state}
                          </option>
                        ))}
                      </select>
                      <Input
                        value={formData.zipCode}
                        onChange={(e) => handleInputChange('zipCode', e.target.value)}
                        placeholder="ZIP Code"
                        required
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4 border-t pt-6">
                  <h3 className="font-medium text-gray-900">Billing Information</h3>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 flex items-center">
                      <Mail className="h-4 w-4 mr-2" />
                      Billing Contact Email *
                    </label>
                    <Input
                      value={formData.billingEmail}
                      onChange={(e) => handleInputChange('billingEmail', e.target.value)}
                      placeholder="billing@abcmotors.com"
                      type="email"
                      required
                      className="w-full"
                    />
                    <p className="text-sm text-gray-500">
                      This email will receive invoices and billing notifications
                    </p>
                  </div>
                </div>

                <div className="space-y-4 border-t pt-6">
                  <h3 className="font-medium text-gray-900">Website Access</h3>
                  <Alert className="bg-amber-50 border-amber-200">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-amber-800">
                      We'll need access to your website to implement SEO improvements. 
                      Please be prepared to provide login credentials or create an account for access@seowerks.ai
                    </AlertDescription>
                  </Alert>
                  <Textarea
                    value={formData.siteAccessNotes}
                    onChange={(e) => handleInputChange('siteAccessNotes', e.target.value)}
                    placeholder="Any special instructions for website access?"
                    rows={3}
                    className="w-full"
                  />
                </div>
              </div>
            )}

            {/* Step 3: Package Selection */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="font-medium text-gray-900 flex items-center">
                    <Package className="h-4 w-4 mr-2" />
                    Choose Your SEO Package
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {packages.map((pkg) => (
                      <button
                        key={pkg}
                        type="button"
                        onClick={() => handleInputChange('package', pkg)}
                        className={`p-6 border-2 rounded-lg transition-all ${
                          formData.package === pkg
                            ? 'border-blue-600 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="text-center">
                          <div className={`text-lg font-bold mb-2 ${
                            pkg === 'PLATINUM' ? 'text-purple-600' :
                            pkg === 'GOLD' ? 'text-yellow-600' :
                            'text-gray-600'
                          }`}>
                            {pkg}
                          </div>
                          <div className="text-sm text-gray-500">
                            {pkg === 'PLATINUM' && 'Complete SEO Solution'}
                            {pkg === 'GOLD' && 'Advanced SEO Strategy'}
                            {pkg === 'SILVER' && 'Essential SEO Package'}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4 border-t pt-6">
                  <h3 className="font-medium text-gray-900 flex items-center">
                    <Car className="h-4 w-4 mr-2" />
                    Primary Brand
                  </h3>
                  <select
                    value={formData.mainBrand}
                    onChange={(e) => handleInputChange('mainBrand', e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select your main automotive brand</option>
                    {automotiveBrands.map((brand) => (
                      <option key={brand} value={brand}>
                        {brand}
                      </option>
                    ))}
                  </select>
                  {formData.mainBrand === 'Other' && (
                    <Input
                      value={formData.otherBrand || ''}
                      onChange={(e) => handleInputChange('otherBrand', e.target.value)}
                      placeholder="Please specify your brand"
                      className="w-full mt-2"
                    />
                  )}
                </div>
              </div>
            )}

            {/* Step 4: SEO Targets */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="font-medium text-gray-900 flex items-center">
                    <Target className="h-4 w-4 mr-2" />
                    Target Vehicle Models
                  </h3>
                  <p className="text-sm text-gray-500">List at least 3 vehicle models you want to rank for</p>
                  {formData.targetVehicleModels.map((model, index) => (
                    <Input
                      key={index}
                      value={model}
                      onChange={(e) => handleArrayItemChange('targetVehicleModels', index, e.target.value)}
                      placeholder={`Vehicle model ${index + 1} (e.g., F-150, Camry, Accord)`}
                      className="w-full"
                    />
                  ))}
                </div>

                <div className="space-y-4 border-t pt-6">
                  <h3 className="font-medium text-gray-900 flex items-center">
                    <MapPin className="h-4 w-4 mr-2" />
                    Target Cities
                  </h3>
                  <p className="text-sm text-gray-500">List at least 3 cities you want to target</p>
                  {formData.targetCities.map((city, index) => (
                    <Input
                      key={index}
                      value={city}
                      onChange={(e) => handleArrayItemChange('targetCities', index, e.target.value)}
                      placeholder={`Target city ${index + 1}`}
                      className="w-full"
                    />
                  ))}
                </div>

                <div className="space-y-4 border-t pt-6">
                  <h3 className="font-medium text-gray-900 flex items-center">
                    <Building2 className="h-4 w-4 mr-2" />
                    Competitor Dealerships
                  </h3>
                  <p className="text-sm text-gray-500">List at least 3 competing dealerships in your area</p>
                  {formData.targetDealers.map((dealer, index) => (
                    <Input
                      key={index}
                      value={dealer}
                      onChange={(e) => handleArrayItemChange('targetDealers', index, e.target.value)}
                      placeholder={`Competitor dealership ${index + 1}`}
                      className="w-full"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Error Message */}
            {submitError && (
              <Alert className="bg-red-50 border-red-200">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">
                  {submitError}
                </AlertDescription>
              </Alert>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between pt-6 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={handlePrevious}
                disabled={currentStep === 1}
              >
                Previous
              </Button>
              
              {currentStep < totalSteps ? (
                <Button
                  type="button"
                  onClick={handleNext}
                  disabled={!isStepValid()}
                  className="flex items-center space-x-2"
                >
                  <span>Next</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!isStepValid() || isSubmitting}
                  className="flex items-center space-x-2"
                >
                  <span>{isSubmitting ? 'Submitting...' : 'Complete Sign Up'}</span>
                  {!isSubmitting && <CheckCircle className="h-4 w-4" />}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Target className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Targeted SEO</h3>
              <p className="text-sm text-gray-600">
                Rank higher for the vehicles and locations that matter most to your dealership
              </p>
            </CardContent>
          </Card>
          <Card className="bg-green-50 border-green-200">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Expert Team</h3>
              <p className="text-sm text-gray-600">
                Dedicated SEO specialists who understand the automotive industry
              </p>
            </CardContent>
          </Card>
          <Card className="bg-purple-50 border-purple-200">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Proven Results</h3>
              <p className="text-sm text-gray-600">
                Increase organic traffic and generate more qualified leads
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}