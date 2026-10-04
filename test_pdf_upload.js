const fs = require('fs');
const http = require('http');
const path = require('path');

async function testPDFUpload() {
  console.log('1. Logging in as admin...');
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
  console.log('Admin token obtained successfully');

  console.log('\n2. Uploading PDF file "ai_problem_statements.pdf"...');
  const filePath = path.join(__dirname, 'test_documents', 'ai_problem_statements.pdf');
  const fileContent = fs.readFileSync(filePath);
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);

  const payloadHeader = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="domain"',
    '',
    'Artificial Intelligence & ML',
    `--${boundary}`,
    `Content-Disposition: form-data; name="file"; filename="ai_problem_statements.pdf"`,
    'Content-Type: application/pdf',
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
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(d) });
        } catch (e) {
          resolve({ status: res.statusCode, text: d });
        }
      });
    });
    req.write(bodyBuffer);
    req.end();
  });

  console.log('Upload response HTTP status:', uploadRes.status);
  console.log('Upload response data:', uploadRes.data.message || uploadRes.data.error);
  console.log('Number of problem statements extracted from PDF:', uploadRes.data.extractedCount);
  if (uploadRes.data.problems) {
    uploadRes.data.problems.forEach((p, idx) => {
      console.log(`  [${idx + 1}] Title: ${p.title}`);
      console.log(`      Description: ${p.description.substring(0, 90)}...`);
    });
  }
}

testPDFUpload().catch(console.error);
