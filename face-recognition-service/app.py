from flask import Flask, request, jsonify
import os
import cv2
import numpy as np
import insightface
import insightface.model_zoo as model_zoo
from pathlib import Path
import pickle

# ----------------------------------------------------------------------------
# Configuration
# ----------------------------------------------------------------------------
flask_app = Flask(__name__)

# Directories
BASE_DIR = Path(__file__).resolve().parent
KNOWN_DB_PATH = BASE_DIR / "known_faces.pkl"

# Initialize InsightFace 0.2.1 style
detection_model = None
recognition_model = None

def initialize_face_models():
    global detection_model, recognition_model
    
    print(f"Initializing InsightFace v{insightface.__version__} models...")
    
    # For version 0.2.1, use individual models
    try:
        print("Loading detection model...")
        detection_model = model_zoo.get_model('retinaface_mnet025_v1')
        detection_model.prepare(ctx_id=-1)  # CPU
        print("✅ Detection model loaded!")
        
        print("Loading recognition model...")
        recognition_model = model_zoo.get_model('arcface_r100_v1')
        recognition_model.prepare(ctx_id=-1)  # CPU  
        print("✅ Recognition model loaded!")
        
        return True
        
    except Exception as e:
        print(f"❌ Model loading failed: {e}")
        
        # Fallback: try other models
        try:
            print("Trying alternative models...")
            detection_model = model_zoo.get_model('retinaface_r50_v1')
            detection_model.prepare(ctx_id=-1)
            
            recognition_model = model_zoo.get_model('arcface_r50_v1')
            recognition_model.prepare(ctx_id=-1)
            
            print("✅ Alternative models loaded!")
            return True
            
        except Exception as e2:
            print(f"❌ Alternative models failed: {e2}")
            return False

# Initialize models
if not initialize_face_models():
    print("Failed to initialize face recognition models.")
    print("Try upgrading: pip install insightface==0.7.3")
    exit(1)

# ----------------------------------------------------------------------------
# Helpers  
# ----------------------------------------------------------------------------
def load_known_faces():
    """Load stored embeddings + labels from disk."""
    if KNOWN_DB_PATH.exists():
        with open(KNOWN_DB_PATH, "rb") as f:
            return pickle.load(f)
    return {"embeddings": np.empty((0, 512)), "names": []}

def save_known_faces(db):
    """Save embeddings + labels to disk."""
    with open(KNOWN_DB_PATH, "wb") as f:
        pickle.dump(db, f)

def detect_faces(image):
    """Detect faces in image using detection model"""
    try:
        # For older InsightFace, detection might work differently
        faces, landmarks = detection_model.detect(image, threshold=0.5)
        return faces, landmarks
    except Exception as e:
        print(f"Detection error: {e}")
        return None, None

def compute_embedding(image):
    """Compute facial embedding for a given face image."""
    try:
        # Detect faces first
        faces, landmarks = detect_faces(image)
        
        if faces is None or len(faces) == 0:
            return None
            
        # Get the largest face
        face_idx = 0
        if len(faces) > 1:
            areas = [(face[2] - face[0]) * (face[3] - face[1]) for face in faces]
            face_idx = np.argmax(areas)
        
        face_box = faces[face_idx]
        face_landmark = landmarks[face_idx]
        
        # Compute embedding
        embedding = recognition_model.get_embedding(image, face_landmark)
        
        # Normalize
        embedding = embedding / np.linalg.norm(embedding)
        
        return embedding
        
    except Exception as e:
        print(f"Error computing embedding: {e}")
        return None

def recognize_face(embedding, db, threshold=0.35):
    """Match embedding against DB using cosine similarity."""
    if len(db["embeddings"]) == 0:
        return None, None
    
    sims = np.dot(db["embeddings"], embedding)
    best_idx = np.argmax(sims)
    best_score = sims[best_idx]
    
    if best_score >= threshold:
        return db["names"][best_idx], float(best_score)
    return None, float(best_score)

# ----------------------------------------------------------------------------
# API Routes
# ----------------------------------------------------------------------------
@flask_app.route("/register", methods=["POST"])
def register_face():
    """Register a new known person."""
    try:
        name = request.form.get("name")
        file = request.files.get("image")
        
        if not name or not file:
            return jsonify({"error": "Missing name or image"}), 400

        # Read image
        file_bytes = np.frombuffer(file.read(), np.uint8)
        image = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
        
        if image is None:
            return jsonify({"error": "Invalid image format"}), 400

        emb = compute_embedding(image)
        if emb is None:
            return jsonify({"error": "No face detected"}), 400

        db = load_known_faces()
        if len(db["embeddings"]) == 0:
            db["embeddings"] = emb.reshape(1, -1)
        else:
            db["embeddings"] = np.vstack([db["embeddings"], emb])
        db["names"].append(name)
        save_known_faces(db)

        return jsonify({"message": f"Registered {name} successfully"}), 200
    
    except Exception as e:
        return jsonify({"error": f"Registration failed: {str(e)}"}), 500

@flask_app.route("/recognize", methods=["POST"])
def recognize():
    """Recognize a face from an uploaded image."""
    try:
        file = request.files.get("image")
        if not file:
            return jsonify({"error": "Missing image"}), 400

        file_bytes = np.frombuffer(file.read(), np.uint8)
        image = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
        
        if image is None:
            return jsonify({"error": "Invalid image format"}), 400

        emb = compute_embedding(image)
        if emb is None:
            return jsonify({"error": "No face detected"}), 400

        db = load_known_faces()
        name, score = recognize_face(emb, db)
        
        if name:
            return jsonify({"name": name, "score": score}), 200
        else:
            return jsonify({"message": "Unknown person", "score": score}), 200
    
    except Exception as e:
        return jsonify({"error": f"Recognition failed: {str(e)}"}), 500

@flask_app.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy", 
        "message": "Face recognition service is running",
        "insightface_version": insightface.__version__
    }), 200

@flask_app.route("/list", methods=["GET"])
def list_known_faces():
    """List all registered faces"""
    try:
        db = load_known_faces()
        return jsonify({
            "known_faces": db["names"],
            "total_count": len(db["names"])
        }), 200
    except Exception as e:
        return jsonify({"error": f"Failed to list faces: {str(e)}"}), 500

# ----------------------------------------------------------------------------
# Run App
# ----------------------------------------------------------------------------
if __name__ == "__main__":
    print(f"Face recognition service starting...")
    print(f"InsightFace version: {insightface.__version__}")
    print(f"Known faces database: {KNOWN_DB_PATH}")
    flask_app.run(host="127.0.0.1", port=5000, debug=True, threaded=True)