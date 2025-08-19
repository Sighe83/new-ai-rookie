-- Fix declined vs cancelled semantic confusion
-- This migration properly separates expert rejections from cancellations

-- Step 1: Add declined-specific tracking fields if they don't exist
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS declined_by UUID;
ADD CONSTRAINT declined_by_fkey FOREIGN KEY (declined_by) REFERENCES expert_profiles(id);

-- Step 2: Update the status constraint to include 'declined'
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
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

-- Step 3: Fix any existing bookings that were incorrectly marked as 'cancelled' 
-- when they were actually declined by experts during the pending phase
-- (This identifies bookings that have both declined_at AND cancelled fields set)
UPDATE bookings 
SET status = 'declined'
WHERE status = 'cancelled' 
  AND declined_at IS NOT NULL 
  AND cancelled_by = 'expert'
  AND declined_reason IS NOT NULL;

-- Step 4: Create proper decline_booking function that uses 'declined' status
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
  SELECT b.* INTO v_booking_record
  FROM bookings b
  WHERE b.id = p_booking_id 
    AND b.expert_id = v_expert_id
    AND b.status = 'pending';  -- Only pending bookings can be declined
    
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'Booking not found, unauthorized, or not in pending status', NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::INTEGER;
    RETURN;
  END IF;

  -- Determine final payment status for refunds
  IF v_booking_record.payment_status = 'authorized' THEN
    v_final_payment_status := 'refunded';
  ELSE
    v_final_payment_status := v_booking_record.payment_status;
  END IF;

  -- Update booking status to DECLINED (not cancelled)
  UPDATE bookings 
  SET 
    status = 'declined',  -- Use proper 'declined' status
    declined_at = NOW(),
    declined_reason = p_reason,
    declined_by = v_expert_id,  -- Track which expert declined
    expert_notes = COALESCE(p_notes, bookings.expert_notes),
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
    CASE WHEN v_booking_record.payment_status = 'authorized' THEN v_booking_record.amount_authorized ELSE 0 END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION decline_booking TO authenticated;