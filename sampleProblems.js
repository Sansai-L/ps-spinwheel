// Problem Statements Pool — Seed Data including SIH 2026 Challenges
module.exports = [
  {
    "id": "ps_ai_01",
    "domain": "Artificial Intelligence & ML",
    "title": "Real-time Deforestation & Wildfire Detection via Satellite Imagery",
    "description": "Develop a computer vision pipeline that processes multi-spectral satellite imagery to detect early signs of illegal deforestation and active wildfire spread in near real-time, alerting forestry officials via automated alerts.",
    "difficulty": "Advanced",
    "source": "Default Seed",
    "tags": [
      "Computer Vision",
      "Satellite Data",
      "Conservation",
      "PyTorch"
    ]
  },
  {
    "id": "ps_ai_02",
    "domain": "Artificial Intelligence & ML",
    "title": "Low-Resource Language Conversational Healthcare Assistant",
    "description": "Build an offline-capable multilingual NLP voice & text bot providing triage and maternal health recommendations in regional dialects with low training corpus availability.",
    "difficulty": "Intermediate",
    "source": "Default Seed",
    "tags": [
      "NLP",
      "Healthcare",
      "Speech-to-Text",
      "Transformers"
    ]
  },
  {
    "id": "ps_ai_03",
    "domain": "Artificial Intelligence & ML",
    "title": "Adaptive Synthetic Data Generator for Medical Rare Disease Imaging",
    "description": "Design a conditional GAN or diffusion model that synthesizes high-fidelity, privacy-preserving radiological scans of rare respiratory conditions to balance training datasets without patient data leaks.",
    "difficulty": "Advanced",
    "source": "Default Seed",
    "tags": [
      "Generative AI",
      "Diffusion",
      "Privacy",
      "Radiology"
    ]
  },
  {
    "id": "ps_ai_04",
    "domain": "Artificial Intelligence & ML",
    "title": "Context-Aware Smart Code Reviewer with Security Hallucination Guardrails",
    "description": "Create an LLM-assisted developer agent that inspects pull requests, identifies logical edge-case bugs and CWE vulnerabilities, and verifies its own suggestions using static analysis execution tests.",
    "difficulty": "Intermediate",
    "source": "Default Seed",
    "tags": [
      "LLM",
      "DevSecOps",
      "Code Analysis"
    ]
  },
  {
    "id": "ps_sec_01",
    "domain": "Cybersecurity & Privacy",
    "title": "Autonomous Honeypot Network for Zero-Day IoT Exploit Harvesting",
    "description": "Deploy an adaptive decoy infrastructure mimicking industrial IoT devices to capture novel firmware exploits, log behavioral attack chains, and automatically generate Snort/Suricata defense signatures.",
    "difficulty": "Advanced",
    "source": "Default Seed",
    "tags": [
      "Honeypot",
      "Threat Intelligence",
      "IoT Security"
    ]
  },
  {
    "id": "ps_sec_02",
    "domain": "Cybersecurity & Privacy",
    "title": "Zero-Knowledge Credential Verification for University Hackathons",
    "description": "Implement a privacy-preserving authentication protocol using zk-SNARKs that enables students to prove enrollment and eligibility without revealing their personal student IDs, grades, or names.",
    "difficulty": "Intermediate",
    "source": "Default Seed",
    "tags": [
      "Zero-Knowledge",
      "Cryptography",
      "Identity"
    ]
  },
  {
    "id": "ps_sec_03",
    "domain": "Cybersecurity & Privacy",
    "title": "Automated Ransomware Canary & In-Memory Encryption Canary Guard",
    "description": "Create a lightweight kernel-level endpoint detection agent that plants deceptive decoy files and monitors file entropy spikes to kill encryptor processes within 200 milliseconds of anomalous activity.",
    "difficulty": "Advanced",
    "source": "Default Seed",
    "tags": [
      "Ransomware Defense",
      "Endpoint Security",
      "Kernel Monitoring"
    ]
  },
  {
    "id": "ps_sec_04",
    "domain": "Cybersecurity & Privacy",
    "title": "Phishing Resistance Sandbox for Corporate Email Attachments",
    "description": "Build an automated micro-VM detonation chamber that inspects incoming suspicious emails, renders macros safely in isolated browser containers, and extracts obfuscated credential harvesting links.",
    "difficulty": "Intermediate",
    "source": "Default Seed",
    "tags": [
      "Phishing",
      "Sandboxing",
      "Email Security"
    ]
  },
  {
    "id": "ps_web_01",
    "domain": "Web & Mobile Development",
    "title": "Peer-to-Peer Disaster Relief Communication Mesh WebApp",
    "description": "Develop a progressive web app (PWA) operating over WebRTC and local Wi-Fi direct mesh, enabling community members to exchange emergency resource needs and medical alerts when cellular towers are down.",
    "difficulty": "Intermediate",
    "source": "Default Seed",
    "tags": [
      "PWA",
      "WebRTC",
      "Offline-First",
      "Local Mesh"
    ]
  },
  {
    "id": "ps_web_02",
    "domain": "Web & Mobile Development",
    "title": "Collaborative Real-time 3D CAD Architecture Whiteboard",
    "description": "Build a multiplayer WebGL/Three.js interactive drafting canvas with CRDT-based synchronized edits (Yjs) allowing remote engineers to co-design blueprints without state divergence.",
    "difficulty": "Advanced",
    "source": "Default Seed",
    "tags": [
      "WebGL",
      "Three.js",
      "CRDT",
      "WebSockets"
    ]
  },
  {
    "id": "ps_web_03",
    "domain": "Web & Mobile Development",
    "title": "Micro-Frontend Analytics Dashboard with Zero-Latency Client Caching",
    "description": "Design an enterprise web dashboard utilizing Module Federation and service worker streaming to assemble widgets independently with sub-50ms paint times and offline historical caching.",
    "difficulty": "Intermediate",
    "source": "Default Seed",
    "tags": [
      "Microfrontends",
      "Performance",
      "Service Worker"
    ]
  },
  {
    "id": "ps_web_04",
    "domain": "Web & Mobile Development",
    "title": "Accessible Voice & Eye-Tracking Web Navigator for Motor Impairments",
    "description": "Engineer an in-browser assistive overlay using TensorFlow.js face landmark detection that allows users with mobility restrictions to scroll, select, and type using head gestures and gaze dwell time.",
    "difficulty": "Advanced",
    "source": "Default Seed",
    "tags": [
      "Accessibility",
      "Webcam AI",
      "Assistive Tech"
    ]
  },
  {
    "id": "ps_iot_01",
    "domain": "Internet of Things (IoT)",
    "title": "Solar-Powered Smart Agriculture Water Allocation Sensor Grid",
    "description": "Build an ESP32 LoRaWAN-connected soil telemetry unit combining capacitive moisture readings with weather forecast APIs to automate micro-drip irrigation valves and curb water waste by 40%.",
    "difficulty": "Intermediate",
    "source": "Default Seed",
    "tags": [
      "ESP32",
      "LoRaWAN",
      "AgriTech",
      "Sensors"
    ]
  },
  {
    "id": "ps_iot_02",
    "domain": "Internet of Things (IoT)",
    "title": "Edge Acoustic Sensor for Predictive Factory Motor Failure",
    "description": "Design an ultra-low power vibration and acoustic edge sensor running TinyML that classifies bearing wear patterns and broadcasts maintenance alerts before mechanical seizure occurs.",
    "difficulty": "Advanced",
    "source": "Default Seed",
    "tags": [
      "TinyML",
      "Predictive Maintenance",
      "Embedded C"
    ]
  },
  {
    "id": "ps_iot_03",
    "domain": "Internet of Things (IoT)",
    "title": "Cold-Chain Vaccine Temperature Integrity Blackbox Tracker",
    "description": "Create a tamper-evident GPS & BLE thermal logger with cryptographic audit logs that records temperature fluctuations during vaccine transit and triggers instant QA rejection upon threshold violation.",
    "difficulty": "Intermediate",
    "source": "Default Seed",
    "tags": [
      "Hardware",
      "BLE",
      "Supply Chain",
      "Logistics"
    ]
  },
  {
    "id": "ps_cloud_01",
    "domain": "Cloud & DevOps",
    "title": "Self-Healing Kubernetes Controller for Cascading Microservice Outages",
    "description": "Build an autonomous Kubernetes operator that detects circuit-breaker trip storms and dynamically scales fallback mock responses while throttling upstream dependencies.",
    "difficulty": "Advanced",
    "source": "Default Seed",
    "tags": [
      "Kubernetes",
      "Golang",
      "SRE",
      "Resilience"
    ]
  },
  {
    "id": "ps_cloud_02",
    "domain": "Cloud & DevOps",
    "title": "FinOps Multi-Cloud Spot Instance Auto-Migrator with Zero-Downtime",
    "description": "Develop an agent that orchestrates zero-interruption container migration across AWS Spot and GCP Preemptible VMs upon receiving 2-minute pre-termination signals.",
    "difficulty": "Intermediate",
    "source": "Default Seed",
    "tags": [
      "FinOps",
      "Cloud Cost",
      "Spot Instances"
    ]
  },
  {
    "id": "sih_web_01",
    "domain": "Smart Automation",
    "track": "Web & Mobile Development",
    "title": "Conversational Image Recognition Chatbot",
    "description": "Problem: Users often need quick answers about objects or scenes they encounter, but typing out detailed text queries is slow and doesn't always capture what they're looking at.\n\nExpected Solution: A chatbot that accepts both images and natural-language queries, combining image recognition with conversational AI to identify objects/scenes and answer follow-up questions. Suggested tech: Python, computer vision models, NLP/LLM APIs, web/mobile chat interface.",
    "difficulty": "Intermediate",
    "source": "SIH 2026",
    "tags": [
      "Computer Vision",
      "Chatbot",
      "LLM APIs",
      "Web/Mobile"
    ]
  },
  {
    "id": "sih_web_02",
    "domain": "Smart Automation",
    "track": "Web & Mobile Development",
    "title": "AI-based Traffic Management System",
    "description": "Problem: Fixed-timing traffic signals can't adapt to real-time traffic conditions, which leads to congestion and inefficient flow.\n\nExpected Solution: An AI-based system that analyzes live traffic data and dynamically adjusts signal timing to optimize flow, with a monitoring dashboard for traffic authorities. Suggested tech: Python, computer vision/reinforcement learning, FastAPI backend, React dashboard.",
    "difficulty": "Advanced",
    "source": "SIH 2026",
    "tags": [
      "Traffic Control",
      "Computer Vision",
      "FastAPI",
      "React Dashboard"
    ]
  },
  {
    "id": "sih_web_03",
    "domain": "Smart Automation",
    "track": "Web & Mobile Development",
    "title": "Dynamic Route Rationalization Model Using AI/ML",
    "description": "Problem: Transit and delivery routes are often static and don't adapt to changing demand or traffic patterns, causing inefficiency.\n\nExpected Solution: An AI/ML model that analyzes demand and traffic data to dynamically rationalize and recommend optimal routes. Suggested tech: Python, optimization/ML libraries (OR-Tools, Scikit-learn), React dashboard, cloud database.",
    "difficulty": "Advanced",
    "source": "SIH 2026",
    "tags": [
      "Route Optimization",
      "OR-Tools",
      "Scikit-Learn",
      "React Dashboard"
    ]
  },
  {
    "id": "sih_web_04",
    "domain": "Smart Automation",
    "track": "Web & Mobile Development",
    "title": "Online Issuance of Caste and Other Certificates with Real-Time Monitoring",
    "description": "Problem: Applying for caste and other government certificates through manual processes is slow, opaque, and hard for applicants to track.\n\nExpected Solution: A web platform for citizens to apply for certificates online, with real-time status monitoring and an admin dashboard for officials to process and verify applications. Suggested tech: React/Next.js, Node.js/Django backend, PostgreSQL, e-Sign integration.",
    "difficulty": "Intermediate",
    "source": "SIH 2026",
    "tags": [
      "E-Governance",
      "React/Next.js",
      "PostgreSQL",
      "e-Sign Integration"
    ]
  },
  {
    "id": "sih_web_05",
    "domain": "Smart Automation",
    "track": "Web & Mobile Development",
    "title": "Tyre Maintenance and Operation App for Dumpers",
    "description": "Problem: Dumper trucks used in mining and construction often suffer tyre-related breakdowns due to a lack of systematic maintenance tracking, increasing downtime and costs.\n\nExpected Solution: A mobile app for operators and maintenance teams to log tyre condition, usage, and service schedules, with a dashboard that flags tyres due for maintenance or replacement. Suggested tech: React Native/Flutter, Node.js backend, cloud database, analytics dashboard.",
    "difficulty": "Intermediate",
    "source": "SIH 2026",
    "tags": [
      "Fleet Maintenance",
      "React Native",
      "Flutter",
      "Analytics Dashboard"
    ]
  },
  {
    "id": "sih_web_06",
    "domain": "Smart Automation",
    "track": "Web & Mobile Development",
    "title": "Web/App Platform Integrating Diverse Services to Enhance Urban Living",
    "description": "Problem: City residents often need to navigate multiple disconnected platforms for different municipal and urban services, creating friction and confusion.\n\nExpected Solution: A unified web/app platform that integrates diverse urban services (e.g. utility payments, civic complaints, local information) into a single, easy-to-use interface. Suggested tech: React/Next.js, React Native/Flutter, microservices backend (Node.js/Django), API gateway.",
    "difficulty": "Intermediate",
    "source": "SIH 2026",
    "tags": [
      "Smart Cities",
      "Next.js",
      "React Native",
      "Microservices"
    ]
  },
  {
    "id": "sih_web_07",
    "domain": "Healthcare & MedTech",
    "track": "Web & Mobile Development",
    "title": "Emotional Well-being Tracker Using Web/App Development",
    "description": "Problem: People often lack a simple, consistent way to track their emotional well-being over time, making it hard to notice patterns or seek help early.\n\nExpected Solution: A web/mobile app where users log their mood and emotional state regularly, with visualizations of trends over time and gentle prompts to seek support when patterns suggest concern. Suggested tech: React/Flutter, Node.js backend, cloud database, data visualization libraries.",
    "difficulty": "Beginner",
    "source": "SIH 2026",
    "tags": [
      "Mental Health",
      "Mood Tracking",
      "Data Visualization",
      "React",
      "Flutter"
    ]
  },
  {
    "id": "sih_web_08",
    "domain": "Healthcare & MedTech",
    "track": "Web & Mobile Development",
    "title": "Smart Community Health Monitoring and Early Warning System for Water-Borne Diseases",
    "description": "Problem: Water-borne disease outbreaks in communities often go undetected until they've already spread widely, due to a lack of systematic case data collection and analysis.\n\nExpected Solution: A data-collection app for health workers to log symptoms and cases, feeding an analytics engine that detects early outbreak patterns and alerts health authorities. Suggested tech: Flutter/React Native, Node.js/Django backend, predictive analytics (Python/ML), web dashboard.",
    "difficulty": "Advanced",
    "source": "SIH 2026",
    "tags": [
      "Epidemic Surveillance",
      "Flutter",
      "Predictive Analytics",
      "Health Dashboard"
    ]
  },
  {
    "id": "sih_web_09",
    "domain": "Healthcare & MedTech",
    "track": "Web & Mobile Development",
    "title": "Telemedicine Access for Rural Healthcare",
    "description": "Problem: Rural populations often lack access to doctors and specialists, and traveling to healthcare facilities can be costly or impractical.\n\nExpected Solution: A web platform enabling secure video consultations between rural patients and doctors, with integrated digital health records. Suggested tech: React, WebRTC for video calling, Node.js/Django backend, encrypted health record storage.",
    "difficulty": "Intermediate",
    "source": "SIH 2026",
    "tags": [
      "Telemedicine",
      "WebRTC Video",
      "EHR",
      "Encrypted Storage"
    ]
  },
  {
    "id": "sih_web_10",
    "domain": "Healthcare & MedTech",
    "track": "Web & Mobile Development",
    "title": "AyurSutra - Panchakarma Patient Management and Therapy Scheduling Software",
    "description": "Problem: Panchakarma therapy centers need a specialized way to manage patient records, treatment plans, and therapy scheduling, which generic healthcare software doesn't handle well.\n\nExpected Solution: A specialized patient management and therapy-scheduling web app tailored to Panchakarma/Ayurvedic treatment workflows, covering treatment plans, appointments, and records. Suggested tech: React/Angular, Node.js/Django backend, PostgreSQL.",
    "difficulty": "Intermediate",
    "source": "SIH 2026",
    "tags": [
      "AyurSutra",
      "Therapy Scheduling",
      "Patient Records",
      "PostgreSQL"
    ]
  },
  {
    "id": "sih_web_11",
    "domain": "Smart Education & EdTech",
    "track": "Web & Mobile Development",
    "title": "Interactive Gaming Web/App Platform Focused on Children's Rights",
    "description": "Problem: Children often don't have accessible, engaging ways to learn about their rights, leaving them less aware of the protections available to them.\n\nExpected Solution: An interactive, game-based web/app platform that teaches children about their rights through age-appropriate stories, quizzes, and challenges. Suggested tech: React/Flutter, gamification engine, cloud backend for progress tracking.",
    "difficulty": "Beginner",
    "source": "SIH 2026",
    "tags": [
      "Gamification",
      "Children's Rights",
      "EdTech",
      "Flutter"
    ]
  },
  {
    "id": "sih_web_12",
    "domain": "Smart Education & EdTech",
    "track": "Web & Mobile Development",
    "title": "Gamified Environmental Education Platform for Schools and Colleges",
    "description": "Problem: Traditional environmental education in schools and colleges often fails to engage students, limiting awareness and behavior change around sustainability.\n\nExpected Solution: An interactive, gamified web/app learning platform that teaches environmental concepts through challenges, quizzes, and rewards tailored for students. Suggested tech: React/Flutter, gamification engine, cloud backend for progress tracking.",
    "difficulty": "Beginner",
    "source": "SIH 2026",
    "tags": [
      "Sustainability",
      "Gamification",
      "Environmental Science",
      "React"
    ]
  },
  {
    "id": "sih_web_13",
    "domain": "Smart Education & EdTech",
    "track": "Web & Mobile Development",
    "title": "Digital Platform for Centralized Alumni Data Management and Engagement",
    "description": "Problem: Institutions often struggle to maintain updated alumni records and keep alumni engaged with the institution and current students.\n\nExpected Solution: A web platform that centralizes alumni data and enables ongoing engagement through directories, events, mentorship matching, and networking features. Suggested tech: React/Next.js, Node.js/Django backend, PostgreSQL.",
    "difficulty": "Intermediate",
    "source": "SIH 2026",
    "tags": [
      "Alumni Management",
      "Mentorship",
      "Next.js",
      "Networking"
    ]
  },
  {
    "id": "sih_web_14",
    "domain": "Disaster Management",
    "track": "Web & Mobile Development",
    "title": "Crisis Management and Relief Platform Using a Web/App Platform",
    "description": "Problem: During crises, coordinating relief efforts, resources, and information across agencies and affected communities is often slow and fragmented.\n\nExpected Solution: A web/app platform that centralizes crisis reporting, resource coordination, and relief updates, connecting authorities, relief workers, and affected communities in real time. Suggested tech: React/Next.js, React Native/Flutter, Node.js backend, real-time messaging (WebSockets), cloud database.",
    "difficulty": "Advanced",
    "source": "SIH 2026",
    "tags": [
      "Crisis Coordination",
      "WebSockets",
      "Relief Management",
      "Next.js"
    ]
  },
  {
    "id": "sih_web_15",
    "domain": "Disaster Management",
    "track": "Web & Mobile Development",
    "title": "Disaster Preparedness and Response Education System for Schools and Colleges",
    "description": "Problem: Students and staff in schools and colleges often lack structured training on how to prepare for and respond to disasters.\n\nExpected Solution: An e-learning system tailored for schools and colleges that delivers disaster preparedness lessons, drills, and scenario simulations through a web/mobile interface. Suggested tech: React/Next.js (PWA), React Native/Flutter, Node.js backend, cloud content delivery.",
    "difficulty": "Intermediate",
    "source": "SIH 2026",
    "tags": [
      "Disaster Drills",
      "Simulation",
      "PWA",
      "E-Learning"
    ]
  },
  {
    "id": "sih_web_16",
    "domain": "Cybersecurity & Privacy",
    "track": "Web & Mobile Development",
    "title": "Gamified Cybersecurity Awareness Web/Mobile Application",
    "description": "Problem: Many users lack awareness of basic cybersecurity practices, making them vulnerable to phishing, scams, and other common threats.\n\nExpected Solution: A gamified web/mobile app that teaches cybersecurity best practices through interactive challenges, simulated phishing scenarios, and quizzes with rewards. Suggested tech: React/Flutter, gamification engine, Node.js backend, cloud database.",
    "difficulty": "Beginner",
    "source": "SIH 2026",
    "tags": [
      "Phishing Simulation",
      "Gamified Security",
      "Flutter",
      "Cybersecurity"
    ]
  },
  {
    "id": "sih_web_17",
    "domain": "Travel & Tourism",
    "track": "Web & Mobile Development",
    "title": "Smart Tourist Safety Monitoring & Incident Response System",
    "description": "Problem: Tourists in unfamiliar areas face safety risks, and authorities often lack real-time visibility to monitor tourist safety and respond quickly to incidents.\n\nExpected Solution: A mobile app for tourists with safety monitoring and SOS alerts, paired with a web dashboard for authorities to track incidents and coordinate rapid response. Suggested tech: React Native/Flutter, geofencing APIs, Node.js backend, React dashboard.",
    "difficulty": "Intermediate",
    "source": "SIH 2026",
    "tags": [
      "Tourist Safety",
      "Geofencing",
      "SOS Response",
      "React Dashboard"
    ]
  },
  {
    "id": "sih_web_18",
    "domain": "Agriculture & Rural Development",
    "track": "Web & Mobile Development",
    "title": "Digital Farm Management Portal for Implementing Biosecurity Measures",
    "description": "Problem: Farms lack a centralized way to track and enforce biosecurity measures, making compliance and outbreak prevention difficult.\n\nExpected Solution: A web portal for farmers to log and track biosecurity practices, livestock/crop health records, and compliance checklists. Suggested tech: React/Next.js, Node.js/Django backend, PostgreSQL.",
    "difficulty": "Intermediate",
    "source": "SIH 2026",
    "tags": [
      "Biosecurity",
      "Farm Management",
      "Compliance",
      "PostgreSQL"
    ]
  },
  {
    "id": "sih_web_19",
    "domain": "Agriculture & Rural Development",
    "track": "Web & Mobile Development",
    "title": "Smart Crop Advisory System for Small and Marginal Farmers",
    "description": "Problem: Small and marginal farmers often lack timely, localized crop advisory guidance suited to their limited resources and local conditions.\n\nExpected Solution: A mobile app that delivers simple, localized crop advisory guidance based on soil, weather, and market conditions, designed for low-literacy and low-connectivity contexts. Suggested tech: Flutter/React Native, offline-first architecture, Bhashini API (for local languages), cloud sync backend.",
    "difficulty": "Intermediate",
    "source": "SIH 2026",
    "tags": [
      "Crop Advisory",
      "Offline-First",
      "Bhashini AI",
      "Multilingual"
    ]
  },
  {
    "id": "sih_web_20",
    "domain": "Transportation & Logistics",
    "track": "Web & Mobile Development",
    "title": "Real-Time Public Transport Tracking for Small Cities",
    "description": "Problem: Commuters in small cities often lack reliable, real-time visibility into public transport arrival times, leading to wasted waiting time.\n\nExpected Solution: A GPS-integrated mobile app tailored for smaller transit systems that shows commuters real-time bus/transport locations and estimated arrival times. Suggested tech: React Native/Flutter, GPS/live location APIs, Node.js backend, WebSockets.",
    "difficulty": "Intermediate",
    "source": "SIH 2026",
    "tags": [
      "Live Bus Tracking",
      "GPS APIs",
      "WebSockets",
      "Transit"
    ]
  },
  {
    "id": "sih_ai_01",
    "domain": "Healthcare & MedTech",
    "track": "Artificial Intelligence & ML",
    "title": "Smart Community Health Monitoring and Early Warning System for Water-Borne Diseases (AI/ML)",
    "description": "Problem: Water-borne disease outbreaks in communities often go undetected until they've already spread, due to a lack of systematic health monitoring and early alerts.\n\nExpected Solution: A predictive-analytics platform that monitors community health data and flags early warning signs of water-borne disease outbreaks so authorities can respond before they spread. Suggested tech: Python, predictive analytics/ML models, cloud database, React/Flutter dashboard.",
    "difficulty": "Advanced",
    "source": "SIH 2026",
    "tags": [
      "Epidemic Modeling",
      "Predictive Analytics",
      "Python",
      "React/Flutter"
    ]
  },
  {
    "id": "sih_ai_02",
    "domain": "Healthcare & MedTech",
    "track": "Artificial Intelligence & ML",
    "title": "AI-based Medical Diagnosis Assistant",
    "description": "Problem: Patients, especially in under-served areas, often lack quick access to a first assessment of their symptoms to know when and where to seek care.\n\nExpected Solution: An AI-based assistant that uses NLP and classification models to analyze patient-reported symptoms and provide a preliminary diagnosis suggestion along with guidance on next steps. Suggested tech: Python, NLP/classification models, web/mobile app, cloud database.",
    "difficulty": "Advanced",
    "source": "SIH 2026",
    "tags": [
      "Clinical NLP",
      "Classification Models",
      "Diagnosis Assistant",
      "Python"
    ]
  },
  {
    "id": "sih_ai_03",
    "domain": "Healthcare & MedTech",
    "track": "Artificial Intelligence & ML",
    "title": "Telemedicine Chatbot for Rural Clinics",
    "description": "Problem: Rural clinics often face a shortage of doctors and language barriers, making it hard for patients to get timely medical guidance.\n\nExpected Solution: A conversational AI chatbot for rural clinics that uses NLP to triage patient queries, answer common health questions, and connect patients with clinic staff or telemedicine services when needed. Suggested tech: Python, NLP/conversational AI (LLM APIs), web/mobile chat interface, multilingual support.",
    "difficulty": "Intermediate",
    "source": "SIH 2026",
    "tags": [
      "Triage Chatbot",
      "LLM APIs",
      "Multilingual Support",
      "Rural Health"
    ]
  },
  {
    "id": "sih_ai_04",
    "domain": "Healthcare & MedTech",
    "track": "Artificial Intelligence & ML",
    "title": "AI Chatbot for Mental Health Support and Emotion Recognition",
    "description": "Problem: Many people hesitate to seek mental health support due to stigma, cost, or limited access to counselors, especially when they need immediate emotional support.\n\nExpected Solution: An AI chatbot that uses sentiment analysis to understand a user's emotional state through conversation, offer supportive responses, and flag cases that need escalation to a human counselor. Suggested tech: Python, NLP/sentiment analysis models, web/mobile app.",
    "difficulty": "Intermediate",
    "source": "SIH 2026",
    "tags": [
      "Sentiment Analysis",
      "Emotion Recognition",
      "Mental Health AI",
      "NLP"
    ]
  },
  {
    "id": "sih_ai_05",
    "domain": "Healthcare & MedTech",
    "track": "Artificial Intelligence & ML",
    "title": "Early Symptom Prediction System for Chronic Diseases",
    "description": "Problem: Chronic diseases such as diabetes and heart disease are often diagnosed late because early, subtle symptoms go unnoticed or unreported.\n\nExpected Solution: A system that applies classification algorithms to patient-reported symptoms and health data to predict the likelihood of a chronic disease and recommend early medical consultation. Suggested tech: Python, Scikit-learn/TensorFlow classification models, web/mobile input interface, cloud database.",
    "difficulty": "Advanced",
    "source": "SIH 2026",
    "tags": [
      "Chronic Disease",
      "TensorFlow",
      "Scikit-Learn",
      "Predictive Health"
    ]
  },
  {
    "id": "sih_ai_06",
    "domain": "Travel & Tourism",
    "track": "Artificial Intelligence & ML",
    "title": "Smart Tourist Safety Monitoring & Incident Response System using AI and Geo-Fencing",
    "description": "Problem: Tourists in unfamiliar areas face safety risks, and authorities often lack real-time visibility to detect unusual situations and respond quickly.\n\nExpected Solution: An AI system that applies anomaly detection to tourist location and activity data within geo-fenced zones, alerting authorities to potential incidents for rapid response. Suggested tech: Python, anomaly detection models, geofencing APIs, mobile app, cloud backend.",
    "difficulty": "Intermediate",
    "source": "SIH 2026",
    "tags": [
      "Anomaly Detection",
      "Geofencing AI",
      "Tourist Safety",
      "Python"
    ]
  },
  {
    "id": "sih_ai_07",
    "domain": "SpaceTech & Environment",
    "track": "Artificial Intelligence & ML",
    "title": "AI/ML based System for Deriving Value Added Parameters using Satellite Imagery",
    "description": "Problem: Raw satellite imagery is difficult for non-experts to interpret directly, limiting its usefulness for agriculture, urban planning, and environmental monitoring.\n\nExpected Solution: A computer-vision-based system that processes raw satellite imagery to automatically derive value-added parameters (e.g. vegetation index, land-use classification) and presents them through a usable interface. Suggested tech: Python, OpenCV/deep-learning models, cloud processing pipeline, web dashboard.",
    "difficulty": "Advanced",
    "source": "SIH 2026",
    "tags": [
      "Satellite Imagery",
      "Vegetation Index",
      "OpenCV",
      "Remote Sensing"
    ]
  },
  {
    "id": "sih_ai_08",
    "domain": "SpaceTech & Environment",
    "track": "Artificial Intelligence & ML",
    "title": "Deep Learning Web Application to Automate Tree Enumeration in Forest Areas",
    "description": "Problem: Manually counting and enumerating trees across large forest areas is slow, labor-intensive, and hard to scale.\n\nExpected Solution: A deep-learning web application that uses image segmentation on aerial or satellite imagery to automatically detect and count trees across forest areas. Suggested tech: Python, deep-learning segmentation models (U-Net/Mask R-CNN), React web app, cloud image processing.",
    "difficulty": "Advanced",
    "source": "SIH 2026",
    "tags": [
      "U-Net",
      "Mask R-CNN",
      "Forestry",
      "Deep Learning Segmentation"
    ]
  },
  {
    "id": "sih_ai_09",
    "domain": "Smart Automation",
    "track": "Artificial Intelligence & ML",
    "title": "Real-Time Traffic Congestion Predictor",
    "description": "Problem: Drivers and commuters often lack advance warning of traffic congestion, leading to wasted time and inefficient route choices.\n\nExpected Solution: A system that uses time-series forecasting on historical and live traffic data to predict congestion levels on key routes and display them through a web/mobile interface. Suggested tech: Python, time-series ML (LSTM/Prophet), React/Flutter interface, cloud data pipeline.",
    "difficulty": "Intermediate",
    "source": "SIH 2026",
    "tags": [
      "Time-Series",
      "LSTM",
      "Prophet",
      "Traffic Forecasting"
    ]
  },
  {
    "id": "sih_ai_10",
    "domain": "Smart Automation",
    "track": "Artificial Intelligence & ML",
    "title": "AI-Powered Building Maintenance System",
    "description": "Problem: Building maintenance issues are often identified reactively, after equipment fails, leading to higher repair costs and downtime.\n\nExpected Solution: An AI-powered system that applies predictive analytics to building sensor/maintenance-log data to forecast equipment issues before they occur and schedule preventive maintenance. Suggested tech: Python, predictive analytics/ML models, web dashboard, cloud database.",
    "difficulty": "Intermediate",
    "source": "SIH 2026",
    "tags": [
      "Predictive Maintenance",
      "Sensor Analytics",
      "IoT Data",
      "Python"
    ]
  },
  {
    "id": "sih_ai_11",
    "domain": "Smart Automation",
    "track": "Artificial Intelligence & ML",
    "title": "Dynamic Route Rationalization Model for Public Transit",
    "description": "Problem: Public transit routes are often static and don't adapt to changing demand patterns, leading to inefficiency — overcrowding on some routes and underuse on others.\n\nExpected Solution: A software model that applies optimization algorithms to ridership and traffic data to dynamically rationalize and suggest transit routes for better efficiency and coverage. Suggested tech: Python, optimization libraries (OR-Tools), React dashboard, cloud database.",
    "difficulty": "Advanced",
    "source": "SIH 2026",
    "tags": [
      "Transit Optimization",
      "OR-Tools",
      "Graph Algorithms",
      "Python"
    ]
  },
  {
    "id": "sih_ai_12",
    "domain": "Smart Automation",
    "track": "Artificial Intelligence & ML",
    "title": "AI-Based Traffic Management and Adaptive Signal Control",
    "description": "Problem: Fixed-timing traffic signals can't adapt to real-time traffic conditions, which leads to congestion and inefficient flow.\n\nExpected Solution: A reinforcement-learning-based system that analyzes real-time traffic data feeds and adaptively controls signal timing to optimize flow, with a monitoring dashboard for traffic authorities. Suggested tech: Python, reinforcement learning frameworks, FastAPI backend, React dashboard.",
    "difficulty": "Advanced",
    "source": "SIH 2026",
    "tags": [
      "Reinforcement Learning",
      "Adaptive Signal Control",
      "FastAPI",
      "React"
    ]
  },
  {
    "id": "sih_ai_13",
    "domain": "Smart Automation",
    "track": "Artificial Intelligence & ML",
    "title": "Automated Defective Exhibit Identification System",
    "description": "Problem: Manually inspecting exhibits or products for defects is time-consuming and prone to human error, especially at scale.\n\nExpected Solution: An image-classification system that automatically analyzes uploaded images to detect and flag defective exhibits or items, with a dashboard for human review. Suggested tech: Python, CNN/image classification models, web dashboard, cloud storage.",
    "difficulty": "Intermediate",
    "source": "SIH 2026",
    "tags": [
      "Computer Vision",
      "Defect Detection",
      "CNN",
      "Quality Inspection"
    ]
  },
  {
    "id": "sih_ai_14",
    "domain": "Transportation & Logistics",
    "track": "Artificial Intelligence & ML",
    "title": "Last Mile Delivery Route Optimizer",
    "description": "Problem: Last-mile delivery is often the least efficient part of the logistics chain, with drivers taking suboptimal routes that increase cost and delivery time.\n\nExpected Solution: A route-optimization tool that applies optimization algorithms to delivery addresses, traffic, and time-window constraints to generate the most efficient last-mile delivery routes. Suggested tech: Python, optimization libraries (OR-Tools), Google Maps API, web/mobile app for drivers.",
    "difficulty": "Intermediate",
    "source": "SIH 2026",
    "tags": [
      "Last-Mile Logistics",
      "OR-Tools",
      "Google Maps API",
      "Optimization"
    ]
  },
  {
    "id": "sih_ai_15",
    "domain": "Disaster Management",
    "track": "Artificial Intelligence & ML",
    "title": "Explainable AI (XAI) Model for Predicting High-Impact Rain",
    "description": "Problem: Existing rainfall-prediction models often act as \"black boxes,\" making it hard for authorities to trust or act confidently on forecasts of high-impact rain events.\n\nExpected Solution: A time-series forecasting model for high-impact rain events that incorporates explainable AI (XAI) techniques, so forecasters can see and trust the reasoning behind each prediction. Suggested tech: Python, time-series ML (LSTM/Prophet), XAI libraries (SHAP/LIME), web dashboard.",
    "difficulty": "Advanced",
    "source": "SIH 2026",
    "tags": [
      "Explainable AI (XAI)",
      "SHAP/LIME",
      "LSTM/Prophet",
      "Weather AI"
    ]
  },
  {
    "id": "sih_ai_16",
    "domain": "Disaster Management",
    "track": "Artificial Intelligence & ML",
    "title": "ML Model to Predict and Mitigate Natural Disaster Risks",
    "description": "Problem: Disaster-prone regions often lack timely, data-driven risk assessments to guide preparedness and mitigation planning.\n\nExpected Solution: A machine learning model that performs spatial data analysis on historical disaster and geographic data to predict risk zones and suggest mitigation measures, presented through an interactive map-based dashboard. Suggested tech: Python, spatial ML/GIS libraries, PostGIS, React/Mapbox dashboard.",
    "difficulty": "Advanced",
    "source": "SIH 2026",
    "tags": [
      "Spatial ML",
      "PostGIS",
      "Mapbox",
      "Disaster Prediction"
    ]
  },
  {
    "id": "sih_ai_017",
    "domain": "Agriculture & Rural Development",
    "track": "Artificial Intelligence & ML",
    "title": "AI-Powered Crop Recommendation System",
    "description": "Problem: Farmers often lack data-driven guidance on which crops best suit their soil, climate, and market conditions, which can lead to suboptimal yields.\n\nExpected Solution: A recommendation system that analyzes soil, weather, and market data to suggest optimal crops for a farmer's specific conditions, delivered through a mobile/web app. Suggested tech: Python, recommendation algorithms, cloud database, Flutter/React app.",
    "difficulty": "Intermediate",
    "source": "SIH 2026",
    "tags": [
      "Crop Recommendation",
      "Soil Analysis",
      "Precision Farming",
      "Flutter"
    ]
  },
  {
    "id": "sih_ai_18",
    "domain": "Agriculture & Rural Development",
    "track": "Artificial Intelligence & ML",
    "title": "Smart Transportation Route Optimization for Agri-Produce",
    "description": "Problem: Agricultural produce often spoils or loses value in transit due to inefficient routing from farms to markets.\n\nExpected Solution: A routing system that applies graph algorithms to optimize the transportation of produce from farms to markets, minimizing time and spoilage. Suggested tech: Python, graph/routing algorithms (Dijkstra/OR-Tools), Google Maps API, web dashboard.",
    "difficulty": "Intermediate",
    "source": "SIH 2026",
    "tags": [
      "Agri-Logistics",
      "Cold-Chain Routing",
      "Graph Algorithms",
      "OR-Tools"
    ]
  },
  {
    "id": "sih_ai_19",
    "domain": "Smart Education & EdTech",
    "track": "Artificial Intelligence & ML",
    "title": "AI-Powered Personalized Student Study Plan Generator",
    "description": "Problem: Students learn at different paces and have different strengths, but most study plans are generic and don't adapt to individual needs.\n\nExpected Solution: An app that uses clustering and generative AI to analyze a student's performance and learning style, then generates a personalized study plan. Suggested tech: Python, generative AI/LLM APIs, clustering algorithms, web/mobile app.",
    "difficulty": "Intermediate",
    "source": "SIH 2026",
    "tags": [
      "Personalized Learning",
      "Clustering",
      "LLM APIs",
      "EdTech"
    ]
  },
  {
    "id": "sih_ai_20",
    "domain": "Smart Automation",
    "track": "Artificial Intelligence & ML",
    "title": "Automated Canonical Place Name Extraction from Text",
    "description": "Problem: Text documents such as news reports and records often reference place names inconsistently (abbreviations, variants, misspellings), which makes it hard to standardize location data.\n\nExpected Solution: An NLP-based tool that uses Named Entity Recognition (NER) to extract place names from text and map them to their canonical, standardized form. Suggested tech: Python, NER models (spaCy/Transformers), cloud database, API for standardized lookups.",
    "difficulty": "Intermediate",
    "source": "SIH 2026",
    "tags": [
      "NER",
      "NLP",
      "spaCy",
      "Transformers",
      "Place Name Extraction"
    ]
  }
];
