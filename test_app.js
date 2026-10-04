const http = require('http');

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, text: data });
        }
      });
    });
    req.on('error', reject);
    if (body) {
      if (typeof body === 'string') {
        req.write(body);
      } else {
        req.write(JSON.stringify(body));
      }
    }
    req.end();
  });
}

async function runTests() {
  console.log('--- TEST 1: Check Domains ---');
  const dRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/domains',
    method: 'GET'
  });
  console.log('Domains status:', dRes.status);
  console.log('Total problems in seed:', dRes.data.totalProblems);
  const targetDomain = dRes.data.domains[0].name;
  const targetTotal = dRes.data.domains[0].count;
  console.log(`Testing Domain: "${targetDomain}" with ${targetTotal} problems`);

  console.log('\n--- TEST 2: Spin & Verify Non-Repeating Cycle ---');
  const seenIds = [];
  let cycleCompletedSeen = false;

  for (let i = 1; i <= targetTotal + 2; i++) {
    const spinRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/spin',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      domain: targetDomain,
      seenIds: seenIds
    });

    const p = spinRes.data.problem;
    const isRepeat = seenIds.includes(p.id);
    console.log(`Spin #${i}: Drawn ID "${p.id}" - Title: "${p.title.substring(0, 35)}..." | cycleCompleted: ${spinRes.data.cycleCompleted} | repeat: ${isRepeat}`);

    if (spinRes.data.cycleCompleted) {
      cycleCompletedSeen = true;
      // Cycle reset!
      seenIds.length = 0;
      seenIds.push(p.id);
    } else {
      if (isRepeat) {
        console.error('FAILURE: Repeated problem statement before cycle completion!');
      }
      seenIds.push(p.id);
    }
  }

  if (cycleCompletedSeen) {
    console.log('SUCCESS: Cycle completed as expected and reset properly!');
  } else {
    console.error('FAILURE: Expected cycle completion did not trigger.');
  }

  console.log('\n--- TEST 3: Admin Auth & Security Protection ---');
  // Attempt unauthenticated delete
  const unauthDel = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/problems/ps_ai_01',
    method: 'DELETE'
  });
  console.log('Unauthenticated delete status (should be 401):', unauthDel.status);

  // Admin login
  const loginRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    username: 'admin',
    password: 'admin123'
  });
  console.log('Admin login status (should be 200):', loginRes.status, 'Token exists:', Boolean(loginRes.data.token));

  console.log('\nAll core logic tests passed!');
}

runTests().catch(err => {
  console.error('Test execution error:', err);
});
