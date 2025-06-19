# Rylie AI Database Setup Documentation

## Overview

Rylie AI uses a PostgreSQL database with Drizzle ORM for schema management and database interactions. This document outlines the database structure, tables, relationships, and core functionality to help with setup and maintenance.

## Database Configuration

Rylie AI supports two database configurations:

1. **Production Database**: Named "rylie" by default
2. **Test Database**: Named "rylie_test" for development and testing

The database connection is configured through the `DATABASE_URL` environment variable:

```
DATABASE_URL=postgresql://username:password@hostname:port/database_name
```

Where `database_name` should be either "rylie" for production or "rylie_test" for development/testing environments.

## Database Schema

The database consists of several interconnected tables that store all the necessary data for the Rylie AI platform:

### Users

The `users` table stores information about all users who have access to the platform.

| Column       | Type      | Description                                |
| ------------ | --------- | ------------------------------------------ |
| id           | Serial    | Primary key                                |
| username     | Text      | Unique username for authentication         |
| password     | Text      | Hashed password                            |
| name         | Text      | User's full name                           |
| email        | Text      | User's email address (unique)              |
| role         | Text      | User role (admin, user, etc.)              |
| dealershipId | Integer   | Foreign key reference to dealerships table |
| createdAt    | Timestamp | Record creation timestamp                  |

### Dealerships

The `dealerships` table stores information about automotive dealerships in the system.

| Column        | Type      | Description               |
| ------------- | --------- | ------------------------- |
| id            | Serial    | Primary key               |
| name          | Text      | Dealership name           |
| location      | Text      | Physical address          |
| contactEmail  | Text      | Primary contact email     |
| contactPhone  | Text      | Primary contact phone     |
| domain        | Text      | Website domain            |
| handoverEmail | Text      | Email for lead handovers  |
| createdAt     | Timestamp | Record creation timestamp |

### Vehicles

The `vehicles` table stores the vehicle inventory for each dealership. This data is updated daily via TSV file imports.

| Column        | Type      | Description                                      |
| ------------- | --------- | ------------------------------------------------ |
| id            | Serial    | Primary key                                      |
| dealershipId  | Integer   | Foreign key reference to dealerships table       |
| vin           | Text      | Vehicle Identification Number (unique)           |
| stockNumber   | Text      | Dealer's stock number                            |
| make          | Text      | Vehicle manufacturer                             |
| model         | Text      | Vehicle model                                    |
| year          | Integer   | Model year                                       |
| trim          | Text      | Trim level                                       |
| exteriorColor | Text      | Exterior color                                   |
| interiorColor | Text      | Interior color                                   |
| mileage       | Integer   | Odometer reading                                 |
| price         | Numeric   | Selling price                                    |
| msrp          | Numeric   | Manufacturer's suggested retail price            |
| bodyStyle     | Text      | Body style (sedan, SUV, etc.)                    |
| transmission  | Text      | Transmission type                                |
| engine        | Text      | Engine details                                   |
| fuelType      | Text      | Fuel type                                        |
| drivetrain    | Text      | Drivetrain type (FWD, AWD, etc.)                 |
| features      | JSONB     | Array of vehicle features                        |
| description   | Text      | Vehicle description                              |
| images        | JSONB     | Array of image URLs                              |
| status        | Text      | Status (active, sold, pending)                   |
| isActive      | Boolean   | Whether vehicle is currently active in inventory |
| createdAt     | Timestamp | Record creation timestamp                        |
| updatedAt     | Timestamp | Record update timestamp                          |

### Conversations

The `conversations` table tracks customer interactions with the AI assistant.

| Column            | Type      | Description                                                 |
| ----------------- | --------- | ----------------------------------------------------------- |
| id                | Serial    | Primary key                                                 |
| dealershipId      | Integer   | Foreign key reference to dealerships table                  |
| customerName      | Text      | Customer's name                                             |
| customerPhone     | Text      | Customer's phone number                                     |
| customerEmail     | Text      | Customer's email address                                    |
| status            | Enum      | Conversation status (active, waiting, escalated, completed) |
| escalatedToUserId | Integer   | User ID conversation escalated to                           |
| channel           | Text      | Communication channel (SMS, web, etc.)                      |
| createdAt         | Timestamp | Record creation timestamp                                   |
| updatedAt         | Timestamp | Record update timestamp                                     |

### Messages

The `messages` table stores individual messages within conversations.

| Column         | Type      | Description                                  |
| -------------- | --------- | -------------------------------------------- |
| id             | Serial    | Primary key                                  |
| conversationId | Integer   | Foreign key reference to conversations table |
| content        | Text      | Message content                              |
| role           | Text      | Message sender role (customer, assistant)    |
| createdAt      | Timestamp | Record creation timestamp                    |

### Personas

The `personas` table stores AI personality configurations for different dealerships.

| Column         | Type      | Description                                             |
| -------------- | --------- | ------------------------------------------------------- |
| id             | Serial    | Primary key                                             |
| dealershipId   | Integer   | Foreign key reference to dealerships table              |
| name           | Text      | Persona name                                            |
| description    | Text      | Persona description                                     |
| promptTemplate | Text      | OpenAI system prompt template                           |
| arguments      | JSONB     | Configuration arguments (tone, priority features, etc.) |
| isDefault      | Boolean   | Whether this is the default persona for the dealership  |
| createdAt      | Timestamp | Record creation timestamp                               |
| updatedAt      | Timestamp | Record update timestamp                                 |

### API Keys

The `apiKeys` table stores API keys for external integrations.

| Column       | Type      | Description                                |
| ------------ | --------- | ------------------------------------------ |
| id           | Serial    | Primary key                                |
| dealershipId | Integer   | Foreign key reference to dealerships table |
| key          | Text      | The API key (hashed)                       |
| description  | Text      | Key description/purpose                    |
| isActive     | Boolean   | Whether key is active                      |
| createdAt    | Timestamp | Record creation timestamp                  |
| lastUsed     | Timestamp | Last usage timestamp                       |

### A/B Testing Tables

Several tables support the A/B testing infrastructure:

- `promptVariants` - Different prompt variations for testing
- `promptMetrics` - Performance metrics for prompt variants
- `promptExperiments` - A/B test experiments configuration
- `experimentVariants` - Links experiments to specific variants

## Relationships

The database includes the following key relationships:

1. Users belong to a dealership
2. Dealerships have many vehicles, personas, API keys, conversations, etc.
3. Conversations belong to a dealership and contain many messages
4. Vehicles belong to a dealership
5. Personas belong to a dealership
6. A/B tests and prompt variants are associated with dealerships

## Inventory Import Process

Inventory data is received daily via email as TSV (Tab-Separated Values) files. The platform processes these files automatically to keep vehicle inventory up-to-date.

### Import Process Flow

1. Email containing TSV attachment is received by the system
2. Attachment is parsed and extracted
3. TSV data is processed line by line
4. For each vehicle:
   - Vehicle data is mapped to database schema format
   - VIN is used to identify if vehicle already exists in database
   - If it exists, vehicle record is updated
   - If it doesn't exist, new vehicle record is created
5. Import statistics (added, updated, errors) are recorded for monitoring

### Required Fields in TSV

The TSV file should contain the following columns at minimum:

- VIN (or Stock/StockNumber as fallback identifier)
- Make
- Model
- Year
- Trim (optional)
- ExteriorColor (or Color)
- InteriorColor (optional)
- Mileage
- Price (or MSRP)
- BodyStyle (or Body)
- Transmission (optional)
- Engine (optional)
- FuelType (or Fuel) (optional)
- Drivetrain (or DriveType) (optional)
- Features (comma-separated list, optional)
- Images (comma-separated URLs, optional)

Additional columns are ignored but preserved in case they're needed for future functionality.

## Database Migrations

Database migrations are managed through Drizzle Kit. The schema is defined in `shared/schema.ts` and pushed to the database using the following command:

```bash
npm run db:push
```

This approach allows for schema changes without requiring manual SQL migrations.

## Environment Configuration

The following environment variables are required for database functionality:

- `DATABASE_URL`: PostgreSQL connection string
- `PGDATABASE`: Database name
- `PGHOST`: Database host
- `PGPASSWORD`: Database password
- `PGPORT`: Database port
- `PGUSER`: Database user

## Performance Considerations

- Indexes are automatically created on foreign keys and commonly queried fields
- Queries involving vehicle search use text search indexes for better performance
- Timestamp fields (`createdAt`, `updatedAt`) help with data lifecycle management

## Backup Procedures

It's recommended to:

1. Set up regular database backups
2. Store backups in a secure location
3. Test restore procedures periodically
4. Maintain a backup retention policy
5. Include database backups in disaster recovery planning

## Troubleshooting

Common database issues and resolutions:

1. **Connection Failures**: Verify DATABASE_URL and network connectivity
2. **Slow Queries**: Check indexes and query optimization
3. **Import Errors**: Validate TSV format and required fields
4. **Migration Issues**: Ensure schema changes are compatible with existing data

## Security Considerations

1. API keys and passwords are stored securely
2. Database access is restricted by user role
3. Sensitive fields are properly secured
4. Connection uses TLS encryption
5. SQL injection is prevented through parameterized queries
