import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Middleware to check admin role
const requireAdminRole = (req: Request, res: Response, next: any) => {
  if (!req.user || !['admin', 'super_admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

router.use(requireAdminRole);

/**
 * Get all SEOWerks onboarding submissions
 */
router.get('/api/admin/seoworks-onboarding', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('seoworks_onboarding_submissions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({ error: 'Failed to fetch submissions' });
    }

    res.json(data);
  } catch (error) {
    console.error('Error fetching submissions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get a single onboarding submission
 */
router.get('/api/admin/seoworks-onboarding/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from('seoworks_onboarding_submissions')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Database error:', error);
      return res.status(404).json({ error: 'Submission not found' });
    }

    res.json(data);
  } catch (error) {
    console.error('Error fetching submission:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Retry a failed SEOWerks submission
 */
router.post('/api/admin/seoworks-onboarding/:id/retry', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get the submission data
    const { data: submission, error: fetchError } = await supabaseAdmin
      .from('seoworks_onboarding_submissions')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    // Transform data for SEOWerks
    const seowerksData = {
      dealerName: submission.business_name,
      package: submission.package,
      mainBrand: submission.main_brand,
      otherBrand: submission.other_brand,
      address: submission.address,
      city: submission.city,
      state: submission.state,
      zipCode: submission.zip_code,
      dealerContactName: submission.contact_name,
      dealerContactTitle: submission.contact_title,
      dealerContactEmail: submission.email,
      dealerContactPhone: submission.phone,
      dealerWebsiteUrl: submission.website_url,
      billingContactEmail: submission.billing_email,
      siteAccessNotes: submission.site_access_notes,
      targetVehicleModels: submission.target_vehicle_models,
      targetCities: submission.target_cities,
      targetDealers: submission.target_dealers,
    };

    // Try to submit to SEOWerks
    try {
      // Create form data
      const formData = new URLSearchParams();
      
      // Map all fields
      formData.append('dealer_name', seowerksData.dealerName);
      formData.append('package', seowerksData.package);
      formData.append('main_brand', seowerksData.mainBrand);
      if (seowerksData.otherBrand) {
        formData.append('other_brand', seowerksData.otherBrand);
      }
      formData.append('address', seowerksData.address);
      formData.append('city', seowerksData.city);
      formData.append('state', seowerksData.state);
      formData.append('zip_code', seowerksData.zipCode);
      formData.append('dealer_contact_name', seowerksData.dealerContactName);
      formData.append('dealer_contact_title', seowerksData.dealerContactTitle);
      formData.append('dealer_contact_email', seowerksData.dealerContactEmail);
      formData.append('dealer_contact_phone', seowerksData.dealerContactPhone);
      formData.append('dealer_website_url', seowerksData.dealerWebsiteUrl);
      formData.append('billing_contact_email', seowerksData.billingContactEmail);
      formData.append('site_access_notes', seowerksData.siteAccessNotes);
      
      // Add arrays
      seowerksData.targetVehicleModels.forEach((model: string, index: number) => {
        formData.append(`target_vehicle_models[${index}]`, model);
      });
      
      seowerksData.targetCities.forEach((city: string, index: number) => {
        formData.append(`target_cities[${index}]`, city);
      });
      
      seowerksData.targetDealers.forEach((dealer: string, index: number) => {
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
        // Update database with success
        await supabaseAdmin
          .from('seoworks_onboarding_submissions')
          .update({
            submission_status: 'submitted',
            seoworks_submission_date: new Date().toISOString(),
            seoworks_error: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', id);

        res.json({ success: true, message: 'Successfully resubmitted to SEOWerks' });
      } else {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
    } catch (submitError) {
      // Update database with failure
      const errorMessage = submitError instanceof Error ? submitError.message : 'Unknown error';
      
      await supabaseAdmin
        .from('seoworks_onboarding_submissions')
        .update({
          submission_status: 'failed',
          seoworks_error: errorMessage,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      res.status(500).json({ error: 'Failed to submit to SEOWerks', details: errorMessage });
    }
  } catch (error) {
    console.error('Error retrying submission:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Mark a submission as processed
 */
router.post('/api/admin/seoworks-onboarding/:id/process', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id; // Assuming user info is attached by auth middleware

    const { error } = await supabaseAdmin
      .from('seoworks_onboarding_submissions')
      .update({
        submission_status: 'processed',
        processed_by: userId,
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({ error: 'Failed to update submission' });
    }

    res.json({ success: true, message: 'Submission marked as processed' });
  } catch (error) {
    console.error('Error updating submission:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Update admin notes for a submission
 */
router.patch('/api/admin/seoworks-onboarding/:id/notes', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { admin_notes } = req.body;

    const { error } = await supabaseAdmin
      .from('seoworks_onboarding_submissions')
      .update({
        admin_notes,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({ error: 'Failed to update notes' });
    }

    res.json({ success: true, message: 'Notes updated successfully' });
  } catch (error) {
    console.error('Error updating notes:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;