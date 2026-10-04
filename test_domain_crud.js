const http = require('http');

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, text: data });
        }
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function testDomainAndPSCRUD() {
  console.log('1. Logging in as admin...');
  const login = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { username: 'admin', password: 'admin123' });
  const token = login.data.token;
  console.log('Admin token:', token);

  console.log('\n2. Creating new test domain "Robotics & Automation"...');
  const addDomain = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/domains',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  }, { name: 'Robotics & Automation' });
  console.log('Add domain result:', addDomain.status, addDomain.data);

  console.log('\n3. Adding a problem statement to "Robotics & Automation"...');
  const addPS = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/problems',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  }, {
    domain: 'Robotics & Automation',
    title: 'Autonomous Drone Swarm Navigation in GPS-Denied Tunnels',
    description: 'Build a decentralized visual-inertial SLAM system allowing a swarm of 5 micro-UAVs to map subterranean mining tunnels collaboratively without GPS.',
    difficulty: 'Advanced',
    tags: ['Robotics', 'SLAM', 'UAV']
  });
  console.log('Add PS result:', addPS.status, addPS.data.problem.title);
  const problemId = addPS.data.problem.id;

  console.log('\n4. Spinning wheel on "Robotics & Automation"...');
  const spinRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/spin',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { domain: 'Robotics & Automation', seenIds: [] });
  console.log('Spin PS result:', spinRes.status, spinRes.data.problem.title);

  console.log('\n5. Deleting single problem statement...');
  const delPS = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/problems/${problemId}`,
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log('Delete PS status:', delPS.status, delPS.data);

  console.log('\n6. Deleting domain "Robotics & Automation"...');
  const delDomain = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/domains/${encodeURIComponent('Robotics & Automation')}`,
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log('Delete domain status:', delDomain.status, delDomain.data.message);

  console.log('\nAll domain and PS CRUD tests verified successfully!');
}

testDomainAndPSCRUD().catch(console.error);
