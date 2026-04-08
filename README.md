# 💎 Xemora: The Biometric Intelligence Platform

![Project Banner](image.png)


**Xemora** is a production-grade SaaS platform that combines **Computer Vision**, **Biometric Security**, and **Generative AI (RAG)** into a unified interface.

It features a microservices architecture separating the "Manager" (Node.js) from the "Brain" (Python AI), enabling scalable face recognition, liveness detection, and document intelligence.

---

## 🚀 Live Demo
*  **Video Demo:** [https://youtu.be/E5pNRct9X4Q](https://youtu.be/E5pNRct9X4Q)
*   **Frontend:** [https://prism-vision.vercel.app](https://prism-vision.vercel.app)
*   **Backend API:** Available in the hosted app; direct deployment links are intentionally omitted.
*   **AI Engine:** Available in the hosted app; direct deployment links are intentionally omitted.

*If a hosted service is unavailable, use the video demo or screenshots instead of depending on a cold-started endpoint.*

---

## ✨ Key Features

### 🛡️ Biometric Security Center
*   **Face ID Login:** Passwordless authentication using 512-dimensional vector embeddings and anti-spoofing liveness detection.
*   **Voice Identity Login:** Biometric voice authentication using specialized speaker verification models.
*   **Challenge-Response Security:** Secure "Speak the Code" mechanism to prevent replay attacks during logins.
*   **Global Identity Index:** Centralized vector database for secure multi-modal user verification.

### 🎮 Interactive Loading Experience
*   **Mini-Game Lobby:** To bridge asynchronous processing times, users can play integrated mini-games:
    *   **Emoji Catcher:** Fast-paced reaction game.
    *   **Pop the Bubbles:** Relaxing precision game.
    *   **Tap Dodge:** Skill-based movement game.
*   **Persistent High Scores:** Local storage integration to track your best performances while you wait.

### 🧪 The Biometric Lab (Playground)
*   **Magic Mirror:** Real-time analysis of Age, Gender, and Emotional State using DeepFace.
*   **Twin-O-Meter:** Calculates facial similarity percentage between two photos (1:1 Verification).
*   **Crowd Scanner:** 1:N Identification to pinpoint a target face within a group photo using RetinaFace detectors.
*   **Workspace Management:** Multi-tenant architecture allowing users to create isolated "Universes" (e.g., Marvel vs. Family) with separate facial databases.

### 🎙️ Voice Intelligence Layer
*   **Neural Voice Synthesis:** Advanced TTS for high-quality, natural-sounding voice cloning.
*   **Speaker Verification:** Securely verify users' identity based on unique vocal characteristics.
*   **Real-time Spectrum:** Visual monitoring of volume and pitch during recording and verification.
*   **Local-First Commands:** Zero-latency navigation and UI control via the Web Speech API.

### ⚙️ Biometric Lifecycle Management
*   **Profile Control:** Full CRUD operations for Biometric IDs (Face & Voice).
*   **Enrollment Flow:** Streamlined setup for registering biometric profiles with real-time feedback.
*   **Security Audits:** Track and manage which biometric factors are active for your account.

### 🧠 The Knowledge Brain (RAG)
*   **Chat with Data:** Upload PDF documents and chat with them using semantic search.
*   **Hybrid Intelligence:** Smart routing between "Context-Aware" answers and "General Knowledge".
*   **Async Processing:** All long-running AI tasks (Cloning, RAG) are handled via an asynchronous job pipeline for maximum reliability.

---

## 🏗️ Architecture & Tech Stack

The system follows a **Distributed Microservices** pattern:

### 1. Frontend (The Experience)
*   **Framework:** React 18 + Vite + TypeScript
*   **State:** Apollo Client (GraphQL) + Context API
*   **Styling:** Tailwind CSS + Framer Motion (Liquid UI)
*   **Hosting:** Vercel

### 2. Backend Gateway (The Manager)
*   **Runtime:** Node.js + Express
*   **API:** Apollo Server (GraphQL)
*   **Database ORM:** Prisma
*   **Security:** Stateless JWT Auth + Singleton DB Pattern
*   **Hosting:** Render

### 3. AI Engine (The Brain)
*   **Runtime:** Python 3.9 + FastAPI
*   **ML Libraries:** DeepFace (Vision), SpeechBrain (Voice), OpenCV, NumPy
*   **Models:** FaceNet512, VGG-Face, XTTS v2 / Neural TTS
*   **Hosting:** Hugging Face Spaces (Cloud-offloaded for both Dev & Prod)

### 4. Infrastructure (The Memory)
*   **Database:** Supabase PostgreSQL + `pgvector` extension.
*   **Caching:** Redis for job status tracking and challenge-response TTL.
*   **Storage:** Supabase Storage (S3-compatible) for biometric assets.
*   **LLM Provider:** Google Gemini 1.5 Flash (with Key Rotation & Rate Limiting).

---

## 🛠️ Local Installation

### Prerequisites
*   Node.js v18+
*   Python 3.9+
*   PostgreSQL (or Supabase account)

### 1. Clone the Repo
```bash
git clone https://github.com/AmosQuety/Super-AI-App.git
cd Super-AI-App
```

### 2. Backend Setup (Node.js)
```bash
cd src/apps/backend
npm install

# Setup Environment
cp .env.example .env
# (Fill in DATABASE_URL, JWT_SECRET, SUPABASE_KEYS, GEMINI_KEYS)

# Run Database Migrations
npx prisma db push
npx prisma generate

# Start Server
npm run dev
```

### 3. Frontend Setup (React)
```bash
cd src/apps/web
npm install

# Setup Environment
echo "VITE_GRAPHQL_URL=http://localhost:4001/graphql" > .env

# Start Client
npm run dev
```

### 4. AI Engine Configuration
By default, the system points to the local Python API. To use the cloud-offloaded brain (Hugging Face), update your backend `.env`:
```bash
# In src/apps/backend/.env
PYTHON_FACE_SERVICE_URL=https://your-huggingface-space.hf.space
```

For public sharing, prefer screenshots, a short screen recording, or a dedicated status page over raw deployment URLs.

If running the Python Engine locally for development:
```bash
cd FaceSearchProject
python -m venv myenv
source myenv/bin/activate
pip install -r requirements.txt
uvicorn api:app --reload --port 8000
```

---

## 🧩 System Design Highlights

### 🔄 Smart Key Rotation
To bypass API rate limits on free tiers, the system implements a **Round-Robin Key Rotator** for Gemini and Hugging Face APIs, effectively tripling the available quota.

### ⛓️ Asynchronous Job Pipeline
To prevent timeouts during complex AI operations (like voice training or document indexing), the system uses an **Async Queue** pattern.
1. The Node.js gateway Enqueues a job on the AI Engine.
2. The AI Engine returns a `jobId` immediately.
3. The Frontend displays a **Mini-Game** while polling for the result or receiving a **Webhook** push.

### ⚡ Optimistic UI Updates
The frontend uses Apollo Client cache updates (`refetchQueries` and `optimisticResponse`) to ensure the UI feels instant, even when waiting for server logic.

### 🐳 Cloud-Native AI
The Python brain is optimized for Hugging Face Spaces, leveraging high-performance hardware and pre-cached model weights to ensure low-latency inference across the platform.

---

## 🛡️ License

This project is open-source and available under the **MIT License**.

---

## 👨‍💻 Author

**Nabasa Amos**
*   Full Stack Software Engineer & AI Enthusiast
*   [GitHub](https://github.com/AmosQuety)

