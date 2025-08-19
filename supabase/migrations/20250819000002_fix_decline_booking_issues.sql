-- Fix issues with decline_booking function and database constraints
-- This migration addresses the ambiguous column reference and constraint violations

-- Step 1: Fix the decline_booking function to avoid ambiguous column references
DROP FUNCTION IF EXISTS decline_booking;

CREATE OR REPLACE FUNCTION decline_booking(
  p_booking_id UUID,
  p_expert_user_id UUID,
  p_notes TEXT DEFAULT NULL,
  p_reason TEXT DEFAULT 'Expert declined booking'
) RETURNS TABLE (
  success BOOLEAN,
  error_message TEXT,
  booking_status TEXT,
  payment_status TEXT,
  stripe_payment_intent_id TEXT,
  amount_to_refund INTEGER
) AS $$
DECLARE
  v_expert_id UUID;
  v_booking_record RECORD;
  v_final_payment_status TEXT;
  v_current_payment_status TEXT;
BEGIN
  -- Get expert profile ID from user ID
  SELECT ep.id INTO v_expert_id
  FROM expert_profiles ep
  JOIN user_profiles up ON ep.user_profile_id = up.id
  WHERE up.user_id = p_expert_user_id;
  
  IF v_expert_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Expert profile not found', NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::INTEGER;
    RETURN;
  END IF;

  -- Get booking details and validate
  SELECT 
    b.id, b.expert_id, b.learner_id, b.session_id, b.slot_id,
    b.start_at, b.end_at, b.status, b.payment_status,
    b.amount_authorized, b.currency, b.stripe_payment_intent_id,
    b.expert_notes, b.learner_notes
  INTO v_booking_record
  FROM bookings b
  WHERE b.id = p_booking_id 
    AND b.expert_id = v_expert_id
    AND b.status = 'pending';  -- Only pending bookings can be declined
    
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'Booking not found, unauthorized, or not in pending status', NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::INTEGER;
    RETURN;
  END IF;

  -- Store current payment status to avoid ambiguity
  v_current_payment_status := v_booking_record.payment_status;

  -- Determine final payment status for cancellations
  -- For authorized payments, they will be cancelled (not captured)
  -- For pending payments, they will also be cancelled
  IF v_current_payment_status IN ('authorized', 'pending') THEN
    v_final_payment_status := 'cancelled';
  ELSE
    v_final_payment_status := v_current_payment_status;
  END IF;

  -- Update booking status to DECLINED (not cancelled)
  UPDATE bookings 
  SET 
    status = 'declined',  -- Use proper 'declined' status
    declined_at = NOW(),
    declined_reason = p_reason,
    declined_by = v_expert_id,  -- Track which expert declined
    expert_notes = COALESCE(p_notes, v_booking_record.expert_notes),
    payment_status = v_final_payment_status,
    updated_at = NOW()
  WHERE id = p_booking_id;

  -- Release the slot so it can be booked by others
  UPDATE bookable_slots 
  SET 
    current_bookings = GREATEST(0, current_bookings - 1),
    is_available = CASE 
      WHEN current_bookings - 1 < max_bookings THEN true 
      ELSE false 
    END,
    updated_at = NOW()
  WHERE id = v_booking_record.slot_id;

  -- Return success with refund details
  RETURN QUERY SELECT 
    TRUE,
    NULL::TEXT,
    'declined'::TEXT,  -- Return proper status
    v_final_payment_status,
    v_booking_record.stripe_payment_intent_id,
    CASE WHEN v_current_payment_status IN ('authorized', 'pending') THEN v_booking_record.amount_authorized ELSE 0 END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION decline_booking TO authenticated;

-- Step 2: Verify and fix the bookings status constraint
-- First check if the constraint exists and what values it allows
DO $$
DECLARE
    constraint_exists BOOLEAN;
    constraint_definition TEXT;
BEGIN
    -- Check if the constraint exists
    SELECT EXISTS(
        SELECT 1 
        FROM information_schema.check_constraints 
        WHERE constraint_name = 'bookings_status_check'
    ) INTO constraint_exists;
    
    IF constraint_exists THEN
        -- Drop and recreate the constraint to ensure it includes 'declined'
        ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
        RAISE NOTICE 'Dropped existing bookings_status_check constraint';
    END IF;
    
    -- Create the constraint with all required statuses including 'declined'
    ALTER TABLE bookings ADD CONSTRAINT bookings_status_check 
      CHECK (status IN (
        'pending',           -- Initial request state
        'declined',          -- Expert rejected the request  
        'confirmed',         -- Expert approved, booking active
        'in_progress',       -- Session is happening
        'completed',         -- Session finished successfully
        'cancelled',         -- Approved booking was cancelled by either party
        'no_show'           -- Learner didn't show up
      ));
      
    RAISE NOTICE 'Created new bookings_status_check constraint with declined status';
END $$;

-- Step 3: Add comment for documentation
COMMENT ON FUNCTION decline_booking IS 'Declines a pending booking request from an expert, using declined status (not cancelled) and releasing the slot for other bookings';