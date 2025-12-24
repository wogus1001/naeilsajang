import sys
import os
import time
from pywinauto import Application
from PIL import Image, ImageDraw, ImageFont

# Robust Import
try:
    from crawler.config import REGIONS
except ImportError:
    try:
        from config import REGIONS
    except ImportError:
        print("[ERROR] Could not find config.py")
        sys.exit(1)

def draw_debug_regions():
    target_title = "점포물건 카드"
    print(f"Connecting to window: '{target_title}'...")

    try:
        app = Application(backend="uia").connect(title=target_title, timeout=10)
        
        # ... (Focus logic preserved) ...
        dlg = app.window(title=target_title)
        if dlg.is_minimized(): dlg.restore()
        dlg.set_focus()
        time.sleep(1.0)
        
        # Capture absolute
        print("Capturing window...")
        original_img = dlg.capture_as_image()
        
        draw = ImageDraw.Draw(original_img)
        
        # Draw regions from CONFIG
        for label, (x, y, w, h) in REGIONS.items():
            draw.rectangle([x, y, x+w, y+h], outline="red", width=3)
            draw.text((x, y-15), label, fill="red")
            
        # Draw NEXT BUTTON
        try:
            from crawler.config import NEXT_BUTTON
            nx, ny = NEXT_BUTTON
            # Draw a small target circle/box for the button
            draw.rectangle([nx-10, ny-10, nx+10, ny+10], outline="blue", width=3)
            draw.text((nx-20, ny-25), "NEXT BUTTON", fill="blue")
        except ImportError:
            pass

        # Draw CHECKBOXES (Green)
        try:
            from crawler.config import CHECKBOXES
            for label, (x, y, w, h) in CHECKBOXES.items():
                draw.rectangle([x, y, x+w, y+h], outline="green", width=3)
                draw.text((x, y-15), label, fill="green")
        except ImportError:
            pass

        save_path = os.path.join(os.getcwd(), "crawler", "debug_regions.png")
        original_img.save(save_path)
        print(f"[SUCCESS] Saved debug image to: {save_path}")
        print("Please check this image and tell me which boxes are wrong.")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    draw_debug_regions()
