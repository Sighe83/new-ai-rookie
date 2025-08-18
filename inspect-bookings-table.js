#!/usr/bin/env node

// Script to inspect the bookings table schema
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectBookingsTable() {
  try {
    console.log('🔍 Inspecting bookings table schema...\n');
    
    // Query the information schema to get column details
    const { data: columns, error } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable, column_default')
      .eq('table_name', 'bookings')
      .eq('table_schema', 'public')
      .order('ordinal_position');

    if (error) {
      console.error('❌ Error querying schema:', error);
      process.exit(1);
    }

    if (!columns || columns.length === 0) {
      console.log('❌ No columns found for bookings table');
      process.exit(1);
    }

    console.log('📋 Bookings table columns:');
    const tableData = columns.map(col => ({
      'Column Name': col.column_name,
      'Data Type': col.data_type,
      'Nullable': col.is_nullable,
      'Default': col.column_default || '',
    }));
    console.table(tableData, ['Column Name', 'Data Type', 'Nullable', 'Default']);

    console.log('\n🔍 Checking for specific columns...');
    
    const columnNames = columns.map(col => col.column_name);
    const requiredColumns = ['declined_at', 'approved_at', 'declined_reason'];
    
    requiredColumns.forEach(colName => {
      const exists = columnNames.includes(colName);
      console.log(`${colName.padEnd(20)} ${exists ? '✅ EXISTS' : '❌ MISSING'}`);
    });

    console.log('\n📊 Total columns:', columns.length);
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

inspectBookingsTable();
