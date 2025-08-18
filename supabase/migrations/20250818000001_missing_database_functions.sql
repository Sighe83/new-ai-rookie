-- Missing Database Functions for API Endpoints
-- This migration adds the critical functions that were missing from the consolidated schema

-- Function to get expert sessions with availability filtering
-- Used by /api/expert-sessions when has_availability_only=true
CREATE OR REPLACE FUNCTION get_expert_sessions_with_availability(
  p_expert_id UUID DEFAULT NULL,
  p_level TEXT DEFAULT NULL,
  p_topic_tags TEXT[] DEFAULT NULL,
  p_min_duration INTEGER DEFAULT NULL,
  p_max_duration INTEGER DEFAULT NULL,
  p_min_price INTEGER DEFAULT NULL,
  p_max_price INTEGER DEFAULT NULL
) RETURNS TABLE (
  id UUID,
  expert_id UUID,
  title TEXT,
  short_description TEXT,
  long_description TEXT,
  duration_minutes INTEGER,
  price_cents INTEGER,
  currency TEXT,
  level TEXT,
  topic_tags TEXT[],
  is_active BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  has_availability BOOLEAN,
  next_available_slot TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    s.id,
    s.expert_id,
    s.title,
    s.short_description,
    s.long_description,
    s.duration_minutes,
    s.price_cents,
    s.currency,
    s.level,
    s.topic_tags,
    s.is_active,
    s.created_at,
    s.updated_at,
    true as has_availability,
    MIN(bs.start_time) as next_available_slot
  FROM sessions s
  INNER JOIN bookable_slots bs ON s.id = bs.session_id
  WHERE 
    s.is_active = true
    AND bs.is_available = true
    AND bs.start_time > NOW() + INTERVAL '2 hours' -- Minimum lead time
    AND (p_expert_id IS NULL OR s.expert_id = p_expert_id)
    AND (p_level IS NULL OR s.level = p_level)
    AND (p_topic_tags IS NULL OR s.topic_tags && p_topic_tags) -- Array overlap
    AND (p_min_duration IS NULL OR s.duration_minutes >= p_min_duration)
    AND (p_max_duration IS NULL OR s.duration_minutes <= p_max_duration)
    AND (p_min_price IS NULL OR s.price_cents >= p_min_price)
    AND (p_max_price IS NULL OR s.price_cents <= p_max_price)
  GROUP BY 
    s.id, s.expert_id, s.title, s.short_description, s.long_description,
    s.duration_minutes, s.price_cents, s.currency, s.level, s.topic_tags,
    s.is_active, s.created_at, s.updated_at
  ORDER BY 
    next_available_slot ASC,
    s.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_expert_sessions_with_availability TO authenticated;

-- Function to cleanup orphaned slots (referenced in tests)
CREATE OR REPLACE FUNCTION cleanup_orphaned_slots()
RETURNS INTEGER AS $$
DECLARE
  slots_cleaned INTEGER;
BEGIN
  -- Delete bookable_slots that reference non-existent sessions
  WITH deleted_slots AS (
    DELETE FROM bookable_slots bs
    WHERE NOT EXISTS (
      SELECT 1 FROM sessions s WHERE s.id = bs.session_id
    )
    RETURNING id
  )
  SELECT COUNT(*) INTO slots_cleaned FROM deleted_slots;
  
  -- Delete bookable_slots that reference non-existent availability_windows
  WITH deleted_slots2 AS (
    DELETE FROM bookable_slots bs
    WHERE bs.availability_window_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM availability_windows aw WHERE aw.id = bs.availability_window_id
    )
    RETURNING id
  )
  SELECT slots_cleaned + COUNT(*) INTO slots_cleaned FROM deleted_slots2;
  
  RAISE NOTICE 'Cleaned up % orphaned bookable slots', slots_cleaned;
  RETURN slots_cleaned;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION cleanup_orphaned_slots TO authenticated;

-- Create webhook_events table if it doesn't exist (for webhook functions)
CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  booking_id UUID REFERENCES bookings(id),
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for webhook_events
CREATE INDEX IF NOT EXISTS idx_webhook_events_stripe_event_id ON webhook_events(stripe_event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON webhook_events(created_at);

-- Function to check if webhook event was already processed
CREATE OR REPLACE FUNCTION is_webhook_processed(p_stripe_event_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS(
    SELECT 1 FROM webhook_events 
    WHERE stripe_event_id = p_stripe_event_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record webhook processing
CREATE OR REPLACE FUNCTION record_webhook_processing(
  p_stripe_event_id TEXT,
  p_event_type TEXT,
  p_booking_id UUID DEFAULT NULL,
  p_success BOOLEAN DEFAULT TRUE,
  p_error_message TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  INSERT INTO webhook_events (
    stripe_event_id,
    event_type,
    booking_id,
    success,
    error_message
  ) VALUES (
    p_stripe_event_id,
    p_event_type,
    p_booking_id,
    p_success,
    p_error_message
  )
  ON CONFLICT (stripe_event_id) DO UPDATE SET
    success = EXCLUDED.success,
    error_message = EXCLUDED.error_message;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions for webhook functions
GRANT EXECUTE ON FUNCTION is_webhook_processed TO authenticated;
GRANT EXECUTE ON FUNCTION record_webhook_processing TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION get_expert_sessions_with_availability IS 'Returns sessions that have available booking slots, with complex filtering support';
COMMENT ON FUNCTION is_webhook_processed IS 'Checks if a Stripe webhook event was already processed (idempotency)';
COMMENT ON FUNCTION record_webhook_processing IS 'Records webhook processing results for audit trail';
COMMENT ON FUNCTION cleanup_orphaned_slots IS 'Removes bookable_slots that reference deleted sessions or availability_windows';