import os
import pytesseract
from PIL import Image

# [CONFIG] Tesseract Path
possible_tesseract_paths = [
    r"C:\Program Files\Tesseract-OCR\tesseract.exe",
    r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
    r"C:\Users\awmve\AppData\Local\Programs\Tesseract-OCR\tesseract.exe"
]
for p in possible_tesseract_paths:
    if os.path.exists(p):
        pytesseract.pytesseract.tesseract_cmd = p
        break

def test_params():
    # Target file: The debug crop saved by run_crawl.py
    target_file = os.path.join(os.getcwd(), "crawler", "crops", "물건명.png")
    
    if not os.path.exists(target_file):
        print(f"[ERROR] File not found: {target_file}")
        print("Please run 'run_crawl.py' at least once to generate the crop.")
        return

    print(f"Testing OCR on: {target_file}")
    img = Image.open(target_file)
    
    # Test 1: Original Image (No processing)
    print("\n--- [Method 1] Original Image ---")
    try:
        res = pytesseract.image_to_string(img, lang='kor+eng', config='--psm 6')
        print(f"Result: '{res.strip()}'")
    except Exception as e:
        print(f"Error: {e}")

    # Test 2: Threshold Variations
    thresholds = [100, 128, 150, 180, 200]
    gray = img.convert('L')
    
    for th in thresholds:
        print(f"\n--- [Method 2] Threshold {th} ---")
        bw = gray.point(lambda x: 0 if x < th else 255, '1')
        # bw.show() # Optional: visualize
        res = pytesseract.image_to_string(bw, lang='kor+eng', config='--psm 6')
        print(f"Result: '{res.strip()}'")

    # Test 3: PSM Modes (Page Segmentation Modes)
    # 6 = Assume a single uniform block of text
    # 7 = Treat the image as a single text line
    # 8 = Treat the image as a single word
    psm_modes = [6, 7, 8]
    print("\n--- [Method 3] PSM Modes (with Th=150) ---")
    bw = gray.point(lambda x: 0 if x < 150 else 255, '1')
    
    for mode in psm_modes:
        print(f"Testing PSM {mode}...")
        res = pytesseract.image_to_string(bw, lang='kor+eng', config=f'--psm {mode}')
        print(f"Result: '{res.strip()}'")

if __name__ == "__main__":
    test_params()
