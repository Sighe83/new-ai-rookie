-- Update atomic booking function to work with current schema
-- Replaces the create_booking_transaction function to use current table structure

DROP FUNCTION IF EXISTS create_booking_transaction;

-- Function to atomically create a booking with slot reservation
CREATE OR REPLACE FUNCTION create_booking_with_slot_check(
  p_learner_id UUID,
  p_session_id UUID,
  p_slot_id UUID,
  p_start_at TIMESTAMPTZ,
  p_end_at TIMESTAMPTZ,
  p_availability_window_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
) RETURNS TABLE (
  booking_id UUID,
  expert_id UUID,
  session_id UUID,
  slot_id UUID,
  amount_authorized INTEGER,
  currency TEXT,
  status TEXT,
  payment_status TEXT,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  held_until TIMESTAMPTZ
) AS $$
DECLARE
  v_session_record RECORD;
  v_slot_record RECORD;
  v_booking_id UUID;
  v_held_until TIMESTAMPTZ;
  v_existing_booking_count INTEGER;
BEGIN
  -- Generate booking ID and hold time
  v_booking_id := gen_random_uuid();
  v_held_until := NOW() + INTERVAL '30 minutes';
  
  -- Get session details with row lock
  SELECT s.id, s.expert_id, s.price_cents, s.currency, s.is_active
  INTO v_session_record
  FROM sessions s
  WHERE s.id = p_session_id
  AND s.is_active = true
  FOR UPDATE;
  
  -- Check if session exists and is active
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found or inactive';
  END IF;
  
  -- Try to get or create slot with atomic check
  IF p_slot_id IS NOT NULL THEN
    -- Use existing slot - lock it first
    SELECT bs.id, bs.is_available, bs.max_bookings, bs.current_bookings,
           bs.start_time, bs.end_time
    INTO v_slot_record
    FROM bookable_slots bs
    WHERE bs.id = p_slot_id
    AND bs.session_id = p_session_id
    FOR UPDATE;
    
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Slot not found for this session';
    END IF;
    
    -- Check if slot is available
    IF NOT v_slot_record.is_available OR 
       v_slot_record.current_bookings >= v_slot_record.max_bookings THEN
      RAISE EXCEPTION 'Slot no longer available';
    END IF;
    
  ELSE
    -- Try to find existing available slot for these times
    SELECT bs.id, bs.is_available, bs.max_bookings, bs.current_bookings,
           bs.start_time, bs.end_time
    INTO v_slot_record
    FROM bookable_slots bs
    WHERE bs.session_id = p_session_id
    AND bs.start_time = p_start_at
    AND bs.end_time = p_end_at
    AND bs.is_available = true
    AND bs.current_bookings < bs.max_bookings
    FOR UPDATE;
    
    IF FOUND THEN
      -- Use found slot
      p_slot_id := v_slot_record.id;
    ELSE
      -- Create new slot if we have availability window
      IF p_availability_window_id IS NULL THEN
        RAISE EXCEPTION 'No available slot found for selected time';
      END IF;
      
      -- Insert new slot
      INSERT INTO bookable_slots (
        session_id,
        availability_window_id,
        start_time,
        end_time,
        is_available,
        max_bookings,
        current_bookings
      ) VALUES (
        p_session_id,
        p_availability_window_id,
        p_start_at,
        p_end_at,
        true,
        1,
        0
      ) RETURNING id, is_available, max_bookings, current_bookings, start_time, end_time
      INTO v_slot_record;
      
      p_slot_id := v_slot_record.id;
    END IF;
  END IF;
  
  -- Check for existing pending/confirmed bookings for this slot
  SELECT COUNT(*)
  INTO v_existing_booking_count
  FROM bookings b
  WHERE b.slot_id = p_slot_id
  AND b.status IN ('pending', 'confirmed')
  AND b.payment_status NOT IN ('failed', 'cancelled', 'refunded');
  
  IF v_existing_booking_count > 0 THEN
    RAISE EXCEPTION 'Slot already has active bookings';
  END IF;
  
  -- Check if learner already has pending booking for this session
  IF EXISTS (
    SELECT 1 FROM bookings b
    WHERE b.learner_id = p_learner_id
    AND b.session_id = p_session_id
    AND b.status IN ('pending', 'confirmed')
    AND b.payment_status NOT IN ('failed', 'cancelled', 'refunded')
  ) THEN
    RAISE EXCEPTION 'Learner already has active booking for this session';
  END IF;
  
  -- Create the booking atomically
  INSERT INTO bookings (
    id,
    learner_id,
    expert_id,
    session_id,
    slot_id,
    start_at,
    end_at,
    scheduled_at,
    status,
    payment_status,
    amount_authorized,
    currency,
    notes,
    held_until,
    availability_window_id,
    created_at,
    updated_at
  ) VALUES (
    v_booking_id,
    p_learner_id,
    v_session_record.expert_id,
    p_session_id,
    p_slot_id,
    p_start_at,
    p_end_at,
    p_start_at,
    'pending',
    'pending',
    v_session_record.price_cents,
    v_session_record.currency,
    p_notes,
    v_held_until,
    p_availability_window_id,
    NOW(),
    NOW()
  );
  
  -- Update slot booking count atomically
  UPDATE bookable_slots
  SET 
    current_bookings = current_bookings + 1,
    is_available = CASE 
      WHEN current_bookings + 1 >= max_bookings THEN false 
      ELSE true 
    END,
    updated_at = NOW()
  WHERE id = p_slot_id;
  
  -- Return booking details
  RETURN QUERY
  SELECT 
    v_booking_id,
    v_session_record.expert_id,
    p_session_id,
    p_slot_id,
    v_session_record.price_cents,
    v_session_record.currency,
    'pending'::TEXT,
    'pending'::TEXT,
    p_start_at,
    p_end_at,
    v_held_until;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permission to authenticated users
GRANT EXECUTE ON FUNCTION create_booking_with_slot_check TO authenticated;