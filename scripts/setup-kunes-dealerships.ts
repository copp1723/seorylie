#!/usr/bin/env tsx

import { config } from 'dotenv';
import { db } from '../server/db';
import { dealerships, users, personas } from '../shared/schema';
import { eq } from 'drizzle-orm';

// Load environment variables
config();

/**
 * Kunes RV Dealership Data Setup Script
 * 
 * This script sets up all Kunes RV dealerships with their specific
 * locations, contact information, ADF email addresses, and personas.
 */

interface KunesLocation {
  name: string;
  address: string;
  phone: string;
  website: string;
  adfEmail: string;
  personaName: string;
}

const kunesLocations: KunesLocation[] = [
  {
    name: "Kunes RV of Fox Valley",
    address: "2615 W American Dr, Neenah, WI 54956",
    phone: "(920) 274-2102",
    website: "https://kunesrv.com/locations?dealer=kunes-rv-of-fox-valley",
    adfEmail: "crm_kunes-rv-fox-valley@localwerksmail.com",
    personaName: "Kelsey Brunner"
  },
  {
    name: "Kunes Freedom RV",
    address: "825 Addison Rd, Slinger, WI 53086",
    phone: "(262) 276-4541",
    website: "https://kunesrv.com/locations?dealer=kunes-freedom-rv",
    adfEmail: "crm_kunes-rv-freedom@localwerksmail.com",
    personaName: "Brianna Meyer"
  },
  {
    name: "Kunes RV of Elkhorn",
    address: "9 Deere Rd, Elkhorn, WI 53121",
    phone: "(262) 276-4530",
    website: "https://kunesrv.com/locations?dealer=kunes-rv-of-elkhorn",
    adfEmail: "crm_kunes-rv-elkhorn@localwerksmail.com",
    personaName: "Courtney Carlson"
  },
  {
    name: "Kunes RV of Frankfort",
    address: "20450 LaGrange Rd, Frankfort, IL 60423",
    phone: "(815) 464-7510",
    website: "https://www.terrysrv.net/",
    adfEmail: "crm_kunes-rv-frankfort@localwerksmail.com",
    personaName: "Alyssa Wozniak"
  },
  {
    name: "Kunes RV of Green Bay",
    address: "1751 Wildwood Dr, Suamico, WI 54173",
    phone: "(920) 238-8286",
    website: "https://kunesrv.com/locations?dealer=kunes-rv-of-green-bay",
    adfEmail: "crm_kunes-rv-green-bay@localwerksmail.com",
    personaName: "Sydney Hoffmann"
  },
  {
    name: "Kunes RV of LaCrosse",
    address: "306 N Holmen Dr, Holmen, WI 54636",
    phone: "(608) 390-1272",
    website: "https://kunesrv.com/locations?dealer=kunes-rv-of-lacrosse",
    adfEmail: "crm_kunes-rv-lacrosse@localwerksmail.com",
    personaName: "Rachel Schroeder"
  },
  {
    name: "Kunes RV Lake Mills",
    address: "County Road V, W7419 E Tyranena Park Rd, Lake Mills, WI 53551",
    phone: "(920) 274-2114",
    website: "https://kunesrv.com/locations/kunes-rv-of-lake-mills",
    adfEmail: "crm_kunes-rv-lake-mills@localwerksmail.com",
    personaName: "Emily Krueger"
  },
  {
    name: "Kunes RV Super Center",
    address: "8120 Frontage Rd, Sheboygan, WI 53081",
    phone: "(920) 274-2123",
    website: "https://kunesrv.com/locations?dealer=kunes-rv-of-sheboygan---south",
    adfEmail: "crm_kunes-rv-sheboygan-south@localwerksmail.com",
    personaName: "Natalie Becker"
  },
  {
    name: "Kunes RV of Sterling",
    address: "2502 Locust St, Sterling, IL 61081",
    phone: "(815) 301-0913",
    website: "https://kunesrv.com/locations?dealer=kunes-rv-of-sterling",
    adfEmail: "crm_kunes-rv-sterling@localwerksmail.com",
    personaName: "Taylor Lindgren"
  },
  {
    name: "Kunes Wisconsin RV World",
    address: "5920 Haase Rd, DeForest, Wisconsin 53532",
    phone: "(608) 396-4836",
    website: "https://kunesrv.com/locations?dealer=kunes-wisconsin-rv-world",
    adfEmail: "crm_kunes-rv-madison@localwerksmail.com",
    personaName: "Lauren Novak"
  },
  {
    name: "Kunes RV Wisconsin Rapids",
    address: "8410 State Hwy 13, Wisconsin Rapids, WI 54494",
    phone: "(715) 230-0164",
    website: "https://kunesrv.com/locations?dealer=kunes-rapids-rv",
    adfEmail: "crm_kunes-rv-wisconsin-rapids@localwerksmail.com",
    personaName: "Madison Thompson"
  }
];

function parseAddress(fullAddress: string) {
  // Extract city, state, zip from address string
  const addressParts = fullAddress.split(',').map(part => part.trim());
  
  if (addressParts.length >= 3) {
    const streetAddress = addressParts.slice(0, -2).join(', ');
    const cityState = addressParts[addressParts.length - 2];
    const stateZip = addressParts[addressParts.length - 1];
    
    // Extract state and zip from "STATE ZIP" format
    const stateZipMatch = stateZip.match(/^([A-Z]{2})\s+(\d{5})$/);
    
    return {
      address: streetAddress,
      city: cityState,
      state: stateZipMatch ? stateZipMatch[1] : 'WI',
      zip: stateZipMatch ? stateZipMatch[2] : '',
      country: 'USA'
    };
  }
  
  // Fallback if parsing fails
  return {
    address: fullAddress,
    city: '',
    state: 'WI',
    zip: '',
    country: 'USA'
  };
}

function generateSubdomain(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters except spaces and hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple consecutive hyphens with single hyphen
    .replace(/^-|-$/g, ''); // Remove leading and trailing hyphens
}

async function setupKunesDealerships() {
  try {
    console.log('🏢 Setting up Kunes RV Dealerships...\n');
    
    let createdCount = 0;
    let updatedCount = 0;
    let personaCount = 0;
    
    for (const location of kunesLocations) {
      console.log(`📍 Processing: ${location.name}`);
      
      // Parse address components
      const addressInfo = parseAddress(location.address);
      const subdomain = generateSubdomain(location.name);
      
      // Check if dealership already exists
      const existingDealership = await db.select().from(dealerships)
        .where(eq(dealerships.name, location.name))
        .limit(1);
      
      let dealershipId: number;
      
      if (existingDealership.length > 0) {
        // Update existing dealership
        dealershipId = existingDealership[0].id;
        await db.update(dealerships)
          .set({
            subdomain,
            contactEmail: location.adfEmail,
            contactPhone: location.phone,
            address: addressInfo.address,
            city: addressInfo.city,
            state: addressInfo.state,
            zip: addressInfo.zip,
            country: addressInfo.country,
            timezone: 'America/Chicago', // Central Time for Wisconsin/Illinois
            settings: {
              website: location.website,
              adfEmail: location.adfEmail,
              businessType: 'RV Dealership',
              brand: 'Kunes RV',
              primaryPersona: location.personaName
            },
            updatedAt: new Date()
          })
          .where(eq(dealerships.id, dealershipId));
        
        console.log(`   ✅ Updated existing dealership (ID: ${dealershipId})`);
        updatedCount++;
      } else {
        // Create new dealership
        const [newDealership] = await db.insert(dealerships).values({
          name: location.name,
          subdomain,
          contactEmail: location.adfEmail,
          contactPhone: location.phone,
          address: addressInfo.address,
          city: addressInfo.city,
          state: addressInfo.state,
          zip: addressInfo.zip,
          country: addressInfo.country,
          timezone: 'America/Chicago',
          isActive: true,
          settings: {
            website: location.website,
            adfEmail: location.adfEmail,
            businessType: 'RV Dealership',
            brand: 'Kunes RV',
            primaryPersona: location.personaName
          }
        }).returning();
        
        dealershipId = newDealership.id;
        console.log(`   ✨ Created new dealership (ID: ${dealershipId})`);
        createdCount++;
      }
      
      // Create or update persona for this dealership
      const existingPersona = await db.select().from(personas)
        .where(eq(personas.name, location.personaName))
        .limit(1);
      
      if (existingPersona.length === 0) {
        const [newPersona] = await db.insert(personas).values({
          name: location.personaName,
          role: 'Sales Associate',
          dealershipId,
          personality: `Friendly and knowledgeable RV sales associate at ${location.name}. Expert in recreational vehicles, camping, and outdoor lifestyle. Passionate about helping families find the perfect RV for their adventures.`,
          systemPrompt: `You are ${location.personaName}, a sales associate at ${location.name}. You specialize in RV sales and are knowledgeable about recreational vehicles, camping equipment, and outdoor lifestyle. You help customers find the perfect RV for their needs, whether it's for weekend getaways or full-time living. Always be helpful, friendly, and professional. When customers inquire about specific RVs or need assistance, provide detailed information and guide them through their decision-making process.`,
          settings: {
            tone: 'friendly',
            expertise: ['RV Sales', 'Camping', 'Outdoor Recreation', 'RV Maintenance'],
            dealership: location.name,
            location: addressInfo.city + ', ' + addressInfo.state
          },
          isActive: true
        }).returning();
        
        console.log(`   👤 Created persona: ${location.personaName}`);
        personaCount++;
      } else {
        console.log(`   👤 Persona already exists: ${location.personaName}`);
      }
      
      // Display summary for this location
      console.log(`   📧 ADF Email: ${location.adfEmail}`);
      console.log(`   🌐 Website: ${location.website}`);
      console.log(`   📞 Phone: ${location.phone}`);
      console.log('');
    }
    
    // Final summary
    console.log('🎉 Kunes RV Setup Complete!');
    console.log('================================');
    console.log(`📊 Total locations processed: ${kunesLocations.length}`);
    console.log(`✨ New dealerships created: ${createdCount}`);
    console.log(`🔄 Existing dealerships updated: ${updatedCount}`);
    console.log(`👤 New personas created: ${personaCount}`);
    console.log('');
    
    if (createdCount > 0 || updatedCount > 0) {
      console.log('💡 Next Steps:');
      console.log('   1. Verify dealership settings in the admin panel');
      console.log('   2. Test ADF email processing for each location');
      console.log('   3. Configure persona prompts if needed');
      console.log('   4. Set up any location-specific integrations');
    }
    
  } catch (error) {
    console.error('❌ Error setting up Kunes dealerships:', error);
    process.exit(1);
  }
}

// Run the setup if this script is executed directly
if (require.main === module) {
  setupKunesDealerships()
    .then(() => {
      console.log('✅ Setup completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Setup failed:', error);
      process.exit(1);
    });
}

export { setupKunesDealerships, kunesLocations };