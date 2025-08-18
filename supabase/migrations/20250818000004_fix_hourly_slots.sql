-- Fix double booking by restricting slots to session duration increments (hourly slots)
-- This prevents overlapping bookings by making them mathematically impossible

CREATE OR REPLACE FUNCTION generate_bookable_slots_for_session(
    p_session_id UUID,
    p_availability_window_id UUID
) RETURNS INTEGER AS $$
DECLARE
    v_window RECORD;
    v_session RECORD;
    v_slot_start TIMESTAMPTZ;
    v_slot_end TIMESTAMPTZ;
    v_slots_created INTEGER := 0;
BEGIN
    -- Get the availability window details
    SELECT * INTO v_window
    FROM availability_windows
    WHERE id = p_availability_window_id
    AND is_closed = false;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Availability window not found or is closed';
    END IF;
    
    -- Get the session details
    SELECT * INTO v_session
    FROM sessions
    WHERE id = p_session_id
    AND is_active = true;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Session not found or is not active';
    END IF;
    
    -- Verify the session belongs to the same expert as the availability window
    IF v_session.expert_id != v_window.expert_id THEN
        RAISE EXCEPTION 'Session and availability window belong to different experts';
    END IF;
    
    -- Delete any existing slots for this session and window to avoid duplicates
    DELETE FROM bookable_slots 
    WHERE session_id = p_session_id 
    AND availability_window_id = p_availability_window_id;
    
    -- Generate slots based on session duration
    -- Start at the beginning of the availability window, rounded to nearest hour
    v_slot_start := date_trunc('hour', v_window.start_at);
    
    -- Adjust start time if window starts after the hour
    IF v_window.start_at > v_slot_start THEN
        v_slot_start := v_slot_start + INTERVAL '1 hour';
    END IF;
    
    -- Generate slots for the entire window duration
    WHILE v_slot_start + (v_session.duration_minutes || ' minutes')::INTERVAL <= v_window.end_at LOOP
        v_slot_end := v_slot_start + (v_session.duration_minutes || ' minutes')::INTERVAL;
        
        -- Create the bookable slot
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
            v_slot_start,
            v_slot_end,
            true,
            1,  -- Default to 1-on-1 sessions
            0
        );
        
        v_slots_created := v_slots_created + 1;
        
        -- Move to next slot using session duration (prevents overlaps)
        -- For 60-minute sessions: 11:00-12:00, 12:00-13:00, 13:00-14:00, etc.
        v_slot_start := v_slot_start + (v_session.duration_minutes || ' minutes')::INTERVAL;
    END LOOP;
    
    RETURN v_slots_created;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;