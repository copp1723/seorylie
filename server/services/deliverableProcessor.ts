/**
 * Deliverable Processor Service
 * Handles file uploads, branding transformation, and storage for SEOWerks deliverables
 */

import { supabase } from '../supabase';
import { transformFile } from './brandingTransformer';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

interface ProcessingResult {
  success: boolean;
  deliverableId?: string;
  publicUrl?: string;
  error?: string;
}

/**
 * Process a deliverable file uploaded by SEOWerks
 * @param taskId - The ID of the task associated with the deliverable
 * @param file - The uploaded file object
 * @param uploadedBy - The user ID who uploaded the file
 */
export async function processDeliverable(
  taskId: string,
  file: Express.Multer.File,
  uploadedBy: string
): Promise<ProcessingResult> {
  const deliverableId = uuidv4();
  let tempProcessedPath: string | null = null;

  try {
    // 1. Fetch task and agency information
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select(`
        *,
        dealerships (
          id,
          name,
          agency_id
        )
      `)
      .eq('id', taskId)
      .single();

    if (taskError || !task) {
      return { success: false, error: 'Task not found' };
    }

    const agencyId = task.dealerships?.agency_id || task.agency_id;
    if (!agencyId) {
      return { success: false, error: 'Agency ID not found for task' };
    }

    // 2. Create deliverable record with 'processing' status
    const { error: insertError } = await supabase
      .from('deliverables')
      .insert({
        id: deliverableId,
        task_id: taskId,
        file_name: file.originalname,
        file_type: path.extname(file.originalname).substring(1),
        file_size: file.size,
        mime_type: file.mimetype,
        processing_status: 'processing',
        processing_started_at: new Date().toISOString(),
        uploaded_by: uploadedBy
      });

    if (insertError) {
      console.error('Failed to create deliverable record:', insertError);
      return { success: false, error: 'Failed to create deliverable record' };
    }

    // 3. Upload original file to Supabase Storage (SEOWerks version)
    const originalPath = `seoworks/original/${taskId}/${file.originalname}`;
    const fileBuffer = fs.readFileSync(file.path);
    
    const { error: uploadError } = await supabase.storage
      .from('deliverables')
      .upload(originalPath, fileBuffer, {
        contentType: file.mimetype,
        upsert: true
      });

    if (uploadError) {
      console.error('Failed to upload original file:', uploadError);
      throw new Error('Failed to upload original file');
    }

    // Update deliverable with original path
    await supabase
      .from('deliverables')
      .update({ original_path: originalPath })
      .eq('id', deliverableId);

    // 4. Transform file with agency branding
    tempProcessedPath = path.join('/tmp', `processed-${deliverableId}-${file.originalname}`);
    const transformResult = await transformFile(file.path, tempProcessedPath, agencyId);

    if (!transformResult.success) {
      throw new Error(transformResult.error || 'Failed to transform file');
    }

    // 5. Upload processed file to agency-specific location
    const processedPath = `agencies/${agencyId}/deliverables/${taskId}/${file.originalname}`;
    const processedBuffer = fs.readFileSync(tempProcessedPath);

    const { error: processedUploadError } = await supabase.storage
      .from('deliverables')
      .upload(processedPath, processedBuffer, {
        contentType: file.mimetype,
        upsert: true
      });

    if (processedUploadError) {
      console.error('Failed to upload processed file:', processedUploadError);
      throw new Error('Failed to upload processed file');
    }

    // 6. Get public URL for the processed file
    const { data: urlData } = supabase.storage
      .from('deliverables')
      .getPublicUrl(processedPath);

    const publicUrl = urlData.publicUrl;

    // 7. Update deliverable record with success
    const { error: updateError } = await supabase
      .from('deliverables')
      .update({
        processed_path: processedPath,
        processing_status: 'completed',
        processing_completed_at: new Date().toISOString()
      })
      .eq('id', deliverableId);

    if (updateError) {
      console.error('Failed to update deliverable record:', updateError);
    }

    // 8. Update task status if needed
    await supabase
      .from('tasks')
      .update({
        status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('id', taskId);

    // 9. Log activity
    await supabase
      .from('activity_logs')
      .insert({
        user_id: uploadedBy,
        action: 'deliverable_uploaded',
        entity_type: 'deliverable',
        entity_id: deliverableId,
        metadata: {
          task_id: taskId,
          file_name: file.originalname,
          file_size: file.size,
          agency_id: agencyId
        }
      });

    return {
      success: true,
      deliverableId,
      publicUrl
    };

  } catch (error) {
    console.error('Error processing deliverable:', error);

    // Update deliverable record with error
    await supabase
      .from('deliverables')
      .update({
        processing_status: 'failed',
        processing_error: error.message || 'Unknown error',
        processing_completed_at: new Date().toISOString()
      })
      .eq('id', deliverableId);

    return {
      success: false,
      error: error.message || 'Failed to process deliverable'
    };

  } finally {
    // Cleanup temporary files
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
    if (tempProcessedPath && fs.existsSync(tempProcessedPath)) {
      fs.unlinkSync(tempProcessedPath);
    }
  }
}

/**
 * Get deliverables for a specific agency
 * @param agencyId - The agency ID to fetch deliverables for
 * @param limit - Maximum number of deliverables to return
 * @param offset - Offset for pagination
 */
export async function getAgencyDeliverables(
  agencyId: string,
  limit: number = 50,
  offset: number = 0
) {
  const { data, error } = await supabase
    .from('deliverables')
    .select(`
      *,
      tasks!inner (
        id,
        type,
        status,
        dealerships!inner (
          id,
          name,
          agency_id
        )
      )
    `)
    .eq('tasks.dealerships.agency_id', agencyId)
    .eq('processing_status', 'completed')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('Error fetching agency deliverables:', error);
    return { success: false, error: error.message, data: [] };
  }

  return { success: true, data };
}

/**
 * Get deliverable download URL
 * @param deliverableId - The deliverable ID
 * @param agencyId - The requesting agency ID (for access control)
 */
export async function getDeliverableDownloadUrl(
  deliverableId: string,
  agencyId: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  // Fetch deliverable with agency check
  const { data: deliverable, error } = await supabase
    .from('deliverables')
    .select(`
      *,
      tasks!inner (
        dealerships!inner (
          agency_id
        )
      )
    `)
    .eq('id', deliverableId)
    .eq('tasks.dealerships.agency_id', agencyId)
    .single();

  if (error || !deliverable) {
    return { success: false, error: 'Deliverable not found or access denied' };
  }

  if (!deliverable.processed_path) {
    return { success: false, error: 'Deliverable not yet processed' };
  }

  // Generate a temporary signed URL (valid for 1 hour)
  const { data, error: urlError } = await supabase.storage
    .from('deliverables')
    .createSignedUrl(deliverable.processed_path, 3600);

  if (urlError || !data) {
    return { success: false, error: 'Failed to generate download URL' };
  }

  // Log download activity
  await supabase
    .from('activity_logs')
    .insert({
      action: 'deliverable_downloaded',
      entity_type: 'deliverable',
      entity_id: deliverableId,
      metadata: {
        agency_id: agencyId,
        file_name: deliverable.file_name
      }
    });

  return { success: true, url: data.signedUrl };
}