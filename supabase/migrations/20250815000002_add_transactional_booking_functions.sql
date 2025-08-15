-- Add transactional functions for booking operations

-- Function to create a booking with full transaction safety
CREATE OR REPLACE FUNCTION create_booking_transaction(
  p_student_id UUID,
  p_slot_id UUID,
  p_session_id UUID,
  p_notes TEXT DEFAULT NULL
) RETURNS TABLE (
  booking_id UUID,
  expert_id UUID,
  slot_id UUID,
  session_id UUID,
  status TEXT,
  payment_status TEXT,
  amount_authorized DECIMAL,
  currency TEXT,
  created_at TIMESTAMPTZ
) AS $$
DECLARE
  v_slot_record RECORD;
  v_expert_id UUID;
  v_booking_id UUID;
  v_amount DECIMAL;
  v_currency TEXT;
BEGIN
  -- Lock the slot row to prevent concurrent bookings
  SELECT s.*, es.expert_id, es.price_amount::decimal/100, es.currency
  INTO v_slot_record, v_expert_id, v_amount, v_currency
  FROM slots s
  JOIN expert_sessions es ON s.expert_session_id = es.id
  WHERE s.id = p_slot_id
  FOR UPDATE;
  
  -- Check if slot exists and is available
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Slot not found';
  END IF;
  
  IF NOT v_slot_record.is_available THEN
    RAISE EXCEPTION 'Slot not available';
  END IF;
  
  -- Check for existing pending/confirmed bookings for this slot
  IF EXISTS (
    SELECT 1 FROM bookings 
    WHERE slot_id = p_slot_id 
    AND status IN ('pending', 'confirmed')
  ) THEN
    RAISE EXCEPTION 'Slot already booked';
  END IF;
  
  -- Check for existing pending booking by this student for this session
  IF EXISTS (
    SELECT 1 FROM bookings b
    JOIN slots s ON b.slot_id = s.id
    WHERE b.student_id = p_student_id
    AND s.expert_session_id = p_session_id
    AND b.status IN ('pending', 'confirmed')
  ) THEN
    RAISE EXCEPTION 'Student already booked this session';
  END IF;
  
  -- Generate booking ID
  v_booking_id := gen_random_uuid();
  
  -- Create the booking
  INSERT INTO bookings (
    id,
    student_id,
    expert_id,
    slot_id,
    session_id,
    status,
    payment_status,
    amount_authorized,
    currency,
    notes,
    scheduled_at,
    created_at,
    updated_at
  ) VALUES (
    v_booking_id,
    p_student_id,
    v_expert_id,
    p_slot_id,
    p_session_id,
    'pending',
    'pending',
    v_amount,
    LOWER(v_currency),
    p_notes,
    v_slot_record.start_time,
    NOW(),
    NOW()
  );
  
  -- Mark slot as unavailable
  UPDATE slots 
  SET 
    is_available = false,
    current_bookings = current_bookings + 1,
    updated_at = NOW()
  WHERE id = p_slot_id;
  
  -- Return the booking details
  RETURN QUERY
  SELECT 
    v_booking_id,
    v_expert_id,
    p_slot_id,
    p_session_id,
    'pending'::TEXT,
    'pending'::TEXT,
    v_amount,
    LOWER(v_currency)::TEXT,
    NOW()
  ;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to handle expert booking confirmation with payment capture
CREATE OR REPLACE FUNCTION confirm_booking_transaction(
  p_booking_id UUID,
  p_expert_user_id UUID,
  p_action TEXT, -- 'confirm' or 'decline'
  p_stripe_charge_id TEXT DEFAULT NULL
) RETURNS TABLE (
  booking_id UUID,
  status TEXT,
  payment_status TEXT,
  amount_captured DECIMAL,
  slot_released BOOLEAN
) AS $$
DECLARE
  v_booking RECORD;
  v_slot_released BOOLEAN := false;
BEGIN
  -- Validate action
  IF p_action NOT IN ('confirm', 'decline') THEN
    RAISE EXCEPTION 'Invalid action. Must be "confirm" or "decline"';
  END IF;
  
  -- Lock and fetch the booking
  SELECT b.*, ep.user_profile_id
  INTO v_booking
  FROM bookings b
  JOIN expert_profiles ep ON b.expert_id = ep.id
  JOIN user_profiles up ON ep.user_profile_id = up.id
  WHERE b.id = p_booking_id
  AND up.user_id = p_expert_user_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found or unauthorized';
  END IF;
  
  IF v_booking.status != 'pending' THEN
    RAISE EXCEPTION 'Booking has already been %', v_booking.status;
  END IF;
  
  IF p_action = 'confirm' THEN
    -- Confirm booking
    IF v_booking.payment_status != 'authorized' THEN
      RAISE EXCEPTION 'Payment must be authorized before confirming booking';
    END IF;
    
    UPDATE bookings 
    SET 
      status = 'confirmed',
      payment_status = 'captured',
      amount_captured = amount_authorized,
      updated_at = NOW()
    WHERE id = p_booking_id;
    
    RETURN QUERY
    SELECT 
      p_booking_id,
      'confirmed'::TEXT,
      'captured'::TEXT,
      v_booking.amount_authorized,
      false
    ;
    
  ELSE -- decline
    -- Decline booking and release slot
    UPDATE bookings 
    SET 
      status = 'declined',
      payment_status = CASE 
        WHEN payment_status = 'authorized' THEN 'cancelled'
        ELSE payment_status
      END,
      cancelled_by = 'expert',
      cancellation_reason = 'Declined by expert',
      cancelled_at = NOW(),
      updated_at = NOW()
    WHERE id = p_booking_id;
    
    -- Release the slot
    UPDATE slots 
    SET 
      is_available = true,
      current_bookings = GREATEST(0, current_bookings - 1),
      updated_at = NOW()
    WHERE id = v_booking.slot_id;
    
    v_slot_released := true;
    
    RETURN QUERY
    SELECT 
      p_booking_id,
      'declined'::TEXT,
      CASE 
        WHEN v_booking.payment_status = 'authorized' THEN 'cancelled'
        ELSE v_booking.payment_status
      END::TEXT,
      0::DECIMAL,
      v_slot_released
    ;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to handle booking cancellation with refund logic
CREATE OR REPLACE FUNCTION cancel_booking_transaction(
  p_booking_id UUID,
  p_user_id UUID,
  p_reason TEXT DEFAULT NULL
) RETURNS TABLE (
  booking_id UUID,
  status TEXT,
  payment_status TEXT,
  refund_amount DECIMAL,
  cancellation_fee DECIMAL,
  cancelled_by TEXT
) AS $$
DECLARE
  v_booking RECORD;
  v_is_student BOOLEAN;
  v_is_expert BOOLEAN;
  v_hours_until_session NUMERIC;
  v_refund_amount DECIMAL := 0;
  v_cancellation_fee DECIMAL := 0;
  v_cancelled_by TEXT;
BEGIN
  -- Get booking and determine user role
  SELECT b.*, 
         (up_student.user_id = p_user_id) as is_student,
         (up_expert.user_id = p_user_id) as is_expert
  INTO v_booking, v_is_student, v_is_expert
  FROM bookings b
  JOIN user_profiles up_student ON b.student_id = up_student.id
  JOIN expert_profiles ep ON b.expert_id = ep.id
  JOIN user_profiles up_expert ON ep.user_profile_id = up_expert.id
  WHERE b.id = p_booking_id
  AND (up_student.user_id = p_user_id OR up_expert.user_id = p_user_id)
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found or unauthorized';
  END IF;
  
  IF v_booking.status IN ('cancelled', 'completed', 'declined') THEN
    RAISE EXCEPTION 'Cannot cancel booking with status: %', v_booking.status;
  END IF;
  
  -- Determine who is cancelling
  IF v_is_student THEN
    v_cancelled_by := 'student';
  ELSIF v_is_expert THEN
    v_cancelled_by := 'expert';
  ELSE
    RAISE EXCEPTION 'User not authorized to cancel this booking';
  END IF;
  
  -- Calculate refund based on timing (only for captured payments)
  IF v_booking.payment_status = 'captured' AND v_booking.scheduled_at IS NOT NULL THEN
    v_hours_until_session := EXTRACT(EPOCH FROM (v_booking.scheduled_at - NOW())) / 3600;
    
    IF v_cancelled_by = 'student' THEN
      -- Student cancellation policy
      IF v_hours_until_session > 24 THEN
        v_refund_amount := v_booking.amount_captured;
      ELSIF v_hours_until_session > 2 THEN
        v_refund_amount := v_booking.amount_captured * 0.5;
        v_cancellation_fee := v_booking.amount_captured * 0.5;
      ELSE
        v_cancellation_fee := v_booking.amount_captured;
      END IF;
    ELSE
      -- Expert cancellation - full refund
      v_refund_amount := v_booking.amount_captured;
    END IF;
  END IF;
  
  -- Update booking
  UPDATE bookings 
  SET 
    status = 'cancelled',
    payment_status = CASE 
      WHEN payment_status = 'authorized' THEN 'cancelled'
      WHEN v_refund_amount > 0 THEN 'refunded'
      ELSE payment_status
    END,
    amount_refunded = v_refund_amount,
    cancellation_fee = v_cancellation_fee,
    cancelled_by = v_cancelled_by,
    cancellation_reason = p_reason,
    cancelled_at = NOW(),
    updated_at = NOW()
  WHERE id = p_booking_id;
  
  -- Release the slot
  UPDATE slots 
  SET 
    is_available = true,
    current_bookings = GREATEST(0, current_bookings - 1),
    updated_at = NOW()
  WHERE id = v_booking.slot_id;
  
  RETURN QUERY
  SELECT 
    p_booking_id,
    'cancelled'::TEXT,
    CASE 
      WHEN v_booking.payment_status = 'authorized' THEN 'cancelled'
      WHEN v_refund_amount > 0 THEN 'refunded'
      ELSE v_booking.payment_status
    END::TEXT,
    v_refund_amount,
    v_cancellation_fee,
    v_cancelled_by
  ;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION create_booking_transaction TO authenticated;
GRANT EXECUTE ON FUNCTION confirm_booking_transaction TO authenticated;
GRANT EXECUTE ON FUNCTION cancel_booking_transaction TO authenticated;