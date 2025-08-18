-- Fix race condition in create_booking_with_payment function
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
  v_held_until TIMESTAMPTZ;
  v_final_bookings INTEGER;
BEGIN
  -- Calculate hold expiration (15 minutes from now)
  v_held_until := NOW() + INTERVAL '15 minutes';
  
  -- Get learner ID
  SELECT lp.id INTO v_learner_id
  FROM learner_profiles lp
  JOIN user_profiles up ON lp.user_profile_id = up.id
  WHERE up.user_id = p_learner_user_id;
  
  IF v_learner_id IS NULL THEN
    RAISE EXCEPTION 'Learner profile not found';
  END IF;
  
  -- Lock slot atomically and get session details
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
  FOR UPDATE; -- This locks the row
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Slot not found';
  END IF;
  
  -- Check availability AFTER locking
  IF NOT v_is_available OR v_current_bookings >= v_max_bookings THEN
    RAISE EXCEPTION 'Slot not available';
  END IF;
  
  -- Check for existing booking by this learner for this slot
  IF EXISTS (
    SELECT 1 FROM bookings
    WHERE learner_id = v_learner_id 
    AND slot_id = p_slot_id 
    AND status IN ('pending', 'confirmed')
  ) THEN
    RAISE EXCEPTION 'Already booked this slot';
  END IF;
  
  -- Atomically update slot first to reserve it
  UPDATE bookable_slots 
  SET 
    current_bookings = current_bookings + 1,
    is_available = CASE WHEN current_bookings + 1 >= max_bookings THEN false ELSE true END
  WHERE id = p_slot_id
  RETURNING current_bookings INTO v_final_bookings;
  
  -- Double-check we didn't exceed capacity
  IF v_final_bookings > v_max_bookings THEN
    -- Rollback the slot update
    UPDATE bookable_slots 
    SET 
      current_bookings = current_bookings - 1,
      is_available = true
    WHERE id = p_slot_id;
    
    RAISE EXCEPTION 'Slot became unavailable during booking';
  END IF;
  
  -- Now create the booking
  INSERT INTO bookings (
    learner_id, expert_id, session_id, slot_id,
    start_at, end_at, amount_authorized, currency,
    learner_notes, status, payment_status, held_until
  ) VALUES (
    v_learner_id, v_expert_id, v_session_id, p_slot_id,
    v_start_time, v_end_time, v_price_cents, v_currency,
    p_notes, 'pending', 'pending', v_held_until
  ) RETURNING id INTO v_booking_id;
  
  RETURN QUERY SELECT 
    v_booking_id,
    v_price_cents,
    v_currency,
    v_expert_id,
    v_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;