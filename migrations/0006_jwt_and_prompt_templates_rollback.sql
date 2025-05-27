-- Rollback migration for JWT tokens and prompt templates
-- This undoes changes from 0006_jwt_and_prompt_templates.sql

-- Drop the view
DROP VIEW IF EXISTS template_performance_summary;

-- Drop triggers
DROP TRIGGER IF EXISTS update_prompt_templates_updated_at ON prompt_templates;
DROP TRIGGER IF EXISTS increment_template_usage_trigger ON template_usage_analytics;

-- Drop functions
DROP FUNCTION IF EXISTS update_prompt_templates_updated_at();
DROP FUNCTION IF EXISTS increment_template_usage();

-- Drop indexes (they'll be dropped with tables, but listing for completeness)
DROP INDEX IF EXISTS idx_jwt_tokens_jti;
DROP INDEX IF EXISTS idx_jwt_tokens_user;
DROP INDEX IF EXISTS idx_jwt_tokens_expires;
DROP INDEX IF EXISTS idx_jwt_tokens_dealership;
DROP INDEX IF EXISTS idx_prompt_templates_dealership;
DROP INDEX IF EXISTS idx_prompt_templates_source;
DROP INDEX IF EXISTS idx_prompt_templates_type;
DROP INDEX IF EXISTS idx_prompt_templates_default;
DROP INDEX IF EXISTS idx_template_variables_template;
DROP INDEX IF EXISTS idx_template_analytics_template;
DROP INDEX IF EXISTS idx_template_analytics_conversation;
DROP INDEX IF EXISTS idx_template_analytics_success;
DROP INDEX IF EXISTS idx_template_ab_tests_dealership;
DROP INDEX IF EXISTS idx_template_ab_tests_dates;
DROP INDEX IF EXISTS idx_template_performance_date;

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS template_performance_metrics;
DROP TABLE IF EXISTS template_ab_tests;
DROP TABLE IF EXISTS template_usage_analytics;
DROP TABLE IF EXISTS template_variables;
DROP TABLE IF EXISTS prompt_templates;
DROP TABLE IF EXISTS jwt_tokens;

-- Drop custom ENUM types
DROP TYPE IF EXISTS prompt_tone;
DROP TYPE IF EXISTS template_variable_type;
DROP TYPE IF EXISTS prompt_template_type;