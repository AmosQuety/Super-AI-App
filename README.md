# 💎 Xemora: The Biometric Intelligence Platform

![Project Banner](image.png)

**Xemora** is a production-grade, multi-modal AI workspace that seamlessly integrates **Biometric Security**, **Computer Vision**, and **Generative Intelligence** into a unified, premium interface.

It features a distributed microservices architecture, separating the **Node.js Gateway (The Manager)** from the **Python AI Engine (The Brain)**, enabling secure, scalable face recognition, speaker verification, and document intelligence.

---

## 🚀 Live Demo
*  **Video Demo:** [https://youtu.be/E5pNRct9X4Q](https://youtu.be/E5pNRct9X4Q)
*   **Frontend:** [https://prism-vision.vercel.app](https://prism-vision.vercel.app)
*   **Backend API:** Available in the hosted app; direct deployment links are intentionally omitted.
*   **AI Engine:** Available in the hosted app; direct deployment links are intentionally omitted.

---

## ✨ Key Features

### 📈 Integrated Dashboard (Core Layout)
*   **Bento Grid Interface:** A modular, high-end dashboard providing real-time telemetry and quick-access cards for all platform features.
*   **Global Quick Actions:** Header-level action chips for one-click access to face analysis, email drafting, and image generation.
*   **Liquid UI Experience:** Powered by Framer Motion, featuring smooth transitions, glassmorphism, and responsive layouts.
*   **Universal Search & Nav:** Integrated sidebar and mobile-friendly navigation with active-state tracking.

### ☄️ Blaze Intelligence (Personalization)
*   **Persona Configuration:** Custom-tune the AI's tone (Casual/Formal), technical depth (Beginner to Expert), and verbosity.
*   **Professional Context Injection:** Define your role, domain expertise, and current goals to receive hyper-personalized assistance across all chat sessions.
*   **Language & Format Mastery:** Set global preferences for communication languages and response formats (Narrative, Bullet Points, or Mixed).

### 🛡️ Biometric Security Center (SOC)
*   **Security Operations Center (SOC):** Real-time audit logs monitoring biometric enrollment, verification events, and account security status.
*   **Face ID Login:** Passwordless authentication using 512-dimensional vector embeddings and anti-spoofing liveness detection.
*   **Voice Identity Login:** Multi-factor biometric voice authentication using SpeechBrain speaker verification models.
*   **Challenge-Response Protection:** Secure "Speak the Code" mechanism to prevent replay attacks.

### 🧪 The Biometric Lab (Playground)
*   **Full Theme Compatibility:** The entire playground is fully responsive to Light and Dark modes with specialized high-contrast assets.
*   **Magic Mirror:** Real-time analysis of Age, Gender, and Emotional State using DeepFace models.
*   **Twin-O-Meter:** 1:1 Verification calculating facial similarity percentages between target photos.
*   **Crowd Scanner:** 1:N Identification for pinpointing target faces within complex group photos using RetinaFace detectors.
*   **Workspace Mapping:** Securely manage isolated "Universes" (Tenant-level facial databases).

### 🎙️ Voice Intelligence Layer (Upgrade)
*   **Interactive AI Orb:** A pulsing, morphing 3D-like visualizer that reacts to user voice input in real-time.
*   **Babel Fish Translator:** Instant AI-powered translation across Spanish, French, Japanese, Luganda, and Chinese.
*   **Brain Dump Summarizer:** Real-time condensation of voice sessions into actionable, condensed notes.
*   **Emotion-Responsive TTS:** Advanced synthesis that adapts its tone based on detected user sentiment.
*   **Global Voice Commands:** Hands-free UI control and navigation using local Web Speech APIs.

### 🧠 The Knowledge Brain (RAG)
*   **Chat with Data:** Upload PDF documents and interact with them using hybrid semantic search.
*   **Dynamic Context Heuristic:** Intelligent `topK` auto-scaling (automatically increases context from 3 to 8 chunks when documents are active).
*   **Asynchronous Processing:** Long-running AI tasks (voice cloning, indexing) are managed via an optimized job pipeline.

---

## 🏗️ Architecture & Tech Stack

### 1. Frontend (The Experience)
*   **Core:** React 18 + Vite + TypeScript
*   **State:** Apollo Client (GraphQL) + Context API
*   **Styling:** Tailwind CSS + Framer Motion (Liquid UI)
*   **Theme Engine:** Sophisticated Light/Dark mode implementation with persistent user preferences.

### 2. Backend Gateway (The Manager)
*   **Runtime:** Node.js + Express
*   **API:** Apollo Server (GraphQL) with comprehensive Audit Logging.
*   **Database ORM:** Prisma
*   **Security:** Stateless JWT Auth + Redis-backed Challenge-Response TTL.

### 3. AI Engine (The Brain)
*   **Runtime:** Python 3.9 + FastAPI
*   **ML Libraries:** DeepFace (Vision), SpeechBrain (Voice), OpenCV, NumPy
*   **Processor:** Optimized for Hugging Face Spaces with hardware acceleration.

### 4. Infrastructure (The Memory)
*   **Database:** Supabase PostgreSQL + `pgvector` for high-performance retrieval.
*   **Storage:** Supabase Storage (S3-compatible) for biometric assets.
*   **LLM Engine:** Google Gemini 1.5 Flash (with implemented Key Rotation & Rate Limiting).

---

## 🛠️ Local Installation

### 1. Clone & Install
```bash
git clone https://github.com/AmosQuety/Super-AI-App.git
cd Super-AI-App/src/apps
```

### 2. Deployment Setup
Please refer to the detailed environment setup guides in `backend` and `web` directories for configuring your `pgvector` database, Redis cache, and Gemini/Cloning API keys.

---

## 🛡️ License
Distributed under the **MIT License**.

---

## 👨‍💻 Author
**Nabasa Amos**
*   [GitHub](https://github.com/AmosQuety)
