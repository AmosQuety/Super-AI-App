import insightface
from insightface.app import FaceAnalysis
import os

print("Downloading InsightFace buffalo_l model...")

try:
    # This will trigger the model download
    face_app = FaceAnalysis(name='buffalo_l')
    face_app.prepare(ctx_id=-1, det_size=(640, 640))
    print("✅ Model downloaded and initialized successfully!")
    
    # Test with a dummy image to make sure everything works
    import numpy as np
    dummy_image = np.zeros((480, 640, 3), dtype=np.uint8)
    faces = face_app.get(dummy_image)
    print(f"✅ Model test complete. Found {len(faces)} faces in dummy image.")
    
except Exception as e:
    print(f"❌ Error downloading model: {e}")
    print("Try installing onnxruntime: pip install onnxruntime")