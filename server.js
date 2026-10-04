const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mammoth = require('mammoth');
let pdfParseModule = null;
try {
  pdfParseModule = require('pdf-parse');
} catch (e) {
  console.warn('pdf-parse module warning:', e.message);
}

const sampleProblems = require('./data/sampleProblems');

const app = express();
const isVercel = process.env.VERCEL === '1' || Boolean(process.env.NOW_REGION);
const DB_FILE = isVercel ? path.join('/tmp', 'database.json') : path.join(__dirname, 'data', 'database.json');
const UPLOADS_DIR = isVercel ? path.join('/tmp', 'uploads') : path.join(__dirname, 'uploads');

try {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
} catch (e) {
  // Ignored in read-only environment
}

// In-memory + persistent DB helper
function loadDB() {
  let loaded = null;
  if (isVercel && !fs.existsSync(DB_FILE)) {
    const seedPath = path.join(__dirname, 'data', 'database.json');
    if (fs.existsSync(seedPath)) {
      try {
        const seedContent = fs.readFileSync(seedPath, 'utf-8');
        fs.writeFileSync(DB_FILE, seedContent);
        loaded = JSON.parse(seedContent);
      } catch (err) {
        console.warn('Could not copy seed to /tmp:', err.message);
      }
    }
  }

  if (!loaded && fs.existsSync(DB_FILE)) {
    try {
      loaded = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
    } catch (e) {}
  }

  if (!loaded || !loaded.problems || loaded.problems.length === 0) {
    loaded = {
      problems: [...sampleProblems],
      documents: (loaded && loaded.documents) || [],
      domains: (loaded && loaded.domains && loaded.domains.length > 0) ? loaded.domains : [
        "Artificial Intelligence & ML",
        "Cybersecurity & Privacy",
        "Web & Mobile Development",
        "Internet of Things (IoT)",
        "FinTech & Blockchain",
        "Healthcare & BioTech",
        "Cloud & DevOps"
      ]
    };
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(loaded, null, 2));
    } catch (e) {}
  }

  return loaded;
}

function saveDB(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.warn('saveDB warning (non-fatal):', err.message);
  }
}

let db = loadDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Admin Auth Token Store
const ADMIN_CREDENTIALS = {
  username: process.env.ADMIN_USER || 'admin',
  password: process.env.ADMIN_PASSWORD || 'admin123'
};
const VALID_TOKENS = new Set(['demo-admin-token-2026']);

function adminAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Admin login required' });
  }
  const token = authHeader.split(' ')[1];
  if (!VALID_TOKENS.has(token)) {
    return res.status(403).json({ error: 'Forbidden: Invalid or expired admin token' });
  }
  next();
}

// Multer Storage Configuration
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB limit
});

// Auth Endpoints
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
    const token = 'admin-token-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
    VALID_TOKENS.add(token);
    return res.json({
      success: true,
      token,
      username: ADMIN_CREDENTIALS.username,
      message: 'Login successful'
    });
  }
  return res.status(401).json({ error: 'Invalid username or password' });
});

app.get('/api/admin/verify', (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    if (VALID_TOKENS.has(token)) {
      return res.json({ valid: true, username: ADMIN_CREDENTIALS.username });
    }
  }
  return res.json({ valid: false });
});

// Domain Endpoints
app.get('/api/domains', (req, res) => {
  const domainCounts = {};
  db.domains.forEach(d => { domainCounts[d] = 0; });
  db.problems.forEach(p => {
    domainCounts[p.domain] = (domainCounts[p.domain] || 0) + 1;
  });

  const domainsList = db.domains.map(d => ({
    name: d,
    count: domainCounts[d] || 0
  }));

  res.json({ domains: domainsList, totalProblems: db.problems.length });
});

app.post('/api/domains', adminAuthMiddleware, (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Domain name is required' });
  }
  const cleanName = name.trim();
  if (db.domains.includes(cleanName)) {
    return res.status(400).json({ error: 'Domain already exists' });
  }
  db.domains.push(cleanName);
  saveDB(db);
  res.json({ success: true, domain: cleanName });
});

app.delete('/api/domains/:name', adminAuthMiddleware, (req, res) => {
  const domainParam = decodeURIComponent(req.params.name).trim();
  const index = db.domains.findIndex(d => d.toLowerCase() === domainParam.toLowerCase());
  if (index === -1) {
    return res.status(404).json({ error: `Domain "${domainParam}" not found` });
  }

  const actualDomainName = db.domains[index];
  // Remove domain
  db.domains.splice(index, 1);

  // Remove all problem statements in that domain
  const prevCount = db.problems.length;
  db.problems = db.problems.filter(p => p.domain.toLowerCase() !== actualDomainName.toLowerCase());
  const removedCount = prevCount - db.problems.length;

  saveDB(db);
  res.json({
    success: true,
    message: `Domain "${actualDomainName}" and ${removedCount} associated problem statement(s) deleted.`,
    remainingDomains: db.domains
  });
});

// Problem Statement Wheel Spin Endpoint
// Implements cycle tracking: no repeated problem statements until all problems in domain are exhausted
app.post('/api/spin', (req, res) => {
  const { domain, seenIds = [] } = req.body;
  
  if (!domain) {
    return res.status(400).json({ error: 'Please select a domain to spin' });
  }

  const domainProblems = db.problems.filter(p => p.domain.toLowerCase() === domain.toLowerCase());

  if (domainProblems.length === 0) {
    return res.status(404).json({
      error: `No problem statements currently available in domain: "${domain}". Admin can upload documents or add problems.`
    });
  }

  // Find problems in this domain that have not been seen in the current cycle
  const seenSet = new Set(seenIds);
  let availableProblems = domainProblems.filter(p => !seenSet.has(p.id));

  let cycleCompleted = false;

  // If all problems in this domain have been seen, complete the cycle and reset!
  if (availableProblems.length === 0) {
    cycleCompleted = true;
    availableProblems = [...domainProblems];
  }

  // Pick a random problem statement from the available pool
  const randomIndex = Math.floor(Math.random() * availableProblems.length);
  const selectedProblem = availableProblems[randomIndex];

  const totalInDomain = domainProblems.length;
  // Calculate remaining after this draw:
  // If cycle completed, remaining is total - 1. Otherwise available.length - 1.
  const remainingInCycle = availableProblems.length - 1;

  res.json({
    problem: selectedProblem,
    cycleCompleted,
    totalInDomain,
    remainingInCycle,
    cycleSize: totalInDomain
  });
});

// Problems Query Endpoint (for preview or admin view)
app.get('/api/problems', (req, res) => {
  const { domain, search } = req.query;
  let list = db.problems;

  if (domain && domain !== 'All') {
    list = list.filter(p => p.domain.toLowerCase() === domain.toLowerCase());
  }

  if (search) {
    const q = search.toLowerCase();
    list = list.filter(p => 
      p.title.toLowerCase().includes(q) || 
      p.description.toLowerCase().includes(q) ||
      (p.tags && p.tags.some(t => t.toLowerCase().includes(q)))
    );
  }

  res.json({ total: list.length, problems: list });
});

// Add Single Problem Manually (Admin Only)
app.post('/api/problems', adminAuthMiddleware, (req, res) => {
  const { domain, title, description, difficulty = 'Intermediate', tags = [] } = req.body;
  if (!domain || !title || !description) {
    return res.status(400).json({ error: 'Domain, title, and description are required' });
  }

  if (!db.domains.includes(domain)) {
    db.domains.push(domain);
  }

  const newProblem = {
    id: 'ps_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    domain: domain.trim(),
    title: title.trim(),
    description: description.trim(),
    difficulty: difficulty || 'Intermediate',
    source: 'Manual Entry',
    tags: Array.isArray(tags) ? tags : (typeof tags === 'string' ? tags.split(',').map(t => t.trim()).filter(Boolean) : []),
    createdAt: new Date().toISOString()
  };

  db.problems.unshift(newProblem);
  saveDB(db);
  res.json({ success: true, problem: newProblem });
});

// Delete Problem (Admin Only)
app.delete('/api/problems/:id', adminAuthMiddleware, (req, res) => {
  const { id } = req.params;
  const initialLen = db.problems.length;
  db.problems = db.problems.filter(p => p.id !== id);

  if (db.problems.length === initialLen) {
    return res.status(404).json({ error: 'Problem statement not found' });
  }

  saveDB(db);
  res.json({ success: true, message: 'Problem statement deleted' });
});

// Document Upload & Intelligent Extraction Endpoint (Admin Only)
app.post('/api/upload', adminAuthMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const targetDomain = req.body.domain || 'General & Innovation';
    const originalName = req.file.originalname;
    const ext = path.extname(originalName).toLowerCase();
    const buffer = req.file.buffer;

    let extractedText = '';

    // Handle various file formats
    if (ext === '.pdf') {
      try {
        extractedText = await extractTextFromPDF(buffer);
      } catch (pdfErr) {
        console.error('PDF extraction failed:', pdfErr);
        return res.status(400).json({
          error: 'Could not extract text from this PDF: ' + pdfErr.message + '. Please ensure the PDF contains selectable text (not scanned images).'
        });
      }
    } else if (ext === '.docx') {
      const parsed = await mammoth.extractRawText({ buffer });
      extractedText = parsed.value || '';
    } else if (ext === '.json') {
      const jsonStr = buffer.toString('utf-8');
      try {
        const jsonContent = JSON.parse(jsonStr);
        const problems = [];
        const items = Array.isArray(jsonContent) ? jsonContent : (jsonContent.problems || [jsonContent]);

        items.forEach((item, idx) => {
          const title = item.title || item.name || `Problem Statement #${idx + 1}`;
          const desc = item.description || item.statement || item.problem || item.content || JSON.stringify(item);
          const domain = item.domain || targetDomain;
          const diff = item.difficulty || 'Intermediate';
          const tags = Array.isArray(item.tags) ? item.tags : [];

          if (desc && desc.trim()) {
            problems.push({
              id: 'ps_json_' + Date.now() + '_' + idx,
              domain: domain.trim(),
              title: title.trim(),
              description: desc.trim(),
              difficulty: diff,
              source: originalName,
              tags,
              createdAt: new Date().toISOString()
            });
          }
        });

        if (problems.length > 0) {
          if (!db.domains.includes(targetDomain)) {
            db.domains.push(targetDomain);
          }
          db.problems.unshift(...problems);
          
          const docRecord = {
            id: 'doc_' + Date.now(),
            filename: originalName,
            domain: targetDomain,
            extractedCount: problems.length,
            uploadedAt: new Date().toISOString(),
            size: req.file.size
          };
          db.documents.unshift(docRecord);
          saveDB(db);

          return res.json({
            success: true,
            extractedCount: problems.length,
            domain: targetDomain,
            problems,
            message: `Successfully extracted ${problems.length} problem statements from ${originalName}`
          });
        }
      } catch (err) {
        return res.status(400).json({ error: 'Failed to parse JSON file: ' + err.message });
      }
    } else if (ext === '.csv') {
      const csvStr = buffer.toString('utf-8');
      const lines = csvStr.split(/\r?\n/).filter(line => line.trim().length > 0);
      const problems = [];

      lines.forEach((line, idx) => {
        // Skip header if common header words
        if (idx === 0 && (line.toLowerCase().includes('title') || line.toLowerCase().includes('problem'))) {
          return;
        }
        // Basic CSV split
        const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(s => s.replace(/^"|"$/g, '').trim());
        if (parts.length >= 2) {
          problems.push({
            id: 'ps_csv_' + Date.now() + '_' + idx,
            domain: (parts[2] || targetDomain).trim(),
            title: parts[0],
            description: parts[1],
            difficulty: parts[3] || 'Intermediate',
            source: originalName,
            tags: [targetDomain],
            createdAt: new Date().toISOString()
          });
        } else if (parts.length === 1 && parts[0].length > 15) {
          problems.push({
            id: 'ps_csv_' + Date.now() + '_' + idx,
            domain: targetDomain,
            title: `Challenge ${idx + 1}`,
            description: parts[0],
            difficulty: 'Intermediate',
            source: originalName,
            tags: [targetDomain],
            createdAt: new Date().toISOString()
          });
        }
      });

      if (problems.length > 0) {
        if (!db.domains.includes(targetDomain)) {
          db.domains.push(targetDomain);
        }
        db.problems.unshift(...problems);
        const docRecord = {
          id: 'doc_' + Date.now(),
          filename: originalName,
          domain: targetDomain,
          extractedCount: problems.length,
          uploadedAt: new Date().toISOString(),
          size: req.file.size
        };
        db.documents.unshift(docRecord);
        saveDB(db);

        return res.json({
          success: true,
          extractedCount: problems.length,
          domain: targetDomain,
          problems,
          message: `Successfully extracted ${problems.length} problem statements from ${originalName}`
        });
      }
    } else {
      // Default plain text / markdown / doc text
      extractedText = buffer.toString('utf-8');
    }

    // Parse plain text / doc text into individual problem statements
    if (!extractedText || !extractedText.trim()) {
      return res.status(400).json({ error: 'Uploaded file appears to be empty or unreadable.' });
    }

    const parsedProblems = parseStatementsFromText(extractedText, targetDomain, originalName);

    if (parsedProblems.length === 0) {
      return res.status(400).json({ error: 'Could not detect any distinct problem statements in this document.' });
    }

    if (!db.domains.includes(targetDomain)) {
      db.domains.push(targetDomain);
    }

    db.problems.unshift(...parsedProblems);

    const docRecord = {
      id: 'doc_' + Date.now(),
      filename: originalName,
      domain: targetDomain,
      extractedCount: parsedProblems.length,
      uploadedAt: new Date().toISOString(),
      size: req.file.size
    };
    db.documents.unshift(docRecord);
    saveDB(db);

    res.json({
      success: true,
      extractedCount: parsedProblems.length,
      domain: targetDomain,
      problems: parsedProblems,
      message: `Extracted ${parsedProblems.length} problem statement(s) for ${targetDomain}`
    });
  } catch (err) {
    console.error('File upload error:', err);
    res.status(500).json({ error: 'Server error processing file: ' + err.message });
  }
});

// Document List & Delete Endpoints (Admin Only)
app.get('/api/documents', adminAuthMiddleware, (req, res) => {
  res.json({ documents: db.documents || [] });
});

app.delete('/api/documents/:id', adminAuthMiddleware, (req, res) => {
  const { id } = req.params;
  const doc = (db.documents || []).find(d => d.id === id);
  if (!doc) {
    return res.status(404).json({ error: 'Document not found' });
  }

  // Remove document
  db.documents = db.documents.filter(d => d.id !== id);
  // Optionally remove associated problems from that document
  db.problems = db.problems.filter(p => p.source !== doc.filename);

  saveDB(db);
  res.json({ success: true, message: `Removed document "${doc.filename}" and its problem statements.` });
});

// Restore Sample Data Endpoint (Admin Only)
app.post('/api/reset-data', adminAuthMiddleware, (req, res) => {
  db = {
    problems: [...sampleProblems],
    documents: [],
    domains: [
      "Artificial Intelligence & ML",
      "Cybersecurity & Privacy",
      "Web & Mobile Development",
      "Internet of Things (IoT)",
      "FinTech & Blockchain",
      "Healthcare & BioTech",
      "Cloud & DevOps"
    ]
  };
  saveDB(db);
  res.json({ success: true, message: 'Sample dataset successfully restored', totalProblems: db.problems.length });
});

// PDF Text Extraction Engine with multi-method fallbacks
async function extractTextFromPDF(buffer) {
  if (!pdfParseModule) {
    throw new Error('PDF parsing library is not loaded on the server.');
  }

  let text = '';

  // Method 1: Modern pdf-parse v2+ PDFParse class
  try {
    if (pdfParseModule.PDFParse) {
      const parser = new pdfParseModule.PDFParse({ data: buffer });
      const res = await parser.getText();
      if (res && typeof res.text === 'string' && res.text.trim()) {
        text = res.text;
      }
    }
  } catch (err1) {
    console.warn('PDFParse class extraction attempt:', err1.message);
  }

  // Method 2: Legacy pdf-parse v1 function
  if (!text.trim()) {
    try {
      if (typeof pdfParseModule === 'function') {
        const res = await pdfParseModule(buffer);
        if (res && typeof res.text === 'string' && res.text.trim()) {
          text = res.text;
        }
      }
    } catch (err2) {
      console.warn('Legacy pdfParse function extraction attempt:', err2.message);
    }
  }

  // Method 3: Regex stream extraction fallback for uncompressed/direct text streams
  if (!text.trim()) {
    try {
      const raw = buffer.toString('latin1');
      const matches = raw.match(/\((?:\\.|[^\)\\])*\)\s*(?:Tj|'|TJ)/g);
      if (matches && matches.length > 0) {
        text = matches.map(m => {
          return m.replace(/^[\(\[]|[\)\]]\s*(?:Tj|'|TJ)$/g, '')
            .replace(/\\([()\\])/g, '$1')
            .replace(/\\r/g, '\r')
            .replace(/\\n/g, '\n');
        }).join(' ');
      }
    } catch (err3) {
      console.warn('Raw PDF stream extraction attempt:', err3.message);
    }
  }

  const clean = text
    .replace(/--\s*\d+\s+of\s+\d+\s*--/gi, '')
    .replace(/\f/g, '\n\n')
    .replace(/\r\n/g, '\n')
    .trim();

  if (!clean) {
    throw new Error('The PDF appears to have no selectable text layers. If it is a scanned document or photograph, please provide a text-searchable PDF, DOCX, TXT, CSV, or JSON file.');
  }

  return clean;
}

// Intelligent Text Statement Splitter
function parseStatementsFromText(text, targetDomain, sourceName) {
  const problems = [];
  const clean = text
    .replace(/--\s*\d+\s+of\s+\d+\s*--/gi, '')
    .replace(/\f/g, '\n\n')
    .replace(/\r\n/g, '\n')
    .trim();

  // Pattern matching statement headers:
  // e.g. "Problem Statement 1:", "Problem Statement:", "Challenge 2:", "1. ", "### Problem", "Case 1:"
  const splitPattern = /(?:^|\n)(?=(?:(?:Problem\s+(?:Statement\s+)?|PS\s*|Challenge\s*|Task\s*|Topic\s*|Q\s*)(?:#?\d+[\.:\-\)]|:|\s*\n)|\d+[\.:\-\)]\s+[A-Z]|#{1,3}\s+(?:Problem|Challenge|Task|\d+)))/i;
  
  let chunks = clean.split(splitPattern).map(c => c.trim()).filter(Boolean);

  // If pattern split didn't find multiple items, split by double newlines or paragraphs
  if (chunks.length <= 1) {
    chunks = clean.split(/\n\s*\n+/).map(c => c.trim()).filter(c => c.length >= 25);
  }

  // If still 1 chunk and length > 20, treat entire document content as a single statement
  if (chunks.length === 0 && clean.length > 20) {
    chunks = [clean];
  }

  // Filter out leading intro chunk if it's just a document title / header without a description
  if (chunks.length > 1) {
    const first = chunks[0];
    const firstLines = first.split('\n').map(l => l.trim()).filter(Boolean);
    const hasStatementMarker = /^(?:Problem|PS|Challenge|Task|Q|1[\.:\-\)])/i.test(firstLines[0]);
    if (!hasStatementMarker && (first.length < 90 || firstLines.length <= 2)) {
      chunks.shift(); // remove intro title chunk
    }
  }

  chunks.forEach((chunk, i) => {
    const lines = chunk.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return;

    let titleCandidate = lines[0];
    let descCandidate = lines.slice(1).join('\n').trim();

    // Clean up title prefixes like "Problem Statement 1: ", "1. ", "Challenge 2 - "
    titleCandidate = titleCandidate.replace(/^(?:Problem\s+(?:Statement\s+)?|PS\s*|Challenge\s*|Topic\s*|Q\s*|Task\s*)?(?:#?\d+[\.:\-\)]|:|\s*-)\s*/i, '');
    titleCandidate = titleCandidate.replace(/^[\*#\-_]+\s*/, '').replace(/\s*[\*#\-_]+$/, '');

    // If description is empty or very short, use title or fallback
    if (!descCandidate || descCandidate.length < 15) {
      if (titleCandidate.length > 60) {
        descCandidate = titleCandidate;
        titleCandidate = titleCandidate.substring(0, 50) + '...';
      } else {
        descCandidate = titleCandidate;
        titleCandidate = `Problem Statement #${i + 1}`;
      }
    }

    // Determine difficulty heuristic
    let diff = 'Intermediate';
    const lower = chunk.toLowerCase();
    if (lower.includes('advanced') || lower.includes('high') || lower.includes('complex') || lower.includes('expert')) {
      diff = 'Advanced';
    } else if (lower.includes('beginner') || lower.includes('easy') || lower.includes('simple') || lower.includes('starter')) {
      diff = 'Beginner';
    }

    problems.push({
      id: 'ps_doc_' + Date.now() + '_' + i + '_' + Math.random().toString(36).substring(2, 5),
      domain: targetDomain,
      title: titleCandidate || `Problem Statement #${i + 1}`,
      description: descCandidate || titleCandidate,
      difficulty: diff,
      source: sourceName,
      tags: [targetDomain],
      createdAt: new Date().toISOString()
    });
  });

  return problems;
}

const PORT = process.env.PORT || 3000;
if (require.main === module || !isVercel) {
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

module.exports = app;
