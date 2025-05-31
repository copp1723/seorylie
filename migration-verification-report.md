# Database Migration Verification Report
Generated: 2025-05-31T15:16:50.260Z

## Migration Summary
- **Total Migration Files**: 40
- **Forward Migrations**: 26
- **Rollback Migrations**: 14
- **Missing Rollbacks**: 5
- **Duplicate Versions**: 4

## Migration Files Found
- **0001**: lead management schema (➡️  FORWARD)
- **0001**: lead management schema (🔄 ROLLBACK)
- **0002**: agent squad tracking (➡️  FORWARD)
- **0002**: agent squad tracking (🔄 ROLLBACK)
- **0002**: sms delivery tracking (➡️  FORWARD)
- **0002**: sms delivery tracking (🔄 ROLLBACK)
- **0003**: secure credentials storage (➡️  FORWARD)
- **0003**: secure credentials storage (🔄 ROLLBACK)
- **0004**: channel routing system (➡️  FORWARD)
- **0004**: channel routing system (🔄 ROLLBACK)
- **0005**: agent dashboard system (➡️  FORWARD)
- **0005**: agent dashboard system (🔄 ROLLBACK)
- **0006**: jwt and prompt templates (➡️  FORWARD)
- **0006**: jwt and prompt templates (🔄 ROLLBACK)
- **0007**: add opt out fields (➡️  FORWARD)
- **0007**: add opt out fields (🔄 ROLLBACK)
- **0008**: add vehicle lifecycle fields (➡️  FORWARD)
- **0008**: add vehicle lifecycle fields (🔄 ROLLBACK)
- **0009**: conversation intelligence (➡️  FORWARD)
- **0009**: tool registry (➡️  FORWARD)
- **0010**: adf lead ingestion system (➡️  FORWARD)
- **0010**: adf lead ingestion system (🔄 ROLLBACK)
- **0010**: dealership handover settings (➡️  FORWARD)
- **0010**: sandboxes and rate limiting (➡️  FORWARD)
- **0010**: sms delivery tracking (➡️  FORWARD)
- **0010**: sms delivery tracking (🔄 ROLLBACK)
- **0011**: adf sms responses table (➡️  FORWARD)
- **0011**: adf sms responses table (🔄 ROLLBACK)
- **0011**: enable row level security (➡️  FORWARD)
- **0011**: enable row level security (🔄 ROLLBACK)
- **0011**: gads accounts (➡️  FORWARD)
- **0011**: pii encryption consent (➡️  FORWARD)
- **0012**: daily spend logs (➡️  FORWARD)
- **0012**: intent detection system (➡️  FORWARD)
- **0012**: intent detection system (🔄 ROLLBACK)
- **0013**: rls security policies (➡️  FORWARD)
- **0014**: adf conversation integration (➡️  FORWARD)
- **0014**: dealership management system (➡️  FORWARD)
- **0015**: add dual mode schema (➡️  FORWARD)
- **0016**: dual mode schema (➡️  FORWARD)

## Migration Order (Forward Only)
1. 0001_lead management schema
2. 0002_agent squad tracking
3. 0002_sms delivery tracking
4. 0003_secure credentials storage
5. 0004_channel routing system
6. 0005_agent dashboard system
7. 0006_jwt and prompt templates
8. 0007_add opt out fields
9. 0008_add vehicle lifecycle fields
10. 0009_conversation intelligence
11. 0009_tool registry
12. 0010_adf lead ingestion system
13. 0010_dealership handover settings
14. 0010_sandboxes and rate limiting
15. 0010_sms delivery tracking
16. 0011_adf sms responses table
17. 0011_enable row level security
18. 0011_gads accounts
19. 0011_pii encryption consent
20. 0012_daily spend logs
21. 0012_intent detection system
22. 0013_rls security policies
23. 0014_adf conversation integration
24. 0014_dealership management system
25. 0015_add dual mode schema
26. 0016_dual mode schema

## Database Changes Analysis

### Tables
**Created**: lead_sources, vehicle_interests, customers, leads, conversations, messages, handovers, lead_activities, agent_squad_config, agent_squad_analytics, sms_messages, sms_delivery_events, sms_templates, sms_phone_numbers, sms_campaigns, sms_opt_outs, for, dealership_credentials, credential_activity_log, customer_channel_preferences, dealership_channel_rules, message_delivery_attempts, channel_availability, channel_performance_metrics, channel_fallback_chains, agents, agent_sessions, conversation_handovers, agent_conversation_assignments, agent_performance_metrics, agent_notifications, agent_quick_responses, conversation_agent_notes, jwt_tokens, prompt_templates, template_variables, template_usage_analytics, template_ab_tests, template_performance_metrics, conversation_context, conversation_messages_enhanced, customer_journey_events, conversation_analytics, intelligent_response_templates, tools, agent_tools, adf_leads, adf_email_queue, adf_processing_logs, dealership_handover_settings, sandboxes, sandbox_sessions, token_usage_logs, adf_sms_responses, adf_sms_delivery_events, adf_sms_opt_outs, gads_accounts, gads_campaigns, daily_spend_logs, daily_spend_logs_, if, intent_detection_events, intent_detection_rules, intent_detection_metrics, conversation_engagement_metrics, conversation_events, audit_logs, dealerships, dealership_email_configs, dealership_users, dealership_settings, dealership_subscriptions, dealership_api_keys, dealership_audit_trail, dealership_integrations, message_templates, agent_queue
**Altered**: messages, sms_messages, customers, vehicles, adf_leads, adf_email_queue, adf_processing_logs, handovers, sandboxes, sandbox_sessions, token_usage_logs, conversations, leads, users, sms_templates, sms_phone_numbers, sms_campaigns, sms_opt_outs, sms_delivery_events, gads_accounts, gads_campaigns, daily_spend_logs, tools, agent_tools, if, conversation_events, conversation_messages, dealerships, dealership_email_configs, dealership_users, dealership_settings, dealership_subscriptions, dealership_api_keys, dealership_audit_trail, dealership_integrations
**Dropped**: lead_activities, handovers, messages, conversations, leads, customers, vehicle_interests, lead_sources, agent_squad_analytics, agent_squad_config, sms_opt_outs, sms_campaigns, sms_phone_numbers, sms_templates, sms_delivery_events, sms_messages, credential_activity_log, dealership_credentials, channel_fallback_chains, channel_performance_metrics, channel_availability, message_delivery_attempts, dealership_channel_rules, customer_channel_preferences, conversation_agent_notes, agent_quick_responses, agent_notifications, agent_performance_metrics, agent_conversation_assignments, conversation_handovers, agent_sessions, agents, template_performance_metrics, template_ab_tests, template_usage_analytics, template_variables, prompt_templates, jwt_tokens, agent_tools, tools, adf_processing_logs, adf_email_queue, adf_leads, dealership_handover_settings, token_usage_logs, sandbox_sessions, sandboxes, adf_sms_delivery_events, adf_sms_responses, adf_sms_opt_outs, gads_campaigns, gads_accounts, if, daily_spend_logs, conversation_engagement_metrics, intent_detection_metrics, intent_detection_events, intent_detection_rules

### Indexes
**Created**: lead_sources_dealership_idx, lead_sources_type_idx, vehicle_interests_make_model_idx, vehicle_interests_year_idx, vehicle_interests_vin_idx, customers_dealership_idx, customers_email_idx, customers_phone_idx, customers_full_name_idx, customers_dedup_idx, leads_dealership_idx, leads_customer_idx, leads_status_idx, leads_assigned_user_idx, leads_source_idx, leads_created_at_idx, leads_lead_number_idx, conversations_dealership_idx, conversations_lead_idx, conversations_customer_idx, conversations_status_idx, conversations_assigned_user_idx, conversations_last_message_idx, messages_conversation_idx, messages_type_idx, messages_sender_idx, messages_created_at_idx, messages_external_id_idx, handovers_conversation_idx, handovers_lead_idx, handovers_status_idx, handovers_to_user_idx, handovers_requested_at_idx, lead_activities_lead_idx, lead_activities_type_idx, lead_activities_user_idx, lead_activities_created_at_idx, idx_messages_selected_agent, idx_agent_analytics_dealership, idx_agent_analytics_agent, idx_agent_analytics_created_at, sms_messages_dealership_idx, sms_messages_conversation_idx, sms_messages_lead_idx, sms_messages_twilio_sid_idx, sms_messages_status_idx, sms_messages_direction_idx, sms_messages_to_phone_idx, sms_messages_from_phone_idx, sms_messages_created_at_idx, sms_messages_sent_at_idx, sms_messages_retry_idx, sms_delivery_events_message_idx, sms_delivery_events_type_idx, sms_delivery_events_status_idx, sms_delivery_events_timestamp_idx, sms_templates_dealership_idx, sms_templates_category_idx, sms_templates_active_idx, sms_phone_numbers_dealership_idx, sms_phone_numbers_active_idx, sms_phone_numbers_twilio_sid_idx, sms_campaigns_dealership_idx, sms_campaigns_status_idx, sms_campaigns_scheduled_idx, sms_opt_outs_dealership_idx, sms_opt_outs_customer_idx, sms_opt_outs_hash_idx, idx_dealership_credentials_dealership, idx_dealership_credentials_provider, idx_dealership_credentials_active, idx_customer_channel_preferences_customer, idx_customer_channel_preferences_priority, customers_opted_out_idx, vehicles_is_active_idx, vehicles_last_seen_idx, vehicles_dealership_active_idx, idx_conversation_context_conversation_id, idx_conversation_context_dealership_id, idx_conversation_context_customer_email, idx_conversation_context_last_message_time, idx_conversation_messages_enhanced_conversation_id, idx_conversation_messages_enhanced_timestamp, idx_conversation_messages_enhanced_intent, idx_customer_journey_events_conversation_id, idx_customer_journey_events_customer_email, idx_customer_journey_events_event_type, idx_customer_journey_events_event_time, idx_conversation_analytics_conversation_id, idx_conversation_analytics_dealership_id, idx_conversation_analytics_outcome_type, idx_conversation_analytics_lead_quality_score, idx_intelligent_response_templates_dealership_id, idx_intelligent_response_templates_stage_intent, idx_intelligent_response_templates_active, idx_tools_service, idx_tools_category, idx_agent_tools_agent_id, idx_agent_tools_unique, idx_adf_leads_deduplication, idx_adf_leads_customer_email, idx_adf_leads_customer_phone, idx_adf_leads_vendor_name, idx_adf_leads_request_date, idx_adf_leads_lead_status, idx_adf_leads_processing_status, idx_adf_leads_unique_deduplication, idx_adf_email_queue_message_id, idx_adf_email_queue_processing_status, idx_adf_email_queue_email_from, idx_adf_email_queue_email_date, idx_adf_email_queue_resulting_lead, idx_adf_email_queue_unique_message, idx_adf_processing_logs_lead, idx_adf_processing_logs_queue, idx_adf_processing_logs_step, idx_adf_processing_logs_status, idx_adf_processing_logs_created_at, idx_dealership_handover_settings_dealership_id, idx_handovers_dossier_gin, idx_sandboxes_dealership_id, idx_sandboxes_owner_id, idx_sandboxes_is_active, idx_sandbox_sessions_sandbox_id, idx_sandbox_sessions_session_id, idx_sandbox_sessions_user_id, idx_sandbox_sessions_is_active, idx_sandbox_sessions_websocket_channel, idx_token_usage_logs_sandbox_id, idx_token_usage_logs_session_id, idx_token_usage_logs_created_at, idx_token_usage_logs_operation_type, idx_adf_sms_responses_lead_id, idx_adf_sms_responses_message_sid, idx_adf_sms_responses_status, idx_adf_sms_responses_created_at, idx_adf_sms_responses_dealership_phone, idx_adf_sms_responses_retry, idx_adf_sms_delivery_events_message_id, idx_adf_sms_delivery_events_message_sid, idx_adf_sms_delivery_events_timestamp, idx_adf_sms_opt_outs_dealership_phone, idx_adf_sms_opt_outs_phone_hash, idx_adf_sms_opt_outs_opted_out_at, idx_adf_leads_sms_status, for, idx_gads_accounts_cid, idx_gads_accounts_user_id, idx_gads_accounts_sandbox_id, idx_gads_accounts_dealership_id, idx_gads_campaigns_campaign_id, idx_gads_campaigns_gads_account_id, idx_gads_campaigns_status, idx_adf_leads_consent, idx_adf_leads_retention, idx_adf_leads_anonymized, idx_leads_consent, idx_leads_retention, idx_leads_anonymized, idx_daily_spend_logs_cid_date, idx_daily_spend_logs_date, idx_daily_spend_logs_campaign_id, idx_conversations_handover_triggered_at, idx_intent_events_conversation_id, idx_intent_events_dealership_id, idx_intent_events_trigger_type, idx_intent_events_triggered_at, idx_intent_events_processed, idx_intent_rules_rule_id, idx_intent_rules_is_active, idx_intent_rules_priority, idx_intent_rules_category, idx_intent_metrics_dealership_id, idx_intent_metrics_date, idx_intent_metrics_trigger_type, idx_engagement_conversation_id, idx_engagement_dealership_id, idx_engagement_score, idx_engagement_level, idx_last_customer_message, idx_users_role, idx_users_dealership_id, idx_sandboxes_created_by, idx_daily_spend_logs_gads_account_id, idx_token_usage_logs_user_id, idx_agent_tools_sandbox_id, idx_conversations_adf_lead_id, idx_conversation_messages_adf_sms_response_id, idx_conversation_messages_delivery_status, idx_conversations_last_activity_at, idx_conversations_search_vector, idx_conversation_events_conversation_id, idx_conversation_events_event_type, idx_conversation_events_created_at, idx_audit_logs_table_record, idx_audit_logs_changed_at, idx_dealerships_domain, idx_dealerships_status, idx_dealerships_tier, idx_email_configs_dealership, idx_email_configs_status, idx_email_configs_primary, idx_users_dealership, idx_users_email, idx_users_status, idx_settings_unique, idx_settings_category, idx_subscriptions_dealership, idx_subscriptions_status, idx_subscriptions_end_date, idx_api_keys_dealership, idx_api_keys_prefix, idx_api_keys_status, idx_audit_dealership, idx_audit_user, idx_audit_action, idx_audit_created_at, idx_integrations_dealership, idx_integrations_type, idx_integrations_provider, idx_integrations_status, idx_adf_leads_dealership, idx_leads_dealership_status, idx_agent_queue_dealership, idx_dealerships_mode
**Dropped**: idx_agent_analytics_created_at, idx_agent_analytics_agent, idx_agent_analytics_dealership, idx_messages_selected_agent, idx_sms_messages_dealership, idx_sms_messages_status, idx_sms_messages_created, idx_sms_delivery_events_message, idx_sms_delivery_events_status_created, idx_sms_opt_outs_phone, idx_sms_opt_outs_dealership, idx_dealership_credentials_dealership, idx_dealership_credentials_provider, idx_dealership_credentials_active, idx_credential_log_dealership_provider, idx_credential_log_timestamp, idx_credential_log_action, idx_customer_channel_preferences_customer, idx_customer_channel_preferences_priority, idx_dealership_channel_rules_lookup, idx_message_delivery_customer, idx_message_delivery_conversation, idx_message_delivery_status, idx_message_delivery_timestamp, idx_message_delivery_external_id, idx_channel_availability_lookup, idx_channel_performance_date, idx_fallback_chains_dealership, idx_agents_dealership, idx_agents_status, idx_agents_email, idx_agents_role, idx_agent_sessions_agent, idx_agent_sessions_token, idx_agent_sessions_expires, idx_handovers_conversation, idx_handovers_status, idx_handovers_priority, idx_handovers_claimed_by, idx_handovers_requested_at, idx_agent_assignments_agent, idx_agent_assignments_conversation, idx_agent_assignments_handover, idx_agent_performance_date, idx_agent_notifications_agent, idx_agent_notifications_type, idx_agent_notifications_priority, idx_quick_responses_agent, idx_quick_responses_dealership, idx_quick_responses_category, idx_conversation_notes_conversation, idx_conversation_notes_agent, idx_conversation_notes_type, idx_jwt_tokens_jti, idx_jwt_tokens_user, idx_jwt_tokens_expires, idx_jwt_tokens_dealership, idx_prompt_templates_dealership, idx_prompt_templates_source, idx_prompt_templates_type, idx_prompt_templates_default, idx_template_variables_template, idx_template_analytics_template, idx_template_analytics_conversation, idx_template_analytics_success, idx_template_ab_tests_dealership, idx_template_ab_tests_dates, idx_template_performance_date, first, customers_opted_out_idx, vehicles_is_active_idx, vehicles_last_seen_idx, vehicles_dealership_active_idx, drop, sms_messages_dealership_idx, sms_messages_conversation_idx, sms_messages_lead_idx, sms_messages_twilio_sid_idx, sms_messages_status_idx, sms_messages_direction_idx, sms_messages_to_phone_idx, sms_messages_from_phone_idx, sms_messages_created_at_idx, sms_messages_sent_at_idx, sms_messages_retry_idx, sms_delivery_events_message_idx, sms_delivery_events_type_idx, sms_delivery_events_status_idx, sms_delivery_events_timestamp_idx, sms_templates_dealership_idx, sms_templates_category_idx, sms_templates_active_idx, sms_phone_numbers_dealership_idx, sms_phone_numbers_active_idx, sms_phone_numbers_twilio_sid_idx, sms_campaigns_dealership_idx, sms_campaigns_status_idx, sms_campaigns_scheduled_idx, sms_opt_outs_dealership_idx, sms_opt_outs_customer_idx, sms_opt_outs_hash_idx, idx_engagement_conversation_id, idx_engagement_dealership_id, idx_engagement_score, idx_engagement_level, idx_last_customer_message, idx_intent_metrics_dealership_id, idx_intent_metrics_date, idx_intent_metrics_trigger_type, idx_intent_rules_rule_id, idx_intent_rules_is_active, idx_intent_rules_priority, idx_intent_rules_category, idx_intent_events_conversation_id, idx_intent_events_dealership_id, idx_intent_events_trigger_type, idx_intent_events_triggered_at, idx_intent_events_processed, on, idx_conversations_handover_triggered_at

### Constraints
**Added**: fk_adf_leads_dealership, fk_adf_email_queue_lead, fk_adf_processing_logs_lead, fk_adf_processing_logs_queue, uq_daily_spend_logs_cid_campaign_date
**Dropped**: fk_adf_processing_logs_lead, fk_adf_processing_logs_queue, fk_adf_email_queue_lead, fk_adf_leads_dealership

## Issues Found


### ❌ Missing Rollback Scripts
The following migrations are missing their rollback counterparts:
- Version 0009
- Version 0013
- Version 0014
- Version 0015
- Version 0016

**Recommendation**: Create rollback scripts for safe migration reversals in production.



### ❌ Duplicate Migration Versions
The following versions have multiple migration files:
- Version 0002
- Version 0010
- Version 0011
- Version 0012

**Recommendation**: Consolidate or renumber duplicate migrations to avoid conflicts.


## Migration Best Practices Checklist

### ✅ File Organization
- [ ] All migrations follow naming convention: NNNN_description.sql
- [ ] Each forward migration has a corresponding rollback script
- [ ] Migration versions are sequential and unique
- [ ] Migration files are located in the correct directory

### ✅ SQL Quality
- [ ] All DDL statements are properly formatted
- [ ] Foreign key constraints are defined correctly
- [ ] Indexes are created for performance-critical columns
- [ ] Table and column names follow naming conventions

### ✅ Production Safety
- [ ] Migrations are tested in development environment
- [ ] Rollback scripts are tested and verified
- [ ] Data migration scripts handle edge cases
- [ ] Performance impact has been evaluated

## Recommendations



⚠️  Create missing rollback scripts for production safety.
⚠️  Resolve duplicate migration versions to prevent conflicts.



## Next Steps

1. **For Development**: Run `npm run migrate` to apply all pending migrations
2. **For Production**: Apply migrations in sequence with proper backups
3. **For Testing**: Use rollback scripts to test migration reversibility
4. **For CI/CD**: Integrate migration verification into deployment pipeline

---
*This report was generated automatically by the migration verification tool.*
