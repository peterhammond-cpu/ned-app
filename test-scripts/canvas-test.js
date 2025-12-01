

require('dotenv').config();

const CANVAS_DOMAIN = process.env.CANVAS_DOMAIN;
const API_TOKEN = process.env.CANVAS_API_TOKEN;

async function testCanvasAPI() {
  console.log('🎯 Testing Canvas Pages API...\n');
  
  try {
    console.log('Fetching pages from 7th Grade course (ID: 520)...');
    const pagesResponse = await fetch(
      `https://${CANVAS_DOMAIN}/api/v1/courses/520/pages`,
      { headers: { 'Authorization': `Bearer ${API_TOKEN}` } }
    );
    
    const pages = await pagesResponse.json();
    console.log(`\n✅ Found ${pages.length} pages:\n`);
    pages.forEach(p => console.log(`   - ${p.title}`));
    
    const hwPage = pages.find(p => 
      p.title.toLowerCase().includes('hw') || 
      p.title.toLowerCase().includes('homework')
    );
    
    if (hwPage) {
      console.log(`\n\n📄 Fetching "${hwPage.title}" content...\n`);
      
      const pageResponse = await fetch(
        `https://${CANVAS_DOMAIN}/api/v1/courses/520/pages/${hwPage.url}`,
        { headers: { 'Authorization': `Bearer ${API_TOKEN}` } }
      );
      
      const content = await pageResponse.json();
      
      const fs = require('fs');
      fs.writeFileSync('homework-page.html', content.body);
      
      console.log('✅ Success! Homework page saved to: homework-page.html');
      console.log('\nPreview (first 1000 chars):');
      console.log('─'.repeat(80));
      console.log(content.body.substring(0, 1000));
      console.log('─'.repeat(80));
      
    } else {
      console.log('\n❌ No homework page found');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testCanvasAPI();
