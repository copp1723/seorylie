# CleanRylie Operations Guide

**Generated**: 2025-06-01T04:19:16.737Z  
**Version**: STAB-601 Implementation  
**Purpose**: Day-to-day operations and maintenance guide

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

## Monitoring & Observability

### Health Checks

**Primary Health Endpoint**

```bash
curl -f http://localhost:3000/health
```

**Detailed Health Check**

```bash
curl -f http://localhost:3000/api/health/detailed
```

**Service-Specific Health Checks**

```bash
curl -f http://localhost:3000/api/health/services  # All services
curl -f http://localhost:3000/api/health/email     # Email system
```

### Metrics & Monitoring

**Prometheus Metrics Available:**

- `http_requests_total` - Total HTTP requests
- `http_request_duration_ms` - Request latency
- `database_connections_active` - Active DB connections
- `queue_jobs_total` - Queue job metrics
- `ai_response_latency_ms` - AI service response times

**Access Metrics:**

```bash
curl http://localhost:3000/metrics    # Prometheus format
```

### Log Management

**Log Locations:**

- Application logs: `logs/application.log`
- Error logs: `logs/error.log`
- Access logs: `logs/access.log`

**Log Levels:**

- `error`: Critical errors requiring immediate attention
- `warn`: Warning conditions that should be investigated
- `info`: General application information
- `debug`: Detailed debugging information

**Log Analysis:**

```bash
# View recent errors
tail -f logs/error.log

# Search for specific errors
grep "ERROR" logs/application.log | tail -20

# Monitor application startup
tail -f logs/application.log | grep "Starting"
```

### Performance Monitoring

**Database Performance:**

```bash
npm run test:performance        # Run performance tests
npm run test:load              # Load testing
```

**Key Metrics to Watch:**

- Response time < 200ms (95th percentile)
- Database connection pool < 80% utilization
- Memory usage < 512MB
- CPU usage < 70%
- Error rate < 1%

### Alerting Thresholds

**Critical Alerts (P1):**

- Health check failures
- Database connection failures
- Error rate > 5%
- Response time > 5 seconds

**Warning Alerts (P2):**

- Memory usage > 80%
- Disk space < 10% free
- Queue backlog > 100 jobs
- Cache miss rate > 50%

### Dashboard Access

**Built-in Dashboards:**

- `http://localhost:3000/admin` - Admin dashboard
- `http://localhost:3000/monitoring` - System monitoring
- `http://localhost:3001` - Queue management (BullMQ)

## Routine Maintenance

### Daily Tasks

- [ ] Review application logs for errors
- [ ] Check system health endpoints
- [ ] Monitor resource utilization
- [ ] Verify backup completion

### Weekly Tasks

- [ ] Review performance metrics
- [ ] Update dependencies (non-breaking)
- [ ] Clean up log files
- [ ] Test backup restoration process

### Monthly Tasks

- [ ] Security patches and updates
- [ ] Capacity planning review
- [ ] Performance optimization
- [ ] Documentation updates

### Quarterly Tasks

- [ ] Major dependency updates
- [ ] Security audit and penetration testing
- [ ] Disaster recovery testing
- [ ] Architecture review

## Operational Procedures

### Service Management

**Start Services:**

```bash
npm run start               # Production start
npm run dev                # Development start
npm run start:enhanced     # Enhanced production mode
```

**Stop Services:**

```bash
pkill -f "node"           # Stop all Node processes
killall node              # Alternative stop method
```

**Restart Services:**

```bash
npm run start             # Restart application
systemctl restart nginx   # Restart web server
```

### Database Operations

**Backup Database:**

```bash
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
```

**Restore Database:**

```bash
psql $DATABASE_URL < backup_file.sql
```

**Database Maintenance:**

```bash
psql $DATABASE_URL -c "VACUUM ANALYZE;"
psql $DATABASE_URL -c "REINDEX DATABASE cleanrylie;"
```

### Cache Management

**Clear Application Cache:**

```bash
redis-cli FLUSHDB         # Clear current database
redis-cli FLUSHALL        # Clear all databases
```

**Cache Statistics:**

```bash
redis-cli INFO memory     # Memory usage
redis-cli INFO stats      # Hit/miss statistics
```

---

_This guide was generated automatically by STAB-601 Migration Guide & Runbook Generator_
