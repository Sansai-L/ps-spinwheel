const fs = require('fs');
const http = require('http');
const path = require('path');

async function testUpload() {
  // Login first
  const loginData = JSON.stringify({ username: 'admin', password: 'admin123' });
  const loginRes = await new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/admin/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    });
    req.write(loginData);
    req.end();
  });

  const token = loginRes.token;
  console.log('Obtained Admin Token:', token);

  // Upload iot_smart_city_challenges.txt
  const filePath = path.join(__dirname, 'test_documents', 'iot_smart_city_challenges.txt');
  const fileContent = fs.readFileSync(filePath);
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);

  const payloadHeader = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="domain"',
    '',
    'Internet of Things (IoT)',
    `--${boundary}`,
    `Content-Disposition: form-data; name="file"; filename="iot_smart_city_challenges.txt"`,
    'Content-Type: text/plain',
    '',
    ''
  ].join('\r\n');

  const payloadFooter = `\r\n--${boundary}--\r\n`;

  const bodyBuffer = Buffer.concat([
    Buffer.from(payloadHeader, 'utf-8'),
    fileContent,
    Buffer.from(payloadFooter, 'utf-8')
  ]);

  const uploadRes = await new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/upload',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': bodyBuffer.length
      }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(d) }));
    });
    req.write(bodyBuffer);
    req.end();
  });

  console.log('Upload response status:', uploadRes.status);
  console.log('Extracted count:', uploadRes.data.extractedCount);
  console.log('Sample extracted problem title:', uploadRes.data.problems && uploadRes.data.problems[0].title);
}

testUpload().catch(console.error);
