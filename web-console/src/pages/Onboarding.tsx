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
  // Car,
  // Package,
  // AlertCircle
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Select } from "../components/ui/select";
import { useBranding } from "../contexts/BrandingContext";
import { submitToSEOWerks, transformToSEOWerksFormat, validateSEOWerksData } from "../services/seowerks-integration";
import { safeLog, safeLogError } from "../lib/utils";

interface OnboardingData {
  // Basic Business Info
  businessName: string; // Maps to "Dealer Name"
  websiteUrl: string; // Maps to "Dealer Website URL"
  email: string; // Maps to "Dealer Contact Email"
  phone: string; // Maps to "Dealer Contact Phone"
  address: string;
  city: string;
  state: string;
  zipCode: string;

  // Contact Information
  contactName: string; // Maps to "Dealer Contact Name"
  contactTitle: string; // Maps to "Dealer Contact Title"
  billingEmail: string; // Maps to "Billing Contact Email"

  // SEOWerks Specific
  package: string; // PLATINUM, GOLD, SILVER
  mainBrand: string; // Automotive brand
  otherBrand?: string; // If "Other" is selected

  // SEO Targets
  targetVehicleModels: string[]; // At least 3
  targetCities: string[]; // At least 3
  targetDealers: string[]; // At least 3

  // Access Requirements
  siteAccessNotes: string;
  googleBusinessProfileAccess: boolean;
  googleAnalyticsAccess: boolean;

  // Legacy fields (keep for backward compatibility)
  industry: string;
  businessType: string;
  targetAudience: string;
  primaryGoals: string[];
  currentChallenges: string;
  competitorUrls: string[];
  budget: string;
  timeline: string;
  additionalInfo: string;
}

// const packages = ['PLATINUM', 'GOLD', 'SILVER'];

// const automotiveBrands = [
//   'Acura', 'Audi', 'BMW', 'Buick', 'Buick Cadillac GMC', 'Buick GMC',
//   'Cadillac', 'CDJR', 'Chevrolet', 'Chevrolet Buick', 'Chevrolet Buick GMC',
//   'Chevrolet GMC', 'Chrysler', 'Dodge', 'Ford', 'Genesis', 'GMC',
//   'Harley-Davidson', 'Honda', 'Honda Powersports', 'Hyundai', 'INFINITI',
//   'Jeep', 'Kia', 'Lexus', 'Lincoln', 'Mazda', 'Mercedes-Benz', 'Mitsubishi',
//   'Nissan', 'Polaris', 'RAM', 'Subaru', 'Toyota', 'Volkswagen', 'Volvo', 'Other'
// ];

// const usStates = [
//   'Alaska', 'Alabama', 'Arkansas', 'Arizona', 'California', 'Colorado',
//   'Connecticut', 'District of Columbia', 'Delaware', 'Florida', 'Georgia',
//   'Hawaii', 'Iowa', 'Idaho', 'Illinois', 'Indiana', 'Kansas', 'Kentucky',
//   'Louisiana', 'Massachusetts', 'Maryland', 'Maine', 'Michigan', 'Minnesota',
//   'Missouri', 'Mississippi', 'Montana', 'North Carolina', 'North Dakota',
//   'Nebraska', 'New Hampshire', 'New Jersey', 'New Mexico', 'Nevada',
//   'New York', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island',
//   'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Virginia',
//   'Vermont', 'Washington', 'Wisconsin', 'West Virginia', 'Wyoming'
// ];

const industries = [
  'Automotive Dealership',
  'Technology',
  'Healthcare',
  'Finance',
  'Real Estate',
  'Retail/E-commerce',
  'Professional Services',
  'Manufacturing',
  'Education',
  'Non-profit',
  'Other'
];

const businessTypes = [
  'Automotive Dealership',
  'B2B (Business to Business)',
  'B2C (Business to Consumer)',
  'B2B2C (Business to Business to Consumer)',
  'Marketplace',
  'SaaS (Software as a Service)',
  'E-commerce',
  'Service Provider',
  'Other'
];

const seoGoals = [
  'Increase organic traffic',
  'Improve keyword rankings',
  'Generate more leads',
  'Boost online sales',
  'Enhance local visibility',
  'Build brand awareness',
  'Improve user experience',
  'Outrank competitors'
];

export default function Onboarding() {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { branding } = useBranding();

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

    // Legacy fields
    industry: 'Automotive Dealership',
    businessType: 'Automotive Dealership',
    targetAudience: '',
    primaryGoals: [],
    currentChallenges: '',
    competitorUrls: ['', '', ''],
    budget: '',
    timeline: '',
    additionalInfo: ''
  });

  const totalSteps = 4;

  const handleInputChange = (field: keyof OnboardingData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleGoalToggle = (goal: string) => {
    setFormData(prev => ({
      ...prev,
      primaryGoals: prev.primaryGoals.includes(goal)
        ? prev.primaryGoals.filter(g => g !== goal)
        : [...prev.primaryGoals, goal]
    }));
  };

  const handleCompetitorChange = (index: number, value: string) => {
    const newCompetitors = [...formData.competitorUrls];
    newCompetitors[index] = value;
    setFormData(prev => ({
      ...prev,
      competitorUrls: newCompetitors
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
      // Transform data for SEOWerks
      const seowerksData = transformToSEOWerksFormat(formData);

      // Validate data
      const validation = validateSEOWerksData(seowerksData);
      if (!validation.isValid) {
        throw new Error(`Missing required fields: ${validation.missingFields.join(', ')}`);
      }

      // Submit to internal API first
      const internalResponse = await fetch('/api/client/onboarding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!internalResponse.ok) {
        throw new Error('Failed to save onboarding data internally');
      }

      // Submit to SEOWerks platform
      const seowerksResult = await submitToSEOWerks(seowerksData);

      if (!seowerksResult.success) {
        console.warn('SEOWerks submission failed:', seowerksResult.error);
        // Continue anyway - internal data is saved
      }

      safeLog('Onboarding completed successfully', {
        internal: true,
        seowerks: seowerksResult.success,
        businessName: formData.businessName,
        websiteUrl: formData.websiteUrl,
        package: formData.package
      });

      setIsSubmitted(true);
    } catch (error) {
      safeLogError('Onboarding submission error', error);
      setSubmitError(error instanceof Error ? error.message : 'Submission failed');
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
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-4">Welcome to {branding.companyName}!</h2>
            <p className="text-muted-foreground text-center mb-8">
              Thank you for completing your business profile. Our SEO team will analyze your information 
              and create a customized strategy for your business within 24 hours.
            </p>
            <div className="space-y-4 w-full max-w-md">
              <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                <span className="text-sm font-medium">Initial SEO Audit</span>
                <span className="text-sm text-blue-600">Starting soon</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <span className="text-sm font-medium">Strategy Document</span>
                <span className="text-sm text-muted-foreground">Within 24 hours</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <span className="text-sm font-medium">First Progress Report</span>
                <span className="text-sm text-muted-foreground">Weekly</span>
              </div>
            </div>
            <div className="flex space-x-4 mt-8">
              <Button onClick={() => window.location.href = '/dashboard'}>
                Go to Dashboard
              </Button>
              <Button variant="outline" onClick={() => window.location.href = '/chat'}>
                Start Chatting
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-3xl font-bold text-foreground">Business Profile Setup</h2>
        <p className="text-muted-foreground mt-2">
          Help us understand your business so we can create the perfect SEO strategy
        </p>
      </div>

      {/* Progress Indicator */}
      <div className="flex items-center justify-center space-x-4">
        {[1, 2, 3, 4].map((step) => (
          <div key={step} className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step <= currentStep 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-muted text-muted-foreground'
            }`}>
              {step < currentStep ? <CheckCircle className="h-4 w-4" /> : step}
            </div>
            {step < 4 && (
              <div className={`w-12 h-0.5 mx-2 ${
                step < currentStep ? 'bg-primary' : 'bg-muted'
              }`} />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <Card>
        <CardHeader>
          <CardTitle>
            {currentStep === 1 && 'Dealership & Contact Information'}
            {currentStep === 2 && 'Location & Billing Details'}
            {currentStep === 3 && 'Package & Brand Selection'}
            {currentStep === 4 && 'SEO Targets & Priorities'}
          </CardTitle>
          <CardDescription>
            {currentStep === 1 && 'Basic dealership information and primary contact details'}
            {currentStep === 2 && 'Physical location and billing contact information'}
            {currentStep === 3 && 'Choose your SEO package and primary automotive brand'}
            {currentStep === 4 && 'Define your target vehicle models, cities, and competitor dealers'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Step 1: Basic Information */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground flex items-center">
                    <Building2 className="h-4 w-4 mr-2" />
                    Business Name *
                  </label>
                  <Input
                    value={formData.businessName}
                    onChange={(e) => handleInputChange('businessName', e.target.value)}
                    placeholder="Your business name"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground flex items-center">
                    <Globe className="h-4 w-4 mr-2" />
                    Website URL *
                  </label>
                  <Input
                    value={formData.websiteUrl}
                    onChange={(e) => handleInputChange('websiteUrl', e.target.value)}
                    placeholder="https://yourwebsite.com"
                    type="url"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground flex items-center">
                    <Mail className="h-4 w-4 mr-2" />
                    Email Address *
                  </label>
                  <Input
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    placeholder="your@email.com"
                    type="email"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground flex items-center">
                    <Phone className="h-4 w-4 mr-2" />
                    Phone Number
                  </label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    placeholder="(555) 123-4567"
                    type="tel"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground flex items-center">
                  <MapPin className="h-4 w-4 mr-2" />
                  Business Address
                </label>
                <Input
                  value={formData.address}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  placeholder="Your business address (for local SEO)"
                />
              </div>
            </div>
          )}

          {/* Step 2: Business Details */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Industry *
                  </label>
                  <Select
                    value={formData.industry}
                    onChange={(e) => handleInputChange('industry', e.target.value)}
                    required
                  >
                    <option value="">Select your industry</option>
                    {industries.map((industry) => (
                      <option key={industry} value={industry}>
                        {industry}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Business Type *
                  </label>
                  <Select
                    value={formData.businessType}
                    onChange={(e) => handleInputChange('businessType', e.target.value)}
                    required
                  >
                    <option value="">Select business type</option>
                    {businessTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground flex items-center">
                  <Users className="h-4 w-4 mr-2" />
                  Target Audience *
                </label>
                <Textarea
                  value={formData.targetAudience}
                  onChange={(e) => handleInputChange('targetAudience', e.target.value)}
                  placeholder="Describe your ideal customers (e.g., small business owners, homeowners, tech professionals)"
                  rows={3}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Current SEO Challenges
                </label>
                <Textarea
                  value={formData.currentChallenges}
                  onChange={(e) => handleInputChange('currentChallenges', e.target.value)}
                  placeholder="What SEO challenges are you currently facing? (e.g., low rankings, no organic traffic, technical issues)"
                  rows={3}
                />
              </div>
            </div>
          )}

          {/* Step 3: SEO Goals */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="space-y-4">
                <label className="text-sm font-medium text-foreground flex items-center">
                  <Target className="h-4 w-4 mr-2" />
                  Primary SEO Goals * (Select all that apply)
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {seoGoals.map((goal) => (
                    <button
                      key={goal}
                      type="button"
                      onClick={() => handleGoalToggle(goal)}
                      className={`p-3 text-left border rounded-lg transition-all ${
                        formData.primaryGoals.includes(goal)
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="flex items-center">
                        <div className={`w-4 h-4 rounded border-2 mr-3 flex items-center justify-center ${
                          formData.primaryGoals.includes(goal)
                            ? 'border-primary bg-primary'
                            : 'border-muted-foreground'
                        }`}>
                          {formData.primaryGoals.includes(goal) && (
                            <CheckCircle className="h-3 w-3 text-primary-foreground" />
                          )}
                        </div>
                        <span className="text-sm">{goal}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Budget Range (Monthly)
                  </label>
                  <Select
                    value={formData.budget}
                    onChange={(e) => handleInputChange('budget', e.target.value)}
                  >
                    <option value="">Select budget range</option>
                    <option value="under-1000">Under $1,000</option>
                    <option value="1000-2500">$1,000 - $2,500</option>
                    <option value="2500-5000">$2,500 - $5,000</option>
                    <option value="5000-10000">$5,000 - $10,000</option>
                    <option value="over-10000">Over $10,000</option>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Timeline Goals
                  </label>
                  <Select
                    value={formData.timeline}
                    onChange={(e) => handleInputChange('timeline', e.target.value)}
                  >
                    <option value="">Select timeline</option>
                    <option value="1-3-months">1-3 months</option>
                    <option value="3-6-months">3-6 months</option>
                    <option value="6-12-months">6-12 months</option>
                    <option value="1-year-plus">1+ years</option>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Additional Information */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div className="space-y-4">
                <label className="text-sm font-medium text-foreground">
                  Main Competitors (Website URLs)
                </label>
                <p className="text-sm text-muted-foreground">
                  Help us understand your competitive landscape
                </p>
                {formData.competitorUrls.map((url, index) => (
                  <Input
                    key={index}
                    value={url}
                    onChange={(e) => handleCompetitorChange(index, e.target.value)}
                    placeholder={`Competitor ${index + 1} website URL`}
                    type="url"
                  />
                ))}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Additional Information
                </label>
                <Textarea
                  value={formData.additionalInfo}
                  onChange={(e) => handleInputChange('additionalInfo', e.target.value)}
                  placeholder="Any additional information that would help us create a better SEO strategy for you?"
                  rows={4}
                />
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between pt-6 border-t border-border">
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
                className="flex items-center space-x-2"
              >
                <span>Complete Setup</span>
                <CheckCircle className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Step Information */}
      <Card className="bg-muted/50">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <Building2 className="h-8 w-8 text-primary mx-auto mb-2" />
              <h3 className="font-medium text-foreground mb-1">Business Info</h3>
              <p className="text-sm text-muted-foreground">
                Basic details about your business and website
              </p>
            </div>
            <div className="text-center">
              <Target className="h-8 w-8 text-primary mx-auto mb-2" />
              <h3 className="font-medium text-foreground mb-1">SEO Strategy</h3>
              <p className="text-sm text-muted-foreground">
                Your goals and target audience information
              </p>
            </div>
            <div className="text-center">
              <CheckCircle className="h-8 w-8 text-primary mx-auto mb-2" />
              <h3 className="font-medium text-foreground mb-1">Launch</h3>
              <p className="text-sm text-muted-foreground">
                Get your custom SEO strategy within 24 hours
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}