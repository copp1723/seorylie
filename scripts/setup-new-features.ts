/**
 * Setup script to create database tables for new features
 */
import { db } from '../server/db';
import { eq } from 'drizzle-orm';
import { dealerships } from '../shared/schema';
import { 
  escalationTriggers, 
  leadScores, 
  followUps, 
  userInvitations, 
  auditLogs, 
  customerProfiles, 
  customerInteractions 
} from '../shared/schema-extensions';

async function setupNewFeatures() {
  console.log('Setting up new feature tables...');
  
  try {
    // Create all new tables
    await db.execute(`
      CREATE TABLE IF NOT EXISTS escalation_triggers (
        id SERIAL PRIMARY KEY,
        dealership_id INTEGER NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        conditions JSONB DEFAULT '[]',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS trigger_dealership_idx ON escalation_triggers(dealership_id);
      
      CREATE TABLE IF NOT EXISTS lead_scores (
        id SERIAL PRIMARY KEY,
        conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        score INTEGER NOT NULL,
        factors JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(conversation_id)
      );
      
      CREATE INDEX IF NOT EXISTS score_conversation_idx ON lead_scores(conversation_id);
      
      CREATE TABLE IF NOT EXISTS follow_ups (
        id SERIAL PRIMARY KEY,
        conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        dealership_id INTEGER NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
        customer_name VARCHAR(255) NOT NULL,
        customer_contact VARCHAR(255),
        assigned_to INTEGER REFERENCES users(id),
        scheduled_time TIMESTAMP NOT NULL,
        notes TEXT,
        status VARCHAR(50) DEFAULT 'scheduled',
        completed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS followup_dealership_idx ON follow_ups(dealership_id);
      CREATE INDEX IF NOT EXISTS followup_assigned_idx ON follow_ups(assigned_to);
      
      CREATE TABLE IF NOT EXISTS user_invitations (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        dealership_id INTEGER REFERENCES dealerships(id) ON DELETE CASCADE,
        invited_by INTEGER REFERENCES users(id),
        token VARCHAR(255) NOT NULL UNIQUE,
        expires_at TIMESTAMP NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS invitation_dealership_idx ON user_invitations(dealership_id);
      CREATE INDEX IF NOT EXISTS invitation_email_idx ON user_invitations(email);
      
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        dealership_id INTEGER REFERENCES dealerships(id),
        action VARCHAR(255) NOT NULL,
        resource_type VARCHAR(100),
        resource_id INTEGER,
        details JSONB DEFAULT '{}',
        ip_address VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS audit_user_idx ON audit_logs(user_id);
      CREATE INDEX IF NOT EXISTS audit_dealership_idx ON audit_logs(dealership_id);
      
      CREATE TABLE IF NOT EXISTS customer_profiles (
        id SERIAL PRIMARY KEY,
        dealership_id INTEGER NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
        customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
        name VARCHAR(255),
        email VARCHAR(255),
        phone VARCHAR(50),
        preferences JSONB DEFAULT '{}',
        buying_timeline VARCHAR(100),
        last_interaction TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS profile_dealership_idx ON customer_profiles(dealership_id);
      CREATE INDEX IF NOT EXISTS profile_customer_idx ON customer_profiles(customer_id);
      
      CREATE TABLE IF NOT EXISTS customer_interactions (
        id SERIAL PRIMARY KEY,
        profile_id INTEGER REFERENCES customer_profiles(id) ON DELETE CASCADE,
        conversation_id INTEGER REFERENCES conversations(id),
        interaction_type VARCHAR(50) NOT NULL,
        details JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS interaction_profile_idx ON customer_interactions(profile_id);
    `);
    
    console.log('Successfully created all new feature tables');
    
    // Add default escalation triggers for each dealership
    const dealershipsList = await db.select().from(dealerships);
    
    for (const dealership of dealershipsList) {
      // Check if dealership already has triggers
      const existingTriggers = await db.select()
        .from(escalationTriggers)
        .where(eq(escalationTriggers.dealershipId, dealership.id));
      
      if (existingTriggers.length === 0) {
        // Add default triggers
        await db.insert(escalationTriggers).values([
          {
            dealershipId: dealership.id,
            name: 'Negative Sentiment',
            description: 'Escalate when customer shows negative sentiment',
            conditions: [{ type: 'sentiment', threshold: 0.3, value: 'negative' }],
            isActive: true
          },
          {
            dealershipId: dealership.id,
            name: 'Urgent Request',
            description: 'Escalate when customer expresses urgency',
            conditions: [{ 
              type: 'keyword', 
              value: ['urgent', 'immediately', 'asap', 'right now', 'today'] 
            }],
            isActive: true
          },
          {
            dealershipId: dealership.id,
            name: 'Repeated Questions',
            description: 'Escalate when customer repeats questions multiple times',
            conditions: [{ type: 'repeated_questions', threshold: 2, value: 2 }],
            isActive: true
          },
          {
            dealershipId: dealership.id,
            name: 'Human Request',
            description: 'Escalate when customer explicitly asks for a human',
            conditions: [{ 
              type: 'keyword', 
              value: ['speak to a human', 'talk to a person', 'real person', 'human agent', 'sales rep'] 
            }],
            isActive: true
          }
        ]);
        
        console.log(`Added default escalation triggers for dealership: ${dealership.name}`);
      }
    }
    
    console.log('Setup complete!');
    
  } catch (error) {
    console.error('Error setting up new features:', error);
    throw error;
  }
}

// Run the setup if this script is executed directly
if (require.main === module) {
  setupNewFeatures().then(() => {
    console.log('New features setup completed successfully');
    process.exit(0);
  }).catch(error => {
    console.error('Failed to set up new features:', error);
    process.exit(1);
  });
}

export { setupNewFeatures };