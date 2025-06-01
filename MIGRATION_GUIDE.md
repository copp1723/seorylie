# CleanRylie Migration Guide

**Generated**: 2025-06-01T04:19:16.736Z  
**Version**: STAB-601 Implementation  
**Purpose**: Comprehensive guide for database migrations and system updates

---

## CleanRylie - Automotive Dealership AI Platform

### Architecture Summary
CleanRylie is a comprehensive automotive dealership AI platform built with modern technologies:

**Technology Stack:**
- **Frontend**: React 18, TypeScript, Tailwind CSS, Radix UI
- **Backend**: Node.js, Express, TypeScript 
- **Database**: PostgreSQL with Drizzle ORM
- **AI Integration**: OpenAI API, Supabase compatibility
- **Real-time**: WebSocket connections, Redis caching
- **Messaging**: Twilio SMS, SendGrid email
- **Monitoring**: Prometheus metrics, health checks

**Key Features:**
- Multi-tenant dealership management
- AI-powered conversation system
- Lead management and ADF integration  
- Vehicle inventory management
- Real-time chat and notifications
- Google Ads integration
- Row-level security (RLS) policies

### Service Dependencies
```
PostgreSQL Database ←→ Node.js API Server ←→ React Frontend
       ↕                      ↕                    ↕
    Redis Cache         WebSocket Server    Browser Clients
       ↕                      ↕                    ↕
   BullMQ Queues        External APIs      Mobile/Embed
```

### Environment Requirements
- Node.js 20+
- PostgreSQL 14+
- Redis 6+
- SSL certificates for production
- External API keys (OpenAI, Twilio, SendGrid)

---

## Database Migration Strategy

### Migration File Structure
The migrations follow a sequential versioning scheme:

| Version | Description | Type | Status |
|---------|-------------|------|--------|
| 0001 | Migration 0001: Lead Management Schema | Forward | ✅ Complete |
| 0002 | Migration: Add Agent Squad tracking and configuration tables | Forward | ✅ Complete |
| 0003 | Migration: Secure credentials storage for Twilio and other services | Forward | ✅ Complete |
| 0004 | Migration: Channel routing and preferences system | Forward | ✅ Complete |
| 0005 | Migration: Agent dashboard and conversation handover system | Forward | ✅ Complete |
| 0006 | Migration: JWT tokens tracking and lead source prompt templates | Forward | ✅ Complete |
| 0007 | Add opt-out fields to customers table for compliance | Forward | ✅ Complete |
| 0008 | Add vehicle lifecycle tracking fields | Forward | ✅ Complete |
| 0009 | Migration: Add conversation intelligence and context tracking | Forward | ⚠️ No rollback |
| 0010 | Migration: 0010_adf_lead_ingestion_system.sql | Forward | ✅ Complete |
| 0011 | Migration: 0011_adf_sms_responses_table.sql | Forward | ✅ Complete |
| 0012 | Migration: 0012_daily_spend_logs.sql | Forward | ✅ Complete |
| 0013 | Migration: 0013_rls_security_policies.sql | Forward | ⚠️ No rollback |
| 0014 | Migration: 0014_adf_conversation_integration.sql | Forward | ⚠️ No rollback |
| 0015 | Add dual-mode support to existing schema | Forward | ⚠️ No rollback |
| 0016 | Quick setup for dual-mode chat system | Forward | ⚠️ No rollback |


### Migration Execution

**Forward Migrations:**
```bash
npm run migrate
# or specific version
npm run migrate:create "description"
```

**Rollback Migrations:**
```bash
npm run migrate:down
```

**Check Status:**
```bash
npm run migrate:status
```

### Critical Migration Notes

⚠️ **Before Production Migration:**
1. Create database backup: `pg_dump cleanrylie > backup.sql`
2. Test migration on staging environment
3. Verify application connectivity post-migration
4. Monitor error logs during deployment

🔒 **Security Considerations:**
- All migrations include Row Level Security (RLS) policies
- Multi-tenant isolation enforced at database level
- User permissions follow principle of least privilege

### Migration Dependencies

Some migrations have dependencies on previous versions:
- All migrations are currently independent


## Migration Validation

### Pre-Migration Checklist
- [ ] Database backup completed
- [ ] Staging environment tested
- [ ] Migration scripts reviewed
- [ ] Rollback plan prepared
- [ ] Team notified of maintenance window

### Post-Migration Validation
- [ ] All migrations applied successfully
- [ ] Application starts without errors
- [ ] Health checks passing
- [ ] Core functionality verified
- [ ] Performance benchmarks met

### Migration Troubleshooting

**Common Issues:**

1. **Foreign Key Violations**
   - Check data consistency before migration
   - Temporarily disable constraints if needed
   - Verify reference data exists

2. **Lock Timeouts**
   - Run migrations during low-traffic periods
   - Use smaller batch sizes for data migrations
   - Consider maintenance mode for large changes

3. **Schema Conflicts**
   - Verify no manual schema changes
   - Check for conflicting migrations
   - Review migration dependencies

---

## Best Practices

1. **Always test migrations on staging first**
2. **Create backups before any schema changes**
3. **Use transactions for atomic operations**
4. **Monitor application during and after migrations**
5. **Have rollback procedures ready**
6. **Document any manual steps required**

---

*This guide was generated automatically by STAB-601 Migration Guide & Runbook Generator*
