const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const doc = new PDFDocument({ margin: 40 });
const outPath = path.join(__dirname, 'test_documents', 'ai_problem_statements.pdf');
const stream = fs.createWriteStream(outPath);

doc.pipe(stream);

doc.fontSize(20).text('AI & Innovation Hackathon Challenges', { underline: true });
doc.moveDown();

doc.fontSize(14).text('Problem Statement 1: Real-time Audio Deepfake Neutralizer');
doc.fontSize(11).text('Develop a low-latency edge audio processing model that detects synthetic voice cloning artifacts during active phone calls and injects warning watermark tones to prevent social engineering fraud.');
doc.moveDown();

doc.fontSize(14).text('Problem Statement 2: Autonomous Swarm Pathfinding for Search & Rescue');
doc.fontSize(11).text('Design a decentralized reinforcement learning agent for autonomous terrestrial rovers navigating rubble in collapsed buildings to locate survivors using thermal and carbon dioxide sensors.');
doc.moveDown();

doc.fontSize(14).text('Problem Statement 3: Low-Power Neuromorphic Vision Sensor for Wildlife Tracking');
doc.fontSize(11).text('Create an event-camera vision pipeline that processes microsecond optical spikes on solar-powered camera traps, classifying endangered feline species while consuming under 50 milliwatts.');
doc.moveDown();

doc.end();

stream.on('finish', () => {
  console.log('Created sample PDF at:', outPath);
});
