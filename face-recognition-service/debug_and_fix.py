#!/usr/bin/env python3
"""
Debug and fix InsightFace 0.2.1 issues
"""

import os
import sys
from pathlib import Path

print("InsightFace 0.2.1 Debug and Fix")
print("=" * 40)

# Check versions
import insightface
import onnxruntime
print(f"InsightFace version: {insightface.__version__}")
print(f"ONNX Runtime version: {onnxruntime.__version__}")

# Check models directory
models_dir = Path.home() / ".insightface"
print(f"\nModels directory: {models_dir}")
print(f"Directory exists: {models_dir.exists()}")

if models_dir.exists():
    print("\nContents of .insightface:")
    for item in models_dir.rglob("*"):
        if item.is_file():
            print(f"  FILE: {item} ({item.stat().st_size} bytes)")
        else:
            print(f"  DIR:  {item}")
else:
    print("Creating models directory...")
    models_dir.mkdir(parents=True, exist_ok=True)

# Try the old way for version 0.2.1
print(f"\n🔄 Testing InsightFace 0.2.1 initialization...")

try:
    from insightface.app import FaceAnalysis
    from insightface.model_zoo import get_model
    
    print("Available methods in insightface.model_zoo:")
    import insightface.model_zoo as model_zoo
    print(dir(model_zoo))
    
except Exception as e:
    print(f"Error importing: {e}")

# For version 0.2.1, try different approach
try:
    print("\n🔄 Trying old-style initialization...")
    
    # Method for version 0.2.1
    import insightface.model_zoo as model_zoo
    
    # Try to get individual models
    models_to_try = ['retinaface_r50_v1', 'retinaface_mnet025_v1', 'arcface_r100_v1']
    
    for model_name in models_to_try:
        try:
            print(f"Trying to load {model_name}...")
            model = model_zoo.get_model(model_name)
            model.prepare(ctx_id=-1)
            print(f"✅ {model_name} loaded successfully!")
        except Exception as e:
            print(f"❌ {model_name} failed: {e}")
    
except Exception as e:
    print(f"Old-style initialization failed: {e}")

# Try direct download approach for 0.2.1
print(f"\n🔄 Trying direct model download for v0.2.1...")

try:
    # For version 0.2.1, we need to use the old API
    import insightface.model_zoo as model_zoo
    
    # Create a minimal working setup
    detection_model = model_zoo.get_model('retinaface_mnet025_v1')
    detection_model.prepare(ctx_id=-1)
    
    recognition_model = model_zoo.get_model('arcface_r100_v1') 
    recognition_model.prepare(ctx_id=-1)
    
    print("✅ Individual models loaded successfully!")
    print("You can use these models directly in your app")
    
except Exception as e:
    print(f"❌ Direct model loading failed: {e}")
    print("Let's try to upgrade InsightFace...")

print(f"\n📋 RECOMMENDATIONS:")
print("=" * 30)
print("Your InsightFace version 0.2.1 is quite old.")
print("Here are your options:")
print()
print("1. UPGRADE (Recommended):")
print("   pip uninstall insightface")
print("   pip install insightface==0.7.3")
print()
print("2. MANUAL FIX for v0.2.1:")
print("   Use individual model components")
print()
print("3. ALTERNATIVE LIBRARY:")
print("   pip install face_recognition")
print()

# Check what files should exist
expected_files = [
    "detection_Resnet50_Final.pth",
    "mobilenet0.25_Final.pth", 
    "Res50_Final.pth"
]

print("Expected model files for v0.2.1:")
for file in expected_files:
    print(f"  - {file}")