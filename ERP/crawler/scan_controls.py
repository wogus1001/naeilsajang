import win32gui
import win32con
import math

def get_text_from_hwnd(hwnd):
    length = win32gui.SendMessage(hwnd, win32con.WM_GETTEXTLENGTH)
    if length > 0:
        # Allocate buffer for unicode (length * 2 bytes)
        buffer = win32gui.PyMakeBuffer((length + 1) * 2)
        win32gui.SendMessage(hwnd, win32con.WM_GETTEXT, length + 1, buffer)
        
        raw_bytes = buffer[:length*2].tobytes()
        
        # Priority 1: UTF-16LE (Standard for Windows Unicode controls)
        try:
            return raw_bytes.decode('utf-16le')
        except:
            pass
            
        # Priority 2: CP949 (Korean ANSI fallback)
        try:
            return buffer[:length].tobytes().decode('cp949')
        except:
            return ""
    return ""

def scan_controls():
    target_title = "점포물건 카드"
    main_hwnd = win32gui.FindWindow(None, target_title)
    
    if not main_hwnd:
        print(f"Window '{target_title}' not found!")
        return

    # Get Main Window Position
    mr = win32gui.GetWindowRect(main_hwnd)
    mx, my = mr[0], mr[1]
    
    print(f"Main Window: {main_hwnd} at ({mx}, {my})")
    print("-" * 80)
    print(f"{'Class':<20} | {'Relative Rect (x,y,w,h)':<25} | {'Text'}")
    print("-" * 80)

    controls = []

    def callback(child_hwnd, _):
        class_name = win32gui.GetClassName(child_hwnd)
        rect = win32gui.GetWindowRect(child_hwnd)
        
        # Calculate Relative Coordinates
        rx = rect[0] - mx
        ry = rect[1] - my
        w = rect[2] - rect[0]
        h = rect[3] - rect[1]
        
        text = get_text_from_hwnd(child_hwnd)
        
        # Show ALL controls to find the Grids (ListView etc)
        # Focus on the right side of the screen where the lists are (approx x > 800)
        # But for completeness, let's dump everything but maybe highlight the right side
        
        controls.append({
            "hwnd": child_hwnd,
            "class": class_name,
            "rect": (rx, ry, w, h),
            "text": text,
            "sort_key": (ry // 10, rx) 
        })
        return True

    win32gui.EnumChildWindows(main_hwnd, callback, None)
    
    # Sort by position (Top-to-Bottom, Left-to-Right)
    controls.sort(key=lambda c: c["sort_key"])
    
    for c in controls:
        r = c['rect']
        rect_str = f"({r[0]}, {r[1]}, {r[2]}, {r[3]})"
        print(f"{c['class']:<20} | {rect_str:<25} | {c['text']}")

if __name__ == "__main__":
    scan_controls()
