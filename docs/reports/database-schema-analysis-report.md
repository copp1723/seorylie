# Database Schema Analysis Report
Generated: 2025-05-27T21:18:43.320Z

## Executive Summary
- **Total Tables**: 29
- **Total Columns**: 22
- **Foreign Key Relationships**: 5
- **Database Indexes**: 6
- **Core Tables Identified**: 7/7

## Schema Distribution
- **main**: 12 tables
- **lead-management**: 8 tables
- **extensions**: 9 tables

## Core Entities Status
- dealerships: ✅ DEFINED
- users: ✅ DEFINED
- vehicles: ✅ DEFINED
- conversations: ✅ DEFINED
- leads: ✅ DEFINED
- customers: ✅ DEFINED
- messages: ✅ DEFINED

## Table Details

### dealerships (main)
- **Columns**: 6
- **Foreign Keys**: 0
- **Indexes**: 1
- **Unique Constraints**: 1

**Key Columns**:
  - id: serial NOT NULL PRIMARY KEY
  - name: varchar(255) NOT NULL
  - subdomain: varchar(100) NOT NULL
  - contact_email: varchar(255) NOT NULL
  - active: boolean NOT NULL

**Foreign Key Relationships**:
  - None

### users (main)
- **Columns**: 5
- **Foreign Keys**: 1
- **Indexes**: 2
- **Unique Constraints**: 2

**Key Columns**:
  - id: serial NOT NULL PRIMARY KEY
  - username: varchar(100)
  - email: varchar(255) NOT NULL
  - dealership_id: integer
  - role: varchar(50) NOT NULL

**Foreign Key Relationships**:
  - dealership_id → dealerships.id (ON DELETE SET NULL)

### vehicles (main)
- **Columns**: 6
- **Foreign Keys**: 1
- **Indexes**: 1
- **Unique Constraints**: 1

**Key Columns**:
  - id: serial NOT NULL PRIMARY KEY
  - dealershipId: integer NOT NULL
  - vin: varchar(17) NOT NULL
  - make: varchar(100) NOT NULL
  - model: varchar(100) NOT NULL

**Foreign Key Relationships**:
  - dealershipId → dealerships.id (ON DELETE CASCADE)

### personas (main)
- **Columns**: 0
- **Foreign Keys**: 0
- **Indexes**: 0
- **Unique Constraints**: 0

**Key Columns**:


**Foreign Key Relationships**:
  - None

### apiKeys (main)
- **Columns**: 0
- **Foreign Keys**: 0
- **Indexes**: 0
- **Unique Constraints**: 0

**Key Columns**:


**Foreign Key Relationships**:
  - None

### magicLinkInvitations (main)
- **Columns**: 0
- **Foreign Keys**: 0
- **Indexes**: 0
- **Unique Constraints**: 0

**Key Columns**:


**Foreign Key Relationships**:
  - None

### sessions (main)
- **Columns**: 0
- **Foreign Keys**: 0
- **Indexes**: 0
- **Unique Constraints**: 0

**Key Columns**:


**Foreign Key Relationships**:
  - None

### reportSchedules (main)
- **Columns**: 0
- **Foreign Keys**: 0
- **Indexes**: 0
- **Unique Constraints**: 0

**Key Columns**:


**Foreign Key Relationships**:
  - None

### promptExperiments (main)
- **Columns**: 0
- **Foreign Keys**: 0
- **Indexes**: 0
- **Unique Constraints**: 0

**Key Columns**:


**Foreign Key Relationships**:
  - None

### promptVariants (main)
- **Columns**: 0
- **Foreign Keys**: 0
- **Indexes**: 0
- **Unique Constraints**: 0

**Key Columns**:


**Foreign Key Relationships**:
  - None

### experimentVariants (main)
- **Columns**: 0
- **Foreign Keys**: 0
- **Indexes**: 0
- **Unique Constraints**: 0

**Key Columns**:


**Foreign Key Relationships**:
  - None

### promptMetrics (main)
- **Columns**: 0
- **Foreign Keys**: 0
- **Indexes**: 0
- **Unique Constraints**: 0

**Key Columns**:


**Foreign Key Relationships**:
  - None

### leadSources (lead-management)
- **Columns**: 0
- **Foreign Keys**: 0
- **Indexes**: 0
- **Unique Constraints**: 0

**Key Columns**:


**Foreign Key Relationships**:
  - None

### customers (lead-management)
- **Columns**: 0
- **Foreign Keys**: 0
- **Indexes**: 0
- **Unique Constraints**: 0

**Key Columns**:


**Foreign Key Relationships**:
  - None

### vehicleInterests (lead-management)
- **Columns**: 0
- **Foreign Keys**: 0
- **Indexes**: 0
- **Unique Constraints**: 0

**Key Columns**:


**Foreign Key Relationships**:
  - None

### leads (lead-management)
- **Columns**: 0
- **Foreign Keys**: 0
- **Indexes**: 0
- **Unique Constraints**: 0

**Key Columns**:


**Foreign Key Relationships**:
  - None

### conversations (lead-management)
- **Columns**: 5
- **Foreign Keys**: 3
- **Indexes**: 2
- **Unique Constraints**: 0

**Key Columns**:
  - id: uuid NOT NULL PRIMARY KEY
  - dealershipId: integer NOT NULL
  - leadId: uuid NOT NULL
  - customerId: uuid NOT NULL
  - status: varchar(50) NOT NULL

**Foreign Key Relationships**:
  - dealershipId → dealerships.id (ON DELETE CASCADE)
  - leadId → leads.id (ON DELETE CASCADE)
  - customerId → customers.id (ON DELETE CASCADE)

### messages (lead-management)
- **Columns**: 0
- **Foreign Keys**: 0
- **Indexes**: 0
- **Unique Constraints**: 0

**Key Columns**:


**Foreign Key Relationships**:
  - None

### handovers (lead-management)
- **Columns**: 0
- **Foreign Keys**: 0
- **Indexes**: 0
- **Unique Constraints**: 0

**Key Columns**:


**Foreign Key Relationships**:
  - None

### leadActivities (lead-management)
- **Columns**: 0
- **Foreign Keys**: 0
- **Indexes**: 0
- **Unique Constraints**: 0

**Key Columns**:


**Foreign Key Relationships**:
  - None

### escalationTriggers (extensions)
- **Columns**: 0
- **Foreign Keys**: 0
- **Indexes**: 0
- **Unique Constraints**: 0

**Key Columns**:


**Foreign Key Relationships**:
  - None

### leadScores (extensions)
- **Columns**: 0
- **Foreign Keys**: 0
- **Indexes**: 0
- **Unique Constraints**: 0

**Key Columns**:


**Foreign Key Relationships**:
  - None

### followUps (extensions)
- **Columns**: 0
- **Foreign Keys**: 0
- **Indexes**: 0
- **Unique Constraints**: 0

**Key Columns**:


**Foreign Key Relationships**:
  - None

### userInvitations (extensions)
- **Columns**: 0
- **Foreign Keys**: 0
- **Indexes**: 0
- **Unique Constraints**: 0

**Key Columns**:


**Foreign Key Relationships**:
  - None

### auditLogs (extensions)
- **Columns**: 0
- **Foreign Keys**: 0
- **Indexes**: 0
- **Unique Constraints**: 0

**Key Columns**:


**Foreign Key Relationships**:
  - None

### customerProfiles (extensions)
- **Columns**: 0
- **Foreign Keys**: 0
- **Indexes**: 0
- **Unique Constraints**: 0

**Key Columns**:


**Foreign Key Relationships**:
  - None

### customerInteractions (extensions)
- **Columns**: 0
- **Foreign Keys**: 0
- **Indexes**: 0
- **Unique Constraints**: 0

**Key Columns**:


**Foreign Key Relationships**:
  - None

### customerInsights (extensions)
- **Columns**: 0
- **Foreign Keys**: 0
- **Indexes**: 0
- **Unique Constraints**: 0

**Key Columns**:


**Foreign Key Relationships**:
  - None

### responseSuggestions (extensions)
- **Columns**: 0
- **Foreign Keys**: 0
- **Indexes**: 0
- **Unique Constraints**: 0

**Key Columns**:


**Foreign Key Relationships**:
  - None


## Relationship Analysis

### Parent-Child Relationships
- **dealerships** → [users, vehicles, conversations]
- **leads** → [conversations]
- **customers** → [conversations]

### Dependency Chain (Creation Order)
1. dealerships
2. users
3. vehicles
4. personas
5. apiKeys
6. magicLinkInvitations
7. sessions
8. reportSchedules
9. promptExperiments
10. promptVariants
11. experimentVariants
12. promptMetrics
13. leadSources
14. customers
15. vehicleInterests
16. leads
17. conversations
18. messages
19. handovers
20. leadActivities
21. escalationTriggers
22. leadScores
23. followUps
24. userInvitations
25. auditLogs
26. customerProfiles
27. customerInteractions
28. customerInsights
29. responseSuggestions

## Data Integrity Rules

### Cascading Deletes
- vehicles.dealershipId → dealerships.id
- conversations.dealershipId → dealerships.id
- conversations.leadId → leads.id
- conversations.customerId → customers.id

### Required Fields Summary
- **dealerships**: name, subdomain, contact_email, active, created_at
- **users**: email, role
- **vehicles**: dealershipId, vin, make, model, year
- **conversations**: dealershipId, leadId, customerId, status

## Recommendations

⚠️  Tables without foreign key relationships: personas, apiKeys, magicLinkInvitations, promptExperiments, promptVariants, experimentVariants, promptMetrics, leadSources, customers, vehicleInterests, leads, messages, handovers, leadActivities, escalationTriggers, leadScores, followUps, userInvitations, auditLogs, customerProfiles, customerInteractions, customerInsights, responseSuggestions
🏢 Tables that may need dealership_id for multi-tenancy: dealerships, personas, apiKeys, magicLinkInvitations, promptExperiments, promptVariants, experimentVariants, promptMetrics, leadSources, customers, vehicleInterests, leads, messages, handovers, leadActivities, escalationTriggers, leadScores, followUps, userInvitations, auditLogs, customerProfiles, customerInteractions, customerInsights, responseSuggestions
📅 Tables missing audit timestamps: users, vehicles, personas, apiKeys, magicLinkInvitations, sessions, reportSchedules, promptExperiments, promptVariants, experimentVariants, promptMetrics, leadSources, customers, vehicleInterests, leads, conversations, messages, handovers, leadActivities, escalationTriggers, leadScores, followUps, userInvitations, auditLogs, customerProfiles, customerInteractions, customerInsights, responseSuggestions
🚀 Ensure indexes are created on all foreign key columns
🔐 Verify Row Level Security (RLS) policies are enabled for multi-tenant isolation
📊 Consider adding database monitoring for query performance

## Database Setup Validation Checklist

### ✅ Schema Validation
- [ ] All 29 tables are created in the database
- [ ] Foreign key constraints are properly established
- [ ] Unique constraints are enforced
- [ ] Indexes are created for performance

### ✅ Data Integrity
- [ ] Multi-tenant isolation via dealership_id is working
- [ ] Cascading deletes behave as expected
- [ ] Required field validation is enforced
- [ ] Audit timestamps are being populated

### ✅ Performance & Security
- [ ] Connection pooling is configured
- [ ] Row Level Security (RLS) policies are active
- [ ] Query performance is monitored
- [ ] Backup and recovery procedures are tested

### ✅ Application Integration
- [ ] CRUD operations work on all core entities
- [ ] Lead management workflow functions end-to-end
- [ ] Authentication and authorization are working
- [ ] API endpoints return proper data

## Conclusion

This analysis has identified **29** tables across **3** schema modules with **5** foreign key relationships. 

✅ All core entities are defined in the schema.

⚠️ **6** recommendations require attention before production deployment.
