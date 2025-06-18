/**
 * Onboarding Task Creator Service
 * Automatically creates initial SEOWerks tasks based on package selection
 */

import { supabase } from '../supabase';
import { v4 as uuidv4 } from 'uuid';

interface OnboardingData {
  id: string;
  business_name: string;
  package: 'PLATINUM' | 'GOLD' | 'SILVER';
  main_brand: string;
  target_vehicle_models: string[];
  target_cities: string[];
  contact_name: string;
  email: string;
  website_url: string;
}

interface TaskTemplate {
  type: 'landing_page' | 'blog_post' | 'gbp_post' | 'maintenance';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  estimatedHours: number;
}

// Package-based task configurations
const PACKAGE_TASKS: Record<string, TaskTemplate[]> = {
  PLATINUM: [
    {
      type: 'landing_page',
      title: 'Welcome & Brand Overview Page',
      description: 'Create comprehensive dealership welcome page with brand story',
      priority: 'high',
      estimatedHours: 4
    },
    {
      type: 'landing_page',
      title: 'New Vehicle Inventory Landing Page',
      description: 'Showcase current inventory with advanced filtering',
      priority: 'high',
      estimatedHours: 6
    },
    {
      type: 'blog_post',
      title: 'Top 10 Features of Latest Models',
      description: 'In-depth review of newest vehicle features and technology',
      priority: 'medium',
      estimatedHours: 3
    },
    {
      type: 'gbp_post',
      title: 'Grand Opening Announcement',
      description: 'Google Business Profile post for dealership launch',
      priority: 'high',
      estimatedHours: 1
    },
    {
      type: 'maintenance',
      title: 'Initial SEO Audit & Setup',
      description: 'Complete technical SEO audit and initial optimizations',
      priority: 'high',
      estimatedHours: 8
    }
  ],
  GOLD: [
    {
      type: 'landing_page',
      title: 'Dealership Homepage Optimization',
      description: 'Optimize main landing page for local SEO',
      priority: 'high',
      estimatedHours: 4
    },
    {
      type: 'landing_page',
      title: 'Service Department Page',
      description: 'Create dedicated service and maintenance page',
      priority: 'medium',
      estimatedHours: 4
    },
    {
      type: 'blog_post',
      title: 'Why Choose Our Dealership',
      description: 'Blog post highlighting dealership advantages',
      priority: 'medium',
      estimatedHours: 2
    },
    {
      type: 'gbp_post',
      title: 'Special Offers This Month',
      description: 'Google Business Profile post for current promotions',
      priority: 'high',
      estimatedHours: 1
    },
    {
      type: 'maintenance',
      title: 'Website Speed Optimization',
      description: 'Improve page load times and Core Web Vitals',
      priority: 'medium',
      estimatedHours: 4
    }
  ],
  SILVER: [
    {
      type: 'landing_page',
      title: 'Contact & Directions Page',
      description: 'Optimize contact page with schema markup',
      priority: 'high',
      estimatedHours: 2
    },
    {
      type: 'blog_post',
      title: 'Welcome to Our Dealership',
      description: 'Introduction blog post for new customers',
      priority: 'medium',
      estimatedHours: 2
    },
    {
      type: 'gbp_post',
      title: 'Now Open for Business',
      description: 'Google Business Profile announcement post',
      priority: 'high',
      estimatedHours: 1
    },
    {
      type: 'maintenance',
      title: 'Basic SEO Setup',
      description: 'Initial meta tags and sitemap configuration',
      priority: 'high',
      estimatedHours: 3
    }
  ]
};

/**
 * Create initial tasks for a new onboarding submission
 */
export async function createOnboardingTasks(onboardingId: string): Promise<{
  success: boolean;
  taskCount: number;
  error?: string;
}> {
  try {
    // Fetch onboarding data
    const { data: onboarding, error: fetchError } = await supabase
      .from('seoworks_onboarding_submissions')
      .select('*')
      .eq('id', onboardingId)
      .single();

    if (fetchError || !onboarding) {
      return { success: false, taskCount: 0, error: 'Onboarding submission not found' };
    }

    // Create a dealership record if it doesn't exist
    const { data: dealership, error: dealershipError } = await supabase
      .from('dealerships')
      .upsert({
        name: onboarding.business_name,
        website: onboarding.website_url,
        address: `${onboarding.address}, ${onboarding.city}, ${onboarding.state} ${onboarding.zip_code}`,
        phone: onboarding.phone,
        primary_contact_name: onboarding.contact_name,
        primary_contact_email: onboarding.email,
        package_tier: onboarding.package,
        // For now, assign to a default agency - in production, this would be determined by routing logic
        agency_id: 'default-agency-id',
        created_at: new Date().toISOString()
      }, {
        onConflict: 'website',
        returning: true
      })
      .single();

    if (dealershipError || !dealership) {
      console.error('Failed to create dealership:', dealershipError);
      return { success: false, taskCount: 0, error: 'Failed to create dealership record' };
    }

    // Get task templates based on package
    const taskTemplates = PACKAGE_TASKS[onboarding.package] || PACKAGE_TASKS.SILVER;

    // Create tasks
    const tasks = taskTemplates.map((template, index) => ({
      id: uuidv4(),
      dealership_id: dealership.id,
      agency_id: dealership.agency_id,
      type: template.type,
      status: 'submitted',
      priority: template.priority,
      title: template.title,
      description: template.description,
      parameters: {
        brand: onboarding.main_brand,
        targetCities: onboarding.target_cities || [],
        targetVehicles: onboarding.target_vehicle_models || [],
        websiteUrl: onboarding.website_url,
        estimatedHours: template.estimatedHours,
        onboardingId: onboardingId
      },
      // Stagger due dates based on priority and index
      due_date: new Date(
        Date.now() + 
        (template.priority === 'high' ? 7 : template.priority === 'medium' ? 14 : 21) * 24 * 60 * 60 * 1000 +
        (index * 24 * 60 * 60 * 1000) // Add 1 day for each subsequent task
      ).toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    // Insert tasks
    const { data: insertedTasks, error: insertError } = await supabase
      .from('tasks')
      .insert(tasks)
      .select();

    if (insertError) {
      console.error('Failed to create tasks:', insertError);
      return { success: false, taskCount: 0, error: 'Failed to create tasks' };
    }

    // Update onboarding submission with task creation info
    await supabase
      .from('seoworks_onboarding_submissions')
      .update({
        processed_at: new Date().toISOString(),
        submission_status: 'processed',
        admin_notes: `Auto-created ${insertedTasks.length} initial tasks based on ${onboarding.package} package`
      })
      .eq('id', onboardingId);

    // Log activity
    await supabase
      .from('activity_logs')
      .insert({
        action: 'onboarding_tasks_created',
        entity_type: 'onboarding',
        entity_id: onboardingId,
        metadata: {
          dealership_id: dealership.id,
          package: onboarding.package,
          task_count: insertedTasks.length,
          task_ids: insertedTasks.map(t => t.id)
        }
      });

    console.log(`Created ${insertedTasks.length} tasks for ${onboarding.business_name} (${onboarding.package} package)`);

    return {
      success: true,
      taskCount: insertedTasks.length
    };

  } catch (error) {
    console.error('Error creating onboarding tasks:', error);
    return {
      success: false,
      taskCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Process all pending onboarding submissions
 */
export async function processPendingOnboardings(): Promise<{
  processed: number;
  failed: number;
}> {
  try {
    // Find all pending or submitted onboardings that haven't been processed
    const { data: pendingOnboardings, error } = await supabase
      .from('seoworks_onboarding_submissions')
      .select('id, business_name, package')
      .in('submission_status', ['pending', 'submitted'])
      .is('processed_at', null);

    if (error || !pendingOnboardings) {
      console.error('Failed to fetch pending onboardings:', error);
      return { processed: 0, failed: 0 };
    }

    let processed = 0;
    let failed = 0;

    for (const onboarding of pendingOnboardings) {
      console.log(`Processing onboarding for ${onboarding.business_name}...`);
      const result = await createOnboardingTasks(onboarding.id);
      
      if (result.success) {
        processed++;
      } else {
        failed++;
        console.error(`Failed to process onboarding ${onboarding.id}:`, result.error);
      }
    }

    console.log(`Processed ${processed} onboardings, ${failed} failed`);
    return { processed, failed };

  } catch (error) {
    console.error('Error processing pending onboardings:', error);
    return { processed: 0, failed: 0 };
  }
}