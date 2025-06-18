import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { supabaseAdmin } from '../config/supabase';
import { createOnboardingTasks } from '../services/onboardingTaskCreator';
import { sendOnboardingEmails } from '../services/emailService';

const router = Router();

// Rate limiter for onboarding submissions (max 5 per hour per IP)
const onboardingRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Max 5 submissions per hour
  message: 'Too many onboarding submissions from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// SEOWerks data structures (duplicated here to avoid client imports)
interface SEOWerksSubmissionData {
  dealerName: string;
  package: 'PLATINUM' | 'GOLD' | 'SILVER';
  mainBrand: string;
  otherBrand?: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  dealerContactName: string;
  dealerContactTitle: string;
  dealerContactEmail: string;
  dealerContactPhone: string;
  dealerWebsiteUrl: string;
  billingContactEmail: string;
  siteAccessNotes: string;
  targetVehicleModels: string[];
  targetCities: string[];
  targetDealers: string[];
}

function transformToSEOWerksFormat(onboardingData: any): SEOWerksSubmissionData {
  return {
    dealerName: onboardingData.businessName,
    package: onboardingData.package,
    mainBrand: onboardingData.mainBrand,
    otherBrand: onboardingData.otherBrand,
    address: onboardingData.address,
    city: onboardingData.city,
    state: onboardingData.state,
    zipCode: onboardingData.zipCode,
    dealerContactName: onboardingData.contactName,
    dealerContactTitle: onboardingData.contactTitle,
    dealerContactEmail: onboardingData.email,
    dealerContactPhone: onboardingData.phone,
    dealerWebsiteUrl: onboardingData.websiteUrl,
    billingContactEmail: onboardingData.billingEmail,
    siteAccessNotes: onboardingData.siteAccessNotes,
    targetVehicleModels: onboardingData.targetVehicleModels.filter(Boolean),
    targetCities: onboardingData.targetCities.filter(Boolean),
    targetDealers: onboardingData.targetDealers.filter(Boolean),
  };
}

function validateSEOWerksData(data: Partial<SEOWerksSubmissionData>): {
  isValid: boolean;
  missingFields: string[];
} {
  const requiredFields: (keyof SEOWerksSubmissionData)[] = [
    'dealerName',
    'package',
    'mainBrand',
    'address',
    'city',
    'state',
    'zipCode',
    'dealerContactName',
    'dealerContactTitle',
    'dealerContactEmail',
    'dealerContactPhone',
    'dealerWebsiteUrl',
    'billingContactEmail',
  ];

  const missingFields: string[] = [];

  requiredFields.forEach(field => {
    if (!data[field] || (typeof data[field] === 'string' && !data[field]?.trim())) {
      missingFields.push(field);
    }
  });

  // Validate arrays have at least 3 items
  if (!data.targetVehicleModels || data.targetVehicleModels.filter(Boolean).length < 3) {
    missingFields.push('targetVehicleModels (minimum 3)');
  }

  if (!data.targetCities || data.targetCities.filter(Boolean).length < 3) {
    missingFields.push('targetCities (minimum 3)');
  }

  if (!data.targetDealers || data.targetDealers.filter(Boolean).length < 3) {
    missingFields.push('targetDealers (minimum 3)');
  }

  return {
    isValid: missingFields.length === 0,
    missingFields,
  };
}

async function submitToSEOWerks(data: SEOWerksSubmissionData): Promise<{
  success: boolean;
  message: string;
  error?: string;
}> {
  try {
    // Create form data to match SEOWerks form submission
    const formData = new URLSearchParams();
    
    // Map all fields to form data
    formData.append('dealer_name', data.dealerName);
    formData.append('package', data.package);
    formData.append('main_brand', data.mainBrand);
    if (data.otherBrand) {
      formData.append('other_brand', data.otherBrand);
    }
    formData.append('address', data.address);
    formData.append('city', data.city);
    formData.append('state', data.state);
    formData.append('zip_code', data.zipCode);
    formData.append('dealer_contact_name', data.dealerContactName);
    formData.append('dealer_contact_title', data.dealerContactTitle);
    formData.append('dealer_contact_email', data.dealerContactEmail);
    formData.append('dealer_contact_phone', data.dealerContactPhone);
    formData.append('dealer_website_url', data.dealerWebsiteUrl);
    formData.append('billing_contact_email', data.billingContactEmail);
    formData.append('site_access_notes', data.siteAccessNotes);
    
    // Add target arrays
    data.targetVehicleModels.forEach((model, index) => {
      formData.append(`target_vehicle_models[${index}]`, model);
    });
    
    data.targetCities.forEach((city, index) => {
      formData.append(`target_cities[${index}]`, city);
    });
    
    data.targetDealers.forEach((dealer, index) => {
      formData.append(`target_dealers[${index}]`, dealer);
    });

    // Submit to SEOWerks
    const response = await fetch('https://start.seowerks.ai/', {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json, text/plain, */*',
      },
    });

    if (response.ok) {
      console.log('Successfully submitted to SEOWerks');
      return {
        success: true,
        message: 'Successfully submitted to SEOWerks platform',
      };
    } else {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
    }
  } catch (error) {
    console.error('SEOWerks submission error:', error);
    return {
      success: false,
      message: 'Failed to submit to SEOWerks platform',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Public endpoint for SEOWerks onboarding
 * No authentication required
 */
router.post('/api/public/seoworks-onboarding', onboardingRateLimiter, async (req: Request, res: Response) => {
  try {
    const onboardingData = req.body;

    // Log the submission for tracking
    console.log('SEOWerks public onboarding submission:', {
      businessName: onboardingData.businessName,
      email: onboardingData.email,
      package: onboardingData.package,
      timestamp: new Date().toISOString()
    });

    // Transform data for SEOWerks
    const seowerksData = transformToSEOWerksFormat(onboardingData);

    // Validate transformed data
    const validation = validateSEOWerksData(seowerksData);
    if (!validation.isValid) {
      return res.status(400).json({ 
        error: `Missing required fields: ${validation.missingFields.join(', ')}` 
      });
    }

    // Store in database
    const { data: dbResult, error: dbError } = await supabaseAdmin
      .from('seoworks_onboarding_submissions')
      .insert({
        business_name: onboardingData.businessName,
        website_url: onboardingData.websiteUrl,
        email: onboardingData.email,
        phone: onboardingData.phone,
        address: onboardingData.address,
        city: onboardingData.city,
        state: onboardingData.state,
        zip_code: onboardingData.zipCode,
        contact_name: onboardingData.contactName,
        contact_title: onboardingData.contactTitle,
        billing_email: onboardingData.billingEmail,
        package: onboardingData.package,
        main_brand: onboardingData.mainBrand,
        other_brand: onboardingData.otherBrand,
        target_vehicle_models: onboardingData.targetVehicleModels.filter(Boolean),
        target_cities: onboardingData.targetCities.filter(Boolean),
        target_dealers: onboardingData.targetDealers.filter(Boolean),
        site_access_notes: onboardingData.siteAccessNotes,
        google_business_profile_access: onboardingData.googleBusinessProfileAccess || false,
        google_analytics_access: onboardingData.googleAnalyticsAccess || false,
        ip_address: req.ip,
        user_agent: req.get('user-agent'),
        submission_status: 'pending'
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      throw new Error('Failed to save onboarding data');
    }

    console.log('Stored onboarding data:', dbResult);
    
    // Submit to SEOWerks platform
    const seowerksResult = await submitToSEOWerks(seowerksData);

    if (!seowerksResult.success) {
      console.error('SEOWerks submission failed:', seowerksResult.error);
      // Update database with failure status
      await supabaseAdmin
        .from('seoworks_onboarding_submissions')
        .update({
          submission_status: 'failed',
          seoworks_error: seowerksResult.error,
          updated_at: new Date().toISOString()
        })
        .eq('id', dbResult.id);
    } else {
      // Update database with success status
      await supabaseAdmin
        .from('seoworks_onboarding_submissions')
        .update({
          submission_status: 'submitted',
          seoworks_submission_date: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', dbResult.id);
    }

    // Create initial tasks based on package
    const taskResult = await createOnboardingTasks(dbResult.id);
    if (taskResult.success) {
      console.log(`Created ${taskResult.taskCount} initial tasks for ${onboardingData.businessName}`);
    } else {
      console.error('Failed to create tasks:', taskResult.error);
    }

    // Send confirmation emails
    try {
      await sendOnboardingEmails({
        dealershipEmail: onboardingData.email,
        dealershipName: onboardingData.businessName,
        contactName: onboardingData.contactName,
        package: onboardingData.package,
        submissionId: dbResult.id,
        tasksCreated: taskResult.taskCount
      });
    } catch (emailError) {
      console.error('Failed to send confirmation emails:', emailError);
      // Don't fail the request if email fails
    }

    res.status(200).json({
      success: true,
      message: 'Onboarding completed successfully',
      data: {
        businessName: onboardingData.businessName,
        package: onboardingData.package,
        seowerksSubmitted: seowerksResult.success,
        tasksCreated: taskResult.taskCount
      }
    });

  } catch (error) {
    console.error('Onboarding error:', error);
    res.status(500).json({ 
      error: 'An error occurred during onboarding. Please try again.' 
    });
  }
});

export default router;