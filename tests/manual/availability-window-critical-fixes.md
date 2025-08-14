# Availability Window Critical Fixes - Manual Test Procedures

This document outlines the manual tests to verify the critical fixes implemented for the availability window system.

## Prerequisites

1. Ensure the development server is running: `npm run dev`
2. Have test users created:
   - Expert user (with expert profile)
   - Learner user
   - Admin user
3. Browser with developer tools open
4. Access to the database to verify data

## Test 1: Security Fix - Information Disclosure Prevention

### Test 1.1: Expert Can Access Own Windows
**Steps:**
1. Log in as an expert user
2. Navigate to `/dashboard/expert/availability`
3. Create an availability window
4. Note the window ID from the network tab or database
5. Navigate to `/api/availability-windows/{window-id}` in browser
6. **Expected Result:** Should return the window data with 200 status

### Test 1.2: Learner Cannot Access Window by ID
**Steps:**
1. Log out and log in as a learner user
2. Try to access `/api/availability-windows/{expert-window-id}`
3. **Expected Result:** Should return 403 Unauthorized error

### Test 1.3: Admin Can Access Any Window
**Steps:**
1. Log out and log in as an admin user
2. Try to access `/api/availability-windows/{expert-window-id}`
3. **Expected Result:** Should return the window data with 200 status

### Test 1.4: Non-existent Window Returns 404
**Steps:**
1. As any authenticated user, try to access `/api/availability-windows/00000000-0000-0000-0000-000000000000`
2. **Expected Result:** Should return 404 Not Found

## Test 2: Timezone Handling Fix

### Test 2.1: Form Shows Correct Timezone
**Steps:**
1. Log in as an expert user
2. Navigate to availability form
3. Select start and end times
4. **Expected Result:** Form should display your local timezone (e.g., "America/New_York")

### Test 2.2: Times Convert Correctly to UTC
**Steps:**
1. Create an availability window with times 10:00 AM - 11:00 AM
2. Check the database `availability_windows` table for the created record
3. **Expected Result:** 
   - If you're in EST (UTC-5), the stored times should be 15:00 - 16:00 UTC
   - If you're in PST (UTC-8), the stored times should be 18:00 - 19:00 UTC

### Test 2.3: Different Timezone Users See Correct Local Times
**Steps:**
1. Create availability window in one timezone
2. Have someone in a different timezone view the availability list
3. **Expected Result:** They should see the times converted to their local timezone

### Test 2.4: Invalid Date/Time Handling
**Steps:**
1. Try to submit the form with invalid date combinations
2. **Expected Result:** Should show appropriate error messages, not crash

## Test 3: Booking Conflict Prevention

### Test 3.1: Cannot Delete Window with Confirmed Booking
**Steps:**
1. Create an availability window
2. Create a confirmed booking for that window (may need to do this directly in database)
3. Try to delete the availability window from the UI
4. **Expected Result:** Should show error "Cannot delete availability window with confirmed or pending bookings"

### Test 3.2: Cannot Delete Window with Pending Booking
**Steps:**
1. Create an availability window
2. Create a pending booking for that window
3. Try to delete the availability window
4. **Expected Result:** Should show error about existing bookings

### Test 3.3: Can Delete Window with Cancelled Booking
**Steps:**
1. Create an availability window
2. Create a cancelled booking for that window
3. Try to delete the availability window
4. **Expected Result:** Should successfully delete the window

### Test 3.4: Can Delete Window with No Bookings
**Steps:**
1. Create an availability window with no bookings
2. Try to delete it
3. **Expected Result:** Should successfully delete the window

## Test 4: Error Handling Improvements

### Test 4.1: Form Error Display
**Steps:**
1. Try to submit form with various invalid data combinations
2. **Expected Result:** Should show clear, specific error messages

### Test 4.2: API Error Responses
**Steps:**
1. Test various API endpoints with invalid data
2. **Expected Result:** Should return appropriate HTTP status codes and error messages

## Database Verification Queries

### Check availability windows:
```sql
SELECT id, expert_id, start_at, end_at, is_closed, notes, created_at 
FROM availability_windows 
ORDER BY created_at DESC;
```

### Check bookings for a window:
```sql
SELECT id, status, start_at, end_at, availability_window_id 
FROM bookings 
WHERE availability_window_id = 'your-window-id';
```

### Check user roles:
```sql
SELECT up.user_id, up.role, up.display_name, ep.id as expert_profile_id
FROM user_profiles up
LEFT JOIN expert_profiles ep ON ep.user_profile_id = up.id;
```

## Expected Outcomes Summary

✅ **Security**: Only authorized users can access availability windows
✅ **Timezone**: Times are correctly converted and displayed in local timezones  
✅ **Data Integrity**: Cannot delete windows with active bookings
✅ **Error Handling**: Clear error messages for all failure scenarios

## Troubleshooting

### If timezone tests fail:
- Check browser timezone settings
- Verify the `Intl.DateTimeFormat().resolvedOptions().timeZone` value
- Check database timezone settings

### If security tests fail:
- Verify user roles in database
- Check authentication tokens
- Ensure RLS policies are enabled

### If booking conflict tests fail:
- Verify booking statuses in database
- Check foreign key relationships
- Ensure test data is properly set up

## Additional Notes

- All tests should be performed in different browsers and timezones when possible
- Check network tab in developer tools to see actual API requests/responses
- Verify database state before and after each test
- Test with different user roles to ensure proper authorization
