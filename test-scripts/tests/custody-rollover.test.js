const CYAN={red:0,green:1,blue:1}, MAG={red:1,green:0,blue:1};
const cell=(v,c)=>({formattedValue:v==null?undefined:String(v),effectiveFormat:c?{backgroundColor:c}:undefined});
const row=(...v)=>({values:v});
const headerFor=(m)=>row(cell(m),cell('w/o Mon'),cell('M'),cell('T'),cell('W'),cell('Th'),cell('F'),cell('Sat'),cell('Sun'));
const rows=[
  row(cell(''),cell('Transition'),cell('Pete',CYAN),cell('Julia',MAG)),
  headerFor('Sep'),
  // Sep 7 2026 is a Monday
  row(cell(''),cell(''),cell(7,CYAN),cell(8,CYAN),cell(9,CYAN),cell(10,MAG),cell(11,MAG),cell(12,MAG),cell(13,MAG)),
  headerFor('Jan'),
  // Jan 4 2027 is a Monday -> must be 2027, not 2026
  row(cell(''),cell(''),cell(4,MAG),cell(5,MAG),cell(6,CYAN),cell(7,CYAN),cell(8,CYAN),cell(9,CYAN),cell(10,MAG)),
];
const fs=require('fs');
const f=fs.readFileSync('../sync-custody-schedule.js','utf8');
let head=f.split('(async () => {')[0]
 .replace(/require\('dotenv'\)\.config\(\);/,'')
 .replace(/const \{ google \} = require\('googleapis'\);/,'')
 .replace(/const \{ createClient \} = require\('@supabase\/supabase-js'\);/,'')
 .replace(/const supabase = createClient\([^)]*\);/s,'');
const body=f.slice(f.indexOf('  // Walk the grid.'), f.indexOf('  console.log(`::notice::Custody schedule:'));
const fn=new Function('rows','legendIn','tab',`
${head}
const legend=legendIn;
${body}
return byDate;`);
const byDate=fn(rows,{dad:{r:0,g:255,b:255},mom:{r:255,g:0,b:255}},'2026 - Rev9.01');
const expect={'2026-09-07':'dad','2026-09-13':'mom','2027-01-04':'mom','2027-01-06':'dad','2027-01-10':'mom'};
let fail=0;
for(const [d,w] of Object.entries(expect)){
  const got=byDate.get(d);
  if(got!==w){fail++;console.log(`  FAIL ${d}: expected ${w}, got ${got||'MISSING'}`);}
}
const strays=[...byDate.keys()].filter(d=>d.startsWith('2026-01'));
if(strays.length){fail++;console.log(`  FAIL January stamped as 2026: ${strays.join(', ')}`);}
console.log(fail?`\n  ${fail} failed`:'\n  rollover OK — January resolves to 2027');
process.exit(fail?1:0);
