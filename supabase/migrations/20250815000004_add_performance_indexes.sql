-- Performance optimization indexes for booking system

-- Composite indexes for common query patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_student_status_created 
  ON bookings(student_id, status, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_expert_status_scheduled 
  ON bookings(expert_id, status, scheduled_at ASC) 
  WHERE scheduled_at IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_payment_status_updated 
  ON bookings(payment_status, updated_at DESC)
  WHERE payment_status IN ('processing', 'authorized', 'failed');

-- Partial indexes for active bookings only
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_active_by_slot 
  ON bookings(slot_id, status) 
  WHERE status IN ('pending', 'confirmed');

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_pending_timeout 
  ON bookings(created_at, status) 
  WHERE status = 'pending';

-- Slots performance indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_slots_session_time_availability 
  ON slots(expert_session_id, start_time, is_available) 
  WHERE is_available = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_slots_time_range_available 
  ON slots USING GIST (tstzrange(start_time, end_time)) 
  WHERE is_available = true;

-- Expert sessions performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_expert_sessions_active_expert 
  ON expert_sessions(expert_id, is_active, created_at DESC) 
  WHERE is_active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_expert_sessions_search 
  ON expert_sessions USING GIN(topic_tags) 
  WHERE is_active = true;

-- User profiles for RLS performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_profiles_user_id_role 
  ON user_profiles(user_id, role);

-- Payment intent tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_stripe_payment_intent_unique 
  ON bookings(stripe_payment_intent_id) 
  WHERE stripe_payment_intent_id IS NOT NULL;

-- Time-based cleanup indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_cleanup_old 
  ON bookings(updated_at, status) 
  WHERE status IN ('cancelled', 'completed', 'declined');

-- Webhook events cleanup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_webhook_events_cleanup 
  ON webhook_events(created_at) 
  WHERE created_at < NOW() - INTERVAL '7 days';

-- Statistics and monitoring indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_stats_by_date 
  ON bookings(DATE(created_at), status, payment_status);

-- Expert availability optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_availability_windows_expert_time 
  ON availability_windows(expert_id, start_at, end_at, is_closed) 
  WHERE is_closed = false;

-- Add covering indexes for common SELECT patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_dashboard_student 
  ON bookings(student_id, status, scheduled_at DESC) 
  INCLUDE (expert_id, amount_authorized, currency, payment_status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_dashboard_expert 
  ON bookings(expert_id, status, scheduled_at DESC) 
  INCLUDE (student_id, amount_authorized, currency, payment_status);

-- Analyze tables for better query planning
ANALYZE bookings;
ANALYZE slots;
ANALYZE expert_sessions;
ANALYZE user_profiles;
ANALYZE webhook_events;