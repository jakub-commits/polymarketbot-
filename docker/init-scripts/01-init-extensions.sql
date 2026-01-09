-- =============================================================================
-- PostgreSQL Initialization Script
-- Runs automatically when the container is first created
-- =============================================================================

-- Enable useful extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Set default timezone
SET timezone = 'UTC';

-- Create additional indexes function for future use
-- This can be customized based on query patterns
CREATE OR REPLACE FUNCTION create_updated_at_trigger(target_table text)
RETURNS void AS $$
BEGIN
    EXECUTE format('
        CREATE OR REPLACE TRIGGER set_updated_at
        BEFORE UPDATE ON %I
        FOR EACH ROW
        EXECUTE FUNCTION trigger_set_timestamp();
    ', target_table);
END;
$$ LANGUAGE plpgsql;

-- Timestamp trigger function
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
-- Note: Prisma will create tables, this just ensures the database is ready
GRANT ALL PRIVILEGES ON DATABASE polymarket_bot TO polymarket;
