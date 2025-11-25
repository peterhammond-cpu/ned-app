// Load environment variables from .env file
require('dotenv').config();

// Configuration - reads from .env (never committed to Git)
const CANVAS_DOMAIN = process.env.CANVAS_DOMAIN;
const API_TOKEN = process.env.CANVAS_API_TOKEN;
const STUDENT_ID = 'self';

async function testCanvasAPI() {
  console.log('🎯 Testing Canvas API Connection...\n');
  
  try {
    console.log('Test 1: Fetching user profile...');
    const userResponse = await fetch(
      `https://${CANVAS_DOMAIN}/api/v1/users/${STUDENT_ID}/profile`,
      {
        headers: { 'Authorization': `Bearer ${API_TOKEN}` }
      }
    );
    const userData = await userResponse.json();
    console.log('✅ User:', userData.name);
    console.log('   Student ID:', userData.id);
    
    console.log('\nTest 2: Fetching active courses...');
    const coursesResponse = await fetch(
      `https://${CANVAS_DOMAIN}/api/v1/courses?enrollment_state=active`,
      {
        headers: { 'Authorization': `Bearer ${API_TOKEN}` }
      }
    );
    const courses = await coursesResponse.json();
    console.log(`✅ Found ${courses.length} active courses:`);
    courses.forEach(c => console.log(`   - ${c.name} (ID: ${c.id})`));
    
    if (courses.length > 0) {
      const firstCourse = courses[0];
      console.log(`\nTest 3: Fetching assignments for "${firstCourse.name}"...`);
      
      const assignmentsResponse = await fetch(
        `https://${CANVAS_DOMAIN}/api/v1/courses/${firstCourse.id}/assignments`,
        {
          headers: { 'Authorization': `Bearer ${API_TOKEN}` }
        }
      );
      const assignments = await assignmentsResponse.json();
      
      console.log(`✅ Found ${assignments.length} assignments\n`);
      
      if (assignments.length > 0) {
        console.log('📋 Sample Assignment Data:');
        console.log(JSON.stringify(assignments[0], null, 2));
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testCanvasAPI();
