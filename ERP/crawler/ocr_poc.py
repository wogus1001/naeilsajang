import sys
import os
from pywinauto import Application
import pytesseract
from PIL import Image

# ---------------------------------------------------------
# [CONFIG] Tesseract Path - Update if installed elsewhere
# Common default paths for Windows
possible_tesseract_paths = [
    r"C:\Program Files\Tesseract-OCR\tesseract.exe",
    r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
    r"C:\Users\awmve\AppData\Local\Programs\Tesseract-OCR\tesseract.exe"
]

tesseract_cmd = None
for p in possible_tesseract_paths:
    if os.path.exists(p):
        tesseract_cmd = p
        break

if tesseract_cmd:
    pytesseract.pytesseract.tesseract_cmd = tesseract_cmd
    print(f"[INFO] Found Tesseract at: {tesseract_cmd}")
else:
    print("[WARNING] Tesseract executable not found in common paths.")
    print("Please ensure Tesseract-OCR is installed and variable is set if needed.")
# ---------------------------------------------------------

def run_ocr_poc():
    target_title = "점포물건 카드"
    print(f"Connecting to window: '{target_title}'...")

    try:
        app = Application(backend="uia").connect(title=target_title, timeout=10)
        dlg = app.window(title=target_title)
        
        # Bring window to front
        try:
            if dlg.is_minimized():
                dlg.restore()
            dlg.set_focus()
            import time
            time.sleep(1.0) # Wait for animation
        except Exception as e:
            print(f"[WARNING] Could not focus window: {e}")
            
        # 1. Capture absolute window image
        print("Capturing window image...")
        img = dlg.capture_as_image()
        
        # Save for debugging
        save_path = os.path.join(os.getcwd(), "crawler", "debug_capture.png")
        img.save(save_path)
        print(f"[SUCCESS] Saved screenshot to: {save_path}")
        
        # 2. Try raw OCR on the whole image
        print("Running Tesseract OCR on the image...")
        try:
            text = pytesseract.image_to_string(img, lang='kor+eng')
            print("\n" + "="*30)
            print(" OCR RESULT (Preview)")
            print("="*30)
            print(text[:500] + "\n...")
            print("="*30)
            
            if "test" in text or "보증금" in text:
                print("\n[SUCCESS] OCR read significant keywords!")
            else:
                print("\n[INFO] Keywords not clearly found. Might need better image processing or language data.")

        except pytesseract.TesseractNotFoundError:
            print("\n[ERROR] Tesseract is not installed or not in PATH.")
            print("Please download and install it from: https://github.com/UB-Mannheim/tesseract/wiki")
        except Exception as e:
            print(f"\n[ERROR] OCR failed: {e}")

    except Exception as e:
        print(f"[ERROR] Logic failed: {e}")

if __name__ == "__main__":
    run_ocr_poc()
