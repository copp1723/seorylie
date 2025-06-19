#!/usr/bin/env node

// Node.js version of client domain setup
import pkg from 'pg';
const { Pool } = pkg;

async function setupClientDomain() {
  const args = process.argv.slice(2);
  
  if (args.length < 5) {
    console.log('Usage: node setup-client-domain-node.js <client_name> <client_domain> <professional_email> <gmail_address> <dealership_id>');
    console.log('Example: node setup-client-domain-node.js "Kunes RV Fox Valley" "kunesrvfox.com" "kelseyb@kunesrvfox.com" "rylieai1234@gmail.com" 2');
    process.exit(1);
  }

  const [clientName, clientDomain, professionalEmail, gmailAddress, dealershipId] = args;
  const gmailPassword = process.env.GMAIL_APP_PASSWORD || 'yyym ukwm halz fzwo';

  console.log('🎯 Setting up client:', clientName);
  console.log('Domain:', clientDomain);
  console.log('Professional Email:', professionalEmail);
  console.log('Gmail (IMAP):', gmailAddress);
  console.log('Dealership ID:', dealershipId);
  console.log('');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('📝 Updating database configuration...');
    
    const updateQuery = `
      UPDATE dealerships
      SET
        name = $1::text,
        contact_email = $2::text,
        settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object(
          'email', jsonb_build_object(
            'fromEmail', $2::text,
            'fromName', $1::text,
            'replyTo', $2::text,
            'domain', $3::text,
            'verified', false
          ),
          'imap', jsonb_build_object(
            'host', 'imap.gmail.com',
            'port', 993,
            'user', $4::text,
            'password', $5::text,
            'tls', true,
            'markSeen', true,
            'pollingInterval', 300,
            'provider', 'gmail'
          )
        ),
        operation_mode = 'rylie_ai',
        updated_at = NOW()
      WHERE id = $6::integer
      RETURNING id, name, contact_email;
    `;

    const result = await pool.query(updateQuery, [
      clientName,
      professionalEmail, 
      clientDomain,
      gmailAddress,
      gmailPassword,
      parseInt(dealershipId)
    ]);

    if (result.rows.length === 0) {
      console.error('❌ No dealership found with ID:', dealershipId);
      process.exit(1);
    }

    console.log('✅ Database updated successfully!');
    console.log('Updated dealership:', result.rows[0]);
    console.log('');

    // Verify the configuration
    console.log('🔍 Verifying configuration...');
    const verifyQuery = `
      SELECT 
        id,
        name,
        contact_email,
        settings->'email' as email_config,
        settings->'imap' as imap_config,
        operation_mode
      FROM dealerships 
      WHERE id = $1;
    `;

    const verification = await pool.query(verifyQuery, [parseInt(dealershipId)]);
    
    if (verification.rows.length > 0) {
      const config = verification.rows[0];
      console.log('✅ Configuration verified:');
      console.log('  Name:', config.name);
      console.log('  Contact Email:', config.contact_email);
      console.log('  From Email:', config.email_config?.fromEmail);
      console.log('  IMAP Host:', config.imap_config?.host);
      console.log('  IMAP User:', config.imap_config?.user);
      console.log('  Operation Mode:', config.operation_mode);
    }

    console.log('');
    console.log('🚀 Next steps:');
    console.log('1. Set up email forwarding in Namecheap:');
    console.log(`   kelseyb@kunesrvfox.com → rylieai1234@gmail.com`);
    console.log('');
    console.log('2. Configure SendGrid domain authentication:');
    console.log('   - Add kunesrvfox.com to SendGrid');
    console.log('   - Get DNS records');
    console.log('   - Add DNS records to Namecheap');
    console.log('');
    console.log('3. Test email flow:');
    console.log('   - Send test ADF to kelseyb@kunesrvfox.com');
    console.log('   - Verify CleanRylie processes it');
    console.log('');
    console.log('✅ Setup completed successfully!');

  } catch (error) {
    console.error('❌ Error setting up client:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

setupClientDomain();
