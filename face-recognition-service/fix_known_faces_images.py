from PIL import Image
import os

KNOWN_FACES_DIR = "known_faces"

for filename in os.listdir(KNOWN_FACES_DIR):
    if filename.lower().endswith(('.jpg', '.jpeg', '.png', '.bmp', '.gif', '.tiff', '.webp')):
        img_path = os.path.join(KNOWN_FACES_DIR, filename)
        try:
            img = Image.open(img_path)
            img = img.convert('RGB')
            # Always save as JPEG, overwrite original
            img.save(img_path, format='JPEG')
            print(f"Re-saved {filename} as JPEG.")
        except Exception as e:
            print(f"Error processing {filename}: {e}")
