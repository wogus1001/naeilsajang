# ==========================================
# HYBRID CRAWLER: Win32 Hooking (Text) + Image Analysis (Checkboxes)
# ==========================================
import sys
import os
import time
import json
import re
from pywinauto import Application
from PIL import Image
import win32gui
import win32con

# Force UTF-8 Output
sys.stdout.reconfigure(encoding='utf-8')

# Robust Import for Config
try:
    from crawler.config import REGIONS, NEXT_BUTTON, CHECKBOXES
except ImportError:
    try:
        from config import REGIONS, NEXT_BUTTON, CHECKBOXES
    except ImportError:
        print("[ERROR] Could not find config.py.")
        sys.exit(1)

# Helper: Get Text from Handle (UTF-16LE priority for Korean)
def get_text_from_hwnd(hwnd):
    length = win32gui.SendMessage(hwnd, win32con.WM_GETTEXTLENGTH)
    if length > 0:
        buffer = win32gui.PyMakeBuffer((length + 1) * 2)
        win32gui.SendMessage(hwnd, win32con.WM_GETTEXT, length + 1, buffer)
        raw_bytes = buffer[:length*2].tobytes()
        try:
            return raw_bytes.decode('utf-16le').replace('\x00', '')
        except:
            return ""
    return ""

# Helper: Checkbox Color Detection
def is_region_active(image, region):
    x, y, w, h = region
    cropped = image.crop((x, y, x+w, y+h))
    pixels = list(cropped.getdata())
    colorful_count = 0
    total_count = len(pixels)
    for r, g, b in pixels:
        diff = max(r, g, b) - min(r, g, b)
        if diff > 20: 
            colorful_count += 1
    return (colorful_count / total_count) > 0.3

# Helper: Match Config Region to Found Controls
def find_best_matching_text(target_rect, controls):
    # exact overlay is hard, so we check if the Center of the control is inside the Target Rect
    tx, ty, tw, th = target_rect
    target_center_x = tx + tw/2
    target_center_y = ty + th/2
    
    best_text = ""
    min_dist = 99999
    
    for c in controls:
        # Check if control center is within target rect
        cx, cy, cw, ch = c['rect']
        center_x = cx + cw/2
        center_y = cy + ch/2
        
        # Simple inclusion check with tolerance
        if (tx - 10 <= center_x <= tx + tw + 10) and (ty - 10 <= center_y <= ty + th + 10):
            # Found a candidate! Pick the one closest to center
            dist = abs(target_center_x - center_x) + abs(target_center_y - center_y)
            if dist < min_dist:
                min_dist = dist
                best_text = c['text']
                
    return best_text

# Helper: Normalize Spaces
def normalize_spaces(text):
    return " ".join(text.split())

# Helper: Extract Right-side Grids via UIA
def extract_grids_via_uia(main_hwnd):
    results = {
        "price_history": [],
        "work_history": []
    }
    extracted_types = set()

    try:
        app = Application(backend="uia").connect(handle=main_hwnd)
        win = app.window(handle=main_hwnd)
        
        tables = win.descendants(control_type="Table")
        for table in tables:
            rows = table.children(control_type="Custom")
            if not rows: continue
            
            # Check headers in first row/header
            first_row = rows[0]
            cells = first_row.children(control_type="DataItem")
            headers = [c.window_text() for c in cells]
            
            target_key = None
            if "변동후금액" in headers:
                target_key = "price_history"
            elif "관련고객" in headers:
                target_key = "work_history"
            
            # Prevent processing if we already found this table type
            if not target_key or target_key in extracted_types:
                continue
                
            extracted_types.add(target_key)
            target_list = results[target_key]
            
            for row in rows:
                cells = row.children(control_type="DataItem")
                row_data = {}
                has_data = False
                
                for i, cell in enumerate(cells):
                    col_name = headers[i] if i < len(headers) else f"Col_{i}"
                    if not col_name.strip(): col_name = f"Col_{i}"
                    
                    val = ""
                    try:
                        val = cell.iface_value.CurrentValue
                    except:
                        try:
                            val = cell.iface_legacy_iaccessible.CurrentValue
                        except:
                            pass
                    
                    if not val:
                        val = cell.window_text()
                        
                    if val is None: val = ""
                    
                    row_data[col_name] = str(val).strip()
                    if row_data[col_name]: has_data = True
                
                if has_data:
                    # Filter: Row must have a valid '날짜' (Date)
                    date_val = row_data.get("날짜", "")
                    if not date_val.strip() or date_val == "날짜": 
                        continue
                        
                    target_list.append(row_data)

    except Exception:
        pass
    return results

def crawl_page(main_hwnd, window_image):
    # 1. Win32 Text Extraction
    extracted_text_blocks = []
    
    def enum_child_callback(child_hwnd, _):
        try:
            rect = win32gui.GetWindowRect(child_hwnd)
            parent_rect = win32gui.GetWindowRect(main_hwnd)
            rel_x = rect[0] - parent_rect[0]
            rel_y = rect[1] - parent_rect[1]
            w = rect[2] - rect[0]
            h = rect[3] - rect[1]
            if w < 5 or h < 5: return True
            
            text = get_text_from_hwnd(child_hwnd)
            if text:
                 extracted_text_blocks.append({"text": text, "x": rel_x, "y": rel_y, "w": w, "h": h})
        except: pass
        return True

    win32gui.EnumChildWindows(main_hwnd, enum_child_callback, None)

    page_data = {}
    
    # Map Text Fields
    for field_name, region_rect in REGIONS.items():
        rx, ry, rw, rh = region_rect
        target_center_x = rx + rw / 2
        target_center_y = ry + rh / 2
        
        best_match = None
        min_dist = float('inf')
        
        for block in extracted_text_blocks:
            bx = block['x'] + block['w'] / 2
            by = block['y'] + block['h'] / 2
            # Distance from center of region to center of control
            dist = ((bx - target_center_x)**2 + (by - target_center_y)**2) ** 0.5
            if dist < min_dist:
                min_dist = dist
                best_match = block
        
        # Tolerance: 150px
        if best_match and min_dist < 150: 
            page_data[field_name] = normalize_spaces(best_match['text'])
        else:
            page_data[field_name] = ""

    # Map Checkboxes
    if window_image:
        active_opts = []
        for field, pos in CHECKBOXES.items():
            if is_region_active(window_image, pos):
                clean_label = field.split("_")[-1]
                active_opts.append(clean_label)
        page_data["운영형태"] = ", ".join(active_opts)

    # Map Grids
    grid_data = extract_grids_via_uia(main_hwnd)
    page_data.update(grid_data)
    
    return page_data

def run_crawl():
    target_title = "점포물건 카드"
    print(f"Connecting to window: '{target_title}'...")
    
    try:
        app = Application(backend="uia").connect(title=target_title, timeout=10)
        dlg = app.window(title=target_title)
        
        if dlg.is_minimized():
            dlg.restore()
        dlg.set_focus()
        time.sleep(1.0)

        main_hwnd = win32gui.FindWindow(None, target_title)
        
        # Setup Save Path
        if os.path.basename(os.getcwd()) == "crawler":
            base_dir = os.path.dirname(os.getcwd())
        else:
            base_dir = os.getcwd()
        save_path = os.path.join(base_dir, "src", "data", "crawled_data.json")
        os.makedirs(os.path.dirname(save_path), exist_ok=True)
        
        crawled_list = []
        if os.path.exists(save_path):
            try:
                with open(save_path, "r", encoding="utf-8") as f:
                    crawled_list = json.load(f)
            except: pass

        # Looping Variables
        page_i = 0
        consecutive_duplicates = 0
        last_data_hash = None
        
        print(f"\n[START] Starting HYBRID crawl (Win32 + Image + UIA)...")
        
        while True:
            page_i += 1
            print(f"\n--- Page {page_i} ---")
            
            # Capture image for checkbox detection
            full_img = dlg.capture_as_image()

            # Crawl the current page using the new function
            data = crawl_page(main_hwnd, full_img)
            
            # Post-processing and printing for main fields
            for label, rect in REGIONS.items():
                val = data.get(label, "")
                # Cleaning
                if label in ["보증금", "월임대료", "권리금", "합계금", "매출", "관리비"]:
                    val = val.replace(",", "").strip()
                    if not val: val = "0"
                else:
                    val = val.strip()
                data[label] = val # Update data with cleaned value
                print(f"   {label}: {val}")

            print(f"   운영형태: {data.get('운영형태', '')}")
            
            # Print List Details nicely
            ph = data.get('price_history', [])
            if ph:
                print(f"   가격변동내역: {len(ph)}건")
                for i, row in enumerate(ph):
                    print(f"      [{i+1}] {row.get('날짜', '')} | {row.get('변동후금액', '')} | {row.get('내역', '')} | {row.get('작업자', '')}")
            
            wh = data.get('work_history', [])
            if wh:
                print(f"   업무내역: {len(wh)}건")
                for i, row in enumerate(wh):
                    print(f"      [{i+1}] {row.get('날짜', '')} | {row.get('내역', '')} | {row.get('관련고객', '')}")

            # 5. Duplicate Check & Save
            current_hash = f"{data.get('물건명')}_{data.get('합계금')}"
            if current_hash == last_data_hash:
                consecutive_duplicates += 1
                print(f"   [Duplicate] ({consecutive_duplicates}/3)")
                if consecutive_duplicates >= 3:
                    print("\n[END] Stopping crawl.")
                    break
            else:
                consecutive_duplicates = 0
                last_data_hash = current_hash
                data['timestamp'] = time.strftime("%Y-%m-%d %H:%M:%S")
                crawled_list.append(data)
                
                with open(save_path, "w", encoding="utf-8") as f:
                    json.dump(crawled_list, f, ensure_ascii=False, indent=2)

            # 6. Click Next
            print("   Clicking Next > ...")
            try:
                dlg.click_input(coords=NEXT_BUTTON)
            except: pass
            time.sleep(1.0)

    except Exception as e:
        print(f"[ERROR] {e}")

if __name__ == "__main__":
    run_crawl()
