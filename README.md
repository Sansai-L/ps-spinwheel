# 🎯 SpinQuest PS | Problem Statement Roulette

A modern, interactive web application featuring an animated spinning wheel in the center, domain-specific problem statement selection with non-repeating cycle guarantees, multi-format document uploading (PDF, DOCX, TXT, CSV, JSON), and secure Admin role management.

---

## 🌟 Key Features

1. **Center Animated Spinning Wheel**:
   - Custom HTML5 Canvas roulette wheel with smooth realistic deceleration physics.
   - Dynamic needle pointer with responsive tick wiggle animation.
   - Synthesized mechanical ticking audio via the HTML5 Web Audio API (low-latency, zero external sound asset dependencies).
   - Confetti burst celebration upon wheel stopping.
   - Keyboard accessibility: hit <kbd>Spacebar</kbd> anytime to spin!

2. **Domain Selector**:
   - Dedicated side panel with visual category badges (Artificial Intelligence & ML, Cybersecurity & Privacy, Web & Mobile, IoT, FinTech & Blockchain, Healthcare & BioTech, Cloud & DevOps).
   - Real-time count of available problem statements per domain.
   - Clicking a domain instantly updates the center wheel and active pool.

3. **Smart Non-Repeating Cycle Engine**:
   - **Zero Duplicates Guarantee**: Problem statements are drawn without repetition until the entire pool for that domain has been seen.
   - **Visual Cycle Progress Bar**: Live indicator showing `X / Y seen` and `Z remaining in cycle`.
   - **Automatic Cycle Reset**: When all problem statements in a domain are exhausted, the cycle completes, alerts the user with a celebratory banner, and resets so all statements become available for the next round.
   - **Manual Reset**: Users can reset the cycle at any time if they want a clean shuffle.

4. **Interactive Problem Statement Pop-up**:
   - Pops up as soon as the spin completes.
   - Displays domain tag, difficulty level (Beginner / Intermediate / Advanced), source document, problem title, and detailed challenge requirements.
   - Includes one-click **"📋 Copy Statement"** and **"⚡ Spin Again"** buttons.

5. **Multi-Format Document Upload (Admin Only)**:
   - On the right side panel, an intuitive file drop zone supporting **PDF, DOC/DOCX, TXT, CSV, JSON, and MD**.
   - Admin selects the target domain, and the backend parser extracts individual problem statements automatically from the document (using pattern detection for numbered problems, headers, CSV rows, or JSON objects).
   - Non-admin visitors see an admin-lock banner with a direct "Admin Login" prompt.

6. **Admin Authentication & Management**:
   - Dedicated Admin Login page/modal.
   - **Default Credentials**:
     - **Username**: `admin`
     - **Password**: `admin123`
   - Role separation:
     - **Regular User**: Can pick domains, spin the wheel, view problem statements, track cycle progress, and explore the pool. Cannot upload or delete files.
     - **Admin**: Has full access to upload documents, add manual problem statements, inspect uploaded files, and delete unwanted problem statements or documents.

---

## 🚀 Getting Started

The server is currently running at:
```
http://localhost:3000
```

### To run manually:
```bash
cd C:\Users\sachx\.gemini\antigravity\scratch\problem-spin-wheel
npm start
```
Open [http://localhost:3000](http://localhost:3000) in your web browser.

---

## 📁 Sample Test Files Provided

Ready-to-upload sample files are included in the `test_documents/` directory:
- `iot_smart_city_challenges.txt` (Text file with numbered IoT problem statements)
- `fintech_hackathon_problems.json` (Structured JSON problem statements)
- `cyber_defense_scenarios.csv` (Spreadsheet format problem statements)

Log in as Admin (`admin` / `admin123`), choose the target domain, drop any of these files into the upload box, and click **"Extract & Add Problem Statements"**!
