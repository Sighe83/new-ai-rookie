-- Final Consolidated Database Schema
-- This migration represents the clean, consolidated state after removing duplicates
-- and following SOLID principles for database design

-- ============================================================================
-- CONSOLIDATED SCHEMA OVERVIEW
-- ============================================================================
-- This schema eliminates duplicate tables and competing systems:
-- ✅ Single booking system (slot-based)
-- ✅ Consolidated user management (role-based profiles)
-- ✅ Consistent pricing (all amounts in cents)
-- ✅ Clean foreign key relationships
-- ============================================================================

-- Core Tables (already exist, this is documentation)
-- 1. user_profiles - Core user identity and basic profile information
-- 2. expert_profiles - Expert-specific profile data and statistics  
-- 3. learner_profiles - Learner-specific profile data and progress
-- 4. sessions - Learning sessions offered by experts (renamed from expert_sessions)
-- 5. availability_windows - Time windows when experts are available
-- 6. bookable_slots - Available time slots for booking sessions
-- 7. bookings - Booking records with payment and scheduling info

-- ============================================================================
-- VIEWS FOR CONSOLIDATED DATA ACCESS
-- ============================================================================

-- Comprehensive booking details view for API consumption
CREATE OR REPLACE VIEW booking_details AS
SELECT 
    b.*,
    s.title as session_title,
    s.description as session_description,
    s.duration_minutes,
    ep.bio as expert_bio,
    up_expert.display_name as expert_name,
    up_learner.display_name as learner_name,
    bs.start_time as slot_start_time,
    bs.end_time as slot_end_time
FROM bookings b
JOIN sessions s ON b.session_id = s.id
JOIN expert_profiles ep ON b.expert_id = ep.id
JOIN user_profiles up_expert ON ep.user_profile_id = up_expert.id
JOIN learner_profiles lp ON b.learner_id = lp.id
JOIN user_profiles up_learner ON lp.user_profile_id = up_learner.id
JOIN bookable_slots bs ON b.slot_id = bs.id;

-- Grant permissions
GRANT SELECT ON booking_details TO authenticated;

-- ============================================================================
-- BUSINESS LOGIC FUNCTIONS
-- ============================================================================

-- Function to create a session
CREATE OR REPLACE FUNCTION create_session(
  p_expert_user_id UUID,
  p_title TEXT,
  p_description TEXT,
  p_duration_minutes INTEGER,
  p_price_cents INTEGER,
  p_currency TEXT DEFAULT 'DKK'
) RETURNS UUID AS $$
DECLARE
  v_expert_id UUID;
  v_session_id UUID;
BEGIN
  -- Get expert ID from user ID
  SELECT ep.id INTO v_expert_id
  FROM expert_profiles ep
  JOIN user_profiles up ON ep.user_profile_id = up.id
  WHERE up.user_id = p_expert_user_id;
  
  IF v_expert_id IS NULL THEN
    RAISE EXCEPTION 'Expert profile not found';
  END IF;
  
  INSERT INTO sessions (
    expert_id, title, description, short_description, duration_minutes, price_cents, currency
  ) VALUES (
    v_expert_id, p_title, p_description, LEFT(p_description, 500), p_duration_minutes, p_price_cents, p_currency
  ) RETURNING id INTO v_session_id;
  
  RETURN v_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create booking with payment
CREATE OR REPLACE FUNCTION create_booking_with_payment(
  p_learner_user_id UUID,
  p_slot_id UUID,
  p_notes TEXT DEFAULT NULL
) RETURNS TABLE (
  booking_id UUID,
  amount_cents INTEGER,
  currency TEXT,
  expert_id UUID,
  session_id UUID
) AS $$
DECLARE
  v_learner_id UUID;
  v_booking_id UUID;
  v_expert_id UUID;
  v_session_id UUID;
  v_price_cents INTEGER;
  v_currency TEXT;
  v_start_time TIMESTAMPTZ;
  v_end_time TIMESTAMPTZ;
  v_is_available BOOLEAN;
  v_current_bookings INTEGER;
  v_max_bookings INTEGER;
BEGIN
  -- Get learner ID
  SELECT lp.id INTO v_learner_id
  FROM learner_profiles lp
  JOIN user_profiles up ON lp.user_profile_id = up.id
  WHERE up.user_id = p_learner_user_id;
  
  IF v_learner_id IS NULL THEN
    RAISE EXCEPTION 'Learner profile not found';
  END IF;
  
  -- Lock and validate slot
  SELECT 
    bs.session_id, bs.start_time, bs.end_time, bs.is_available, 
    bs.current_bookings, bs.max_bookings,
    s.expert_id, s.price_cents, s.currency
  INTO 
    v_session_id, v_start_time, v_end_time, v_is_available,
    v_current_bookings, v_max_bookings,
    v_expert_id, v_price_cents, v_currency
  FROM bookable_slots bs
  JOIN sessions s ON bs.session_id = s.id
  WHERE bs.id = p_slot_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Slot not found';
  END IF;
  
  IF NOT v_is_available OR v_current_bookings >= v_max_bookings THEN
    RAISE EXCEPTION 'Slot not available';
  END IF;
  
  -- Check for conflicts
  IF EXISTS (
    SELECT 1 FROM bookings
    WHERE learner_id = v_learner_id 
    AND slot_id = p_slot_id 
    AND status IN ('pending', 'confirmed')
  ) THEN
    RAISE EXCEPTION 'Already booked this slot';
  END IF;
  
  -- Create booking
  INSERT INTO bookings (
    learner_id, expert_id, session_id, slot_id,
    start_at, end_at, amount_authorized, currency,
    learner_notes, status, payment_status
  ) VALUES (
    v_learner_id, v_expert_id, v_session_id, p_slot_id,
    v_start_time, v_end_time, v_price_cents, v_currency,
    p_notes, 'pending', 'pending'
  ) RETURNING id INTO v_booking_id;
  
  -- Reserve slot
  UPDATE bookable_slots 
  SET current_bookings = current_bookings + 1,
      is_available = CASE WHEN current_bookings + 1 >= max_bookings THEN false ELSE true END
  WHERE id = p_slot_id;
  
  RETURN QUERY SELECT 
    v_booking_id,
    v_price_cents,
    v_currency,
    v_expert_id,
    v_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- DOCUMENTATION COMMENTS
-- ============================================================================

COMMENT ON TABLE user_profiles IS 'Core user identity and basic profile information - single source of truth for all users';
COMMENT ON TABLE expert_profiles IS 'Expert-specific profile data and statistics - hourly_rate_cents for consistent pricing';
COMMENT ON TABLE learner_profiles IS 'Learner-specific profile data and progress tracking';
COMMENT ON TABLE sessions IS 'Learning sessions offered by experts - consolidated from expert_sessions with price_cents';
COMMENT ON TABLE bookable_slots IS 'Available time slots that can be booked - replaces old slots table';
COMMENT ON TABLE bookings IS 'Consolidated booking records with payment and scheduling info - single source of truth';
COMMENT ON TABLE availability_windows IS 'Time windows when experts are available for automatic slot generation';

COMMENT ON VIEW booking_details IS 'Consolidated view for API consumption - joins all booking-related data';

COMMENT ON FUNCTION create_session IS 'Creates a new learning session with proper validation';
COMMENT ON FUNCTION create_booking_with_payment IS 'Atomic booking creation with slot reservation and payment tracking';

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Core relationship indexes (most should already exist)
CREATE INDEX IF NOT EXISTS idx_bookings_learner_id ON bookings(learner_id);
CREATE INDEX IF NOT EXISTS idx_bookings_expert_id ON bookings(expert_id);
CREATE INDEX IF NOT EXISTS idx_bookings_session_id ON bookings(session_id);
CREATE INDEX IF NOT EXISTS idx_bookings_slot_id ON bookings(slot_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_payment_status ON bookings(payment_status);

CREATE INDEX IF NOT EXISTS idx_bookable_slots_session_id ON bookable_slots(session_id);
CREATE INDEX IF NOT EXISTS idx_bookable_slots_availability_window_id ON bookable_slots(availability_window_id);
CREATE INDEX IF NOT EXISTS idx_bookable_slots_available ON bookable_slots(is_available) WHERE is_available = true;
CREATE INDEX IF NOT EXISTS idx_bookable_slots_time_range ON bookable_slots(start_time, end_time);

CREATE INDEX IF NOT EXISTS idx_sessions_expert_id ON sessions(expert_id);
CREATE INDEX IF NOT EXISTS idx_sessions_active ON sessions(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_sessions_topic_tags ON sessions USING GIN(topic_tags);

-- ============================================================================
-- FINAL VERIFICATION
-- ============================================================================

-- Verify all critical tables exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_profiles') THEN
    RAISE EXCEPTION 'user_profiles table missing';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sessions') THEN
    RAISE EXCEPTION 'sessions table missing';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bookable_slots') THEN
    RAISE EXCEPTION 'bookable_slots table missing';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bookings') THEN
    RAISE EXCEPTION 'bookings table missing';
  END IF;
  
  RAISE NOTICE 'Consolidated schema verification passed';
END $$;