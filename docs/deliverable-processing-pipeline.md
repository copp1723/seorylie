# Deliverable Processing Pipeline

## Overview

The Deliverable Processing Pipeline is a complete system for handling SEOWerks deliverables, transforming them with agency branding, and providing secure access to agencies. This maintains the white-label nature of RylieSEO where agencies never see SEOWerks branding.

## Architecture

```
SEOWerks Upload → Processing Pipeline → Agency Download
     ↓                    ↓                    ↓
Original Files    Brand Transform      Branded Files
(Private)         (Automated)          (Agency Access)
```

## Components

### 1. Branding Transformer Service (`/server/services/brandingTransformer.ts`)

Handles automatic transformation of files by:
- **PDF Files**: Removes SEOWerks headers/footers, adds agency branding
- **HTML Files**: Replaces text, logos, colors, and contact information
- **DOCX Files**: Updates document properties, headers, footers, and content

Key features:
- Fetches agency branding from database
- Supports custom colors, logos, and contact info
- Preserves document structure and formatting
- Handles multiple file types seamlessly

### 2. Deliverable Processor (`/server/services/deliverableProcessor.ts`)

Core processing engine that:
- Receives uploaded files from SEOWerks team
- Stores original files securely (SEOWerks access only)
- Triggers branding transformation
- Stores processed files in agency-specific locations
- Updates task and deliverable records
- Logs all activities for audit trail

Storage structure:
```
deliverables/
├── seoworks/original/          # Original files (SEOWerks only)
│   └── {taskId}/
│       └── {filename}
└── agencies/                   # Processed files (Agency access)
    └── {agencyId}/
        └── deliverables/
            └── {taskId}/
                └── {filename}
```

### 3. Deliverables API (`/server/routes/deliverables.ts`)

RESTful API endpoints:

#### SEOWerks Endpoints (Protected)
- `POST /api/deliverables/upload/:taskId` - Upload deliverable for a task
- `GET /api/deliverables/task/:taskId` - Get deliverables for a task

#### Agency Endpoints (Protected)
- `GET /api/deliverables/agency/:agencyId` - List agency deliverables
- `GET /api/deliverables/:deliverableId/download` - Get signed download URL

### 4. Agency Deliverables Page (`/client/src/pages/agency/deliverables.tsx`)

User-friendly interface for agencies featuring:
- Filterable list of deliverables
- Search by file name or dealership
- Download functionality with signed URLs
- Real-time status updates
- File type icons and metadata display

## Workflow

### Upload Flow (SEOWerks Team)

1. **Task Completion**: SEOWerks team member completes work
2. **File Upload**: Uploads deliverable via queue dashboard
3. **Processing**: System automatically:
   - Creates deliverable record
   - Stores original file
   - Transforms with agency branding
   - Stores processed version
   - Updates task status
4. **Notification**: Agency notified of new deliverable

### Download Flow (Agency)

1. **Access Portal**: Agency user navigates to deliverables page
2. **Browse Files**: Views filtered list of completed deliverables
3. **Download**: Clicks download to receive branded file
4. **Audit**: System logs download activity

## Security

### Access Control
- **SEOWerks Team**: Can upload and view all deliverables
- **Agencies**: Can only view/download their own branded deliverables
- **Original Files**: Never accessible to agencies

### Storage Security
- Row Level Security (RLS) policies on deliverables table
- Signed URLs for downloads (1-hour expiration)
- Separate storage paths for original vs. processed files

## File Type Support

### Currently Supported
- **PDF**: Full header/footer replacement, metadata updates
- **HTML**: Complete branding transformation with CSS
- **DOCX**: Document properties and content updates

### Planned Support
- **Images**: Watermark replacement
- **Presentations**: Slide template updates
- **Spreadsheets**: Header/footer branding

## Configuration

### Agency Branding Setup

Agencies need the following configured in `agency_branding` table:
- `logo_url`: URL to agency logo
- `primary_color`: Hex color for primary branding
- `secondary_color`: Hex color for secondary elements
- Contact information in `agencies` table

### Environment Variables

```env
# Supabase configuration
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key

# Storage bucket name
STORAGE_BUCKET=deliverables
```

## Installation

1. Install dependencies:
```bash
./scripts/install-branding-deps.sh
```

2. Run migrations:
```bash
npm run migrate
```

3. Configure Supabase Storage:
   - Create `deliverables` bucket
   - Set up RLS policies
   - Configure CORS for downloads

## Testing

### Manual Testing

1. **Upload Test**:
   - Login as SEOWerks team member
   - Navigate to queue dashboard
   - Complete a task and upload file
   - Verify processing status

2. **Download Test**:
   - Login as agency user
   - Navigate to deliverables page
   - Download processed file
   - Verify branding applied correctly

### Automated Tests

```bash
# Test branding transformer
npm test -- brandingTransformer.test.ts

# Test deliverable processor
npm test -- deliverableProcessor.test.ts

# Test API endpoints
npm test -- deliverables.test.ts
```

## Monitoring

### Key Metrics
- Upload success rate
- Processing time by file type
- Download frequency by agency
- Storage usage trends

### Error Handling
- Failed uploads retry automatically
- Processing errors logged with context
- Agencies see user-friendly error messages

## Future Enhancements

1. **Batch Processing**: Upload multiple files at once
2. **Preview Generation**: Thumbnail previews for files
3. **Version Control**: Track deliverable versions
4. **Email Notifications**: Notify agencies of new deliverables
5. **Advanced Branding**: Custom templates per file type
6. **API Integration**: Webhook for external systems

## Troubleshooting

### Common Issues

1. **Processing Fails**:
   - Check agency branding configuration
   - Verify file type is supported
   - Check storage permissions

2. **Download Errors**:
   - Verify agency has access
   - Check if file exists in storage
   - Ensure signed URL hasn't expired

3. **Branding Not Applied**:
   - Confirm branding data in database
   - Check transformer logs for errors
   - Verify file format compatibility

### Debug Commands

```bash
# Check processing status
SELECT * FROM deliverables WHERE task_id = 'task-uuid';

# View agency branding
SELECT * FROM agency_branding WHERE agency_id = 'agency-uuid';

# Check storage files
SELECT * FROM storage.objects WHERE bucket_id = 'deliverables';
```