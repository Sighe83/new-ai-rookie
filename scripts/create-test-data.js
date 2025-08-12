#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Use current environment (should be local now)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createTestData() {
  console.log(`🎭 Creating test data in: ${supabaseUrl}\n`);

  try {
    // 1. Create test users via auth
    console.log('👤 Creating test users...');
    
    const testUsers = [
      { email: 'expert@test.com', password: 'password123', role: 'expert' },
      { email: 'learner@test.com', password: 'password123', role: 'learner' },
      { email: 'admin@test.com', password: 'password123', role: 'admin' }
    ];

    for (const user of testUsers) {
      const { data: authUser, error } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: { role: user.role }
      });

      if (error) {
        console.log(`   ⚠️  User ${user.email}: ${error.message}`);
      } else {
        console.log(`   ✅ Created user: ${user.email}`);
        
        // Create user profile
        await supabase.from('user_profiles').insert({
          user_id: authUser.user.id,
          email: user.email,
          display_name: user.role.charAt(0).toUpperCase() + user.role.slice(1) + ' User',
          first_name: user.role.charAt(0).toUpperCase() + user.role.slice(1),
          last_name: 'User',
          role: user.role
        });
      }
    }

    // 2. Get user profiles for reference
    const { data: profiles } = await supabase.from('user_profiles').select('*');
    const expertProfile = profiles?.find(p => p.role === 'expert');
    const learnerProfile = profiles?.find(p => p.role === 'learner');

    if (!expertProfile || !learnerProfile) {
      console.log('❌ Could not create user profiles properly');
      return;
    }

    // 3. Create expert profile
    console.log('\n🎓 Creating expert profile...');
    const { data: expert, error: expertError } = await supabase.from('expert_profiles').insert({
      user_profile_id: expertProfile.id,
      bio: 'Experienced AI/ML engineer with 5+ years helping teams implement AI solutions.',
      specialties: ['AI/ML', 'Python', 'Machine Learning'],
      is_available: true
    }).select().single();

    if (expertError) {
      console.log(`   ❌ Expert profile error: ${expertError.message}`);
      return;
    }
    console.log('   ✅ Expert profile created');

    // 4. Create learner profile
    console.log('\n🎓 Creating learner profile...');
    await supabase.from('learner_profiles').insert({
      user_profile_id: learnerProfile.id,
      learning_goals: ['Learn AI basics', 'Implement ML models'],
      experience_level: 'BEGINNER'
    });
    console.log('   ✅ Learner profile created');

    // 5. Create expert sessions
    console.log('\n📚 Creating expert sessions...');
    const sessions = [
      {
        expert_id: expert.id,
        title: 'AI/ML Fundamentals for Beginners',
        short_description: 'Learn the basics of machine learning and artificial intelligence.',
        topic_tags: ['AI/ML', 'Machine Learning', 'Beginner'],
        duration_minutes: 60,
        price_amount: 50000, // 500 DKK in øre
        currency: 'DKK',
        level: 'BEGINNER'
      },
      {
        expert_id: expert.id,
        title: 'Python for Data Science',
        short_description: 'Master Python libraries for data analysis and machine learning.',
        topic_tags: ['Python', 'Data Science', 'Pandas'],
        duration_minutes: 90,
        price_amount: 75000, // 750 DKK in øre
        currency: 'DKK',
        level: 'INTERMEDIATE'
      }
    ];

    for (const session of sessions) {
      await supabase.from('expert_sessions').insert(session);
    }
    console.log('   ✅ Expert sessions created');

    // 6. Create availability windows
    console.log('\n📅 Creating availability windows...');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);

    const availabilities = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(tomorrow);
      day.setDate(day.getDate() + i);
      
      // Morning slot: 9 AM - 12 PM
      availabilities.push({
        expert_id: expert.id,
        start_at: new Date(day.getTime()).toISOString(),
        end_at: new Date(day.getTime() + 3 * 60 * 60 * 1000).toISOString(),
        is_closed: false,
        notes: 'Morning availability'
      });
      
      // Afternoon slot: 2 PM - 5 PM
      const afternoon = new Date(day.getTime() + 5 * 60 * 60 * 1000); // 2 PM
      availabilities.push({
        expert_id: expert.id,
        start_at: afternoon.toISOString(),
        end_at: new Date(afternoon.getTime() + 3 * 60 * 60 * 1000).toISOString(),
        is_closed: false,
        notes: 'Afternoon availability'
      });
    }

    for (const availability of availabilities) {
      await supabase.from('availability_windows').insert(availability);
    }
    console.log('   ✅ Availability windows created');

    console.log('\n🎉 Test data created successfully!');
    console.log('\n📝 Test accounts:');
    console.log('   Expert: expert@test.com / password123');
    console.log('   Learner: learner@test.com / password123');
    console.log('   Admin: admin@test.com / password123');
    
  } catch (error) {
    console.error('❌ Error creating test data:', error);
  }
}

createTestData();