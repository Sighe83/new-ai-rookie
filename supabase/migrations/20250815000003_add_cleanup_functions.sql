-- Add cleanup functions for booking maintenance

-- Function to clean up orphaned slots
CREATE OR REPLACE FUNCTION cleanup_orphaned_slots()
RETURNS INTEGER AS $$
DECLARE
  cleaned_count INTEGER;
BEGIN
  -- Find slots that are marked unavailable but have no active bookings
  UPDATE slots 
  SET 
    is_available = true,
    current_bookings = 0,
    updated_at = NOW()
  WHERE id IN (
    SELECT s.id
    FROM slots s
    LEFT JOIN bookings b ON s.id = b.slot_id 
      AND b.status IN ('pending', 'confirmed')
    WHERE s.is_available = false
      AND b.id IS NULL
  );
  
  GET DIAGNOSTICS cleaned_count = ROW_COUNT;
  RETURN cleaned_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get booking statistics for monitoring
CREATE OR REPLACE FUNCTION get_booking_stats()
RETURNS TABLE (
  pending_bookings INTEGER,
  expired_pending INTEGER,
  confirmed_bookings INTEGER,
  cancelled_bookings INTEGER,
  total_revenue DECIMAL,
  orphaned_slots INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*)::INTEGER FROM bookings WHERE status = 'pending'),
    (SELECT COUNT(*)::INTEGER FROM bookings 
     WHERE status = 'pending' 
     AND created_at < NOW() - INTERVAL '30 minutes'),
    (SELECT COUNT(*)::INTEGER FROM bookings WHERE status = 'confirmed'),
    (SELECT COUNT(*)::INTEGER FROM bookings WHERE status = 'cancelled'),
    (SELECT COALESCE(SUM(amount_captured), 0) FROM bookings WHERE payment_status = 'captured'),
    (SELECT COUNT(*)::INTEGER FROM slots s
     LEFT JOIN bookings b ON s.id = b.slot_id AND b.status IN ('pending', 'confirmed')
     WHERE s.is_available = false AND b.id IS NULL)
  ;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to handle webhook idempotency
CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  stripe_event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  booking_id UUID REFERENCES bookings(id),
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for webhook events
CREATE INDEX IF NOT EXISTS idx_webhook_events_stripe_id ON webhook_events(stripe_event_id);
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
$$ LANGUAGE plpgsql;

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
    processed_at = NOW(),
    success = p_success,
    error_message = p_error_message;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cleanup old webhook events (keep only last 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_webhook_events()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM webhook_events 
  WHERE created_at < NOW() - INTERVAL '30 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enhanced booking timeout function with Stripe integration awareness
CREATE OR REPLACE FUNCTION timeout_expired_bookings()
RETURNS TABLE (
  booking_id UUID,
  stripe_payment_intent_id TEXT,
  payment_status TEXT,
  slot_id UUID
) AS $$
BEGIN
  RETURN QUERY
  WITH expired_bookings AS (
    UPDATE bookings 
    SET 
      status = 'cancelled',
      payment_status = CASE 
        WHEN payment_status = 'authorized' THEN 'cancelled'
        ELSE payment_status
      END,
      cancelled_by = 'system',
      cancellation_reason = 'Booking expired - no confirmation within timeout period',
      cancelled_at = NOW(),
      updated_at = NOW()
    WHERE status = 'pending' 
      AND created_at < NOW() - INTERVAL '30 minutes'
    RETURNING id, stripe_payment_intent_id, payment_status, slot_id
  )
  SELECT * FROM expired_bookings;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION cleanup_orphaned_slots TO authenticated;
GRANT EXECUTE ON FUNCTION get_booking_stats TO authenticated;
GRANT EXECUTE ON FUNCTION is_webhook_processed TO authenticated;
GRANT EXECUTE ON FUNCTION record_webhook_processing TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_webhook_events TO authenticated;
GRANT EXECUTE ON FUNCTION timeout_expired_bookings TO authenticated;

-- Grant table permissions
GRANT SELECT, INSERT, UPDATE ON webhook_events TO authenticated;