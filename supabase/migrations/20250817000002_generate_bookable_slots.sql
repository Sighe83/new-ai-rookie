-- Function to generate bookable slots from availability windows
-- This function creates bookable time slots based on availability windows and session duration

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
    -- Start at the beginning of the availability window
    v_slot_start := v_window.start_at;
    
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
        
        -- Move to next slot (15-minute increments for flexibility)
        -- This allows sessions to start every 15 minutes even if they're longer
        v_slot_start := v_slot_start + INTERVAL '15 minutes';
    END LOOP;
    
    RETURN v_slots_created;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to generate slots for all sessions of an expert from an availability window
CREATE OR REPLACE FUNCTION generate_all_slots_for_availability_window(
    p_availability_window_id UUID
) RETURNS TABLE (
    session_id UUID,
    slots_created INTEGER
) AS $$
DECLARE
    v_window RECORD;
    v_session RECORD;
    v_slots_count INTEGER;
BEGIN
    -- Get the availability window
    SELECT * INTO v_window
    FROM availability_windows
    WHERE id = p_availability_window_id
    AND is_closed = false;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Availability window not found or is closed';
    END IF;
    
    -- Generate slots for each active session of this expert
    FOR v_session IN 
        SELECT * FROM sessions 
        WHERE expert_id = v_window.expert_id 
        AND is_active = true
    LOOP
        v_slots_count := generate_bookable_slots_for_session(v_session.id, p_availability_window_id);
        
        RETURN QUERY SELECT v_session.id, v_slots_count;
    END LOOP;
    
    RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function to automatically generate slots when an availability window is created
CREATE OR REPLACE FUNCTION auto_generate_slots_on_availability_window() 
RETURNS TRIGGER AS $$
BEGIN
    -- Only generate slots for new, open availability windows
    IF NEW.is_closed = false THEN
        PERFORM generate_all_slots_for_availability_window(NEW.id);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS generate_slots_on_availability_window ON availability_windows;
CREATE TRIGGER generate_slots_on_availability_window
    AFTER INSERT ON availability_windows
    FOR EACH ROW
    EXECUTE FUNCTION auto_generate_slots_on_availability_window();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION generate_bookable_slots_for_session TO authenticated;
GRANT EXECUTE ON FUNCTION generate_all_slots_for_availability_window TO authenticated;

-- Generate slots for any existing availability windows that don't have slots yet
DO $$
DECLARE
    v_window RECORD;
    v_result RECORD;
    v_total_slots INTEGER := 0;
BEGIN
    FOR v_window IN 
        SELECT aw.* 
        FROM availability_windows aw
        WHERE aw.is_closed = false
        AND aw.end_at > NOW()
        AND NOT EXISTS (
            SELECT 1 FROM bookable_slots bs 
            WHERE bs.availability_window_id = aw.id
        )
    LOOP
        FOR v_result IN 
            SELECT * FROM generate_all_slots_for_availability_window(v_window.id)
        LOOP
            v_total_slots := v_total_slots + v_result.slots_created;
        END LOOP;
    END LOOP;
    
    RAISE NOTICE 'Generated % bookable slots from existing availability windows', v_total_slots;
END $$;
