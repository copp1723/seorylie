import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';

// Service account credentials path
const SERVICE_ACCOUNT_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS || 
  path.join(process.cwd(), 'credentials', 'ga4-service-account.json');

// Google Analytics scope
const SCOPES = ['https://www.googleapis.com/auth/analytics.readonly'];

interface ServiceAccountCredentials {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
}

export class GA4AuthService {
  private auth: any;
  private credentials: ServiceAccountCredentials | null = null;

  constructor() {
    this.initializeAuth();
  }

  private initializeAuth() {
    try {
      // Check if service account file exists
      if (fs.existsSync(SERVICE_ACCOUNT_PATH)) {
        const credentialsJson = fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8');
        this.credentials = JSON.parse(credentialsJson);

        // Create auth client
        this.auth = new google.auth.GoogleAuth({
          credentials: this.credentials,
          scopes: SCOPES
        });

        console.log('GA4 authentication initialized with service account');
      } else {
        console.warn('GA4 service account credentials not found at:', SERVICE_ACCOUNT_PATH);
        console.warn('GA4 analytics will use mock data until credentials are configured');
      }
    } catch (error) {
      console.error('Failed to initialize GA4 authentication:', error);
    }
  }

  async getAuthClient() {
    if (!this.auth) {
      throw new Error('GA4 authentication not initialized');
    }
    return await this.auth.getClient();
  }

  isConfigured(): boolean {
    return this.credentials !== null;
  }

  getProjectId(): string | null {
    return this.credentials?.project_id || null;
  }

  // Helper to set up credentials
  static async setupCredentials(credentialsJson: string): Promise<void> {
    try {
      // Parse to validate JSON
      const credentials = JSON.parse(credentialsJson);
      
      // Create credentials directory if it doesn't exist
      const credentialsDir = path.join(process.cwd(), 'credentials');
      if (!fs.existsSync(credentialsDir)) {
        fs.mkdirSync(credentialsDir, { recursive: true });
      }

      // Write credentials file
      fs.writeFileSync(SERVICE_ACCOUNT_PATH, credentialsJson);
      
      console.log('GA4 service account credentials saved successfully');
    } catch (error) {
      throw new Error(`Failed to setup GA4 credentials: ${error}`);
    }
  }
}

export const ga4Auth = new GA4AuthService();