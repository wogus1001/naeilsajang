import time
import win32gui
import win32con
import win32clipboard
from pywinauto import Application

def get_text_from_hwnd(hwnd):
    # Try getting text length
    length = win32gui.SendMessage(hwnd, win32con.WM_GETTEXTLENGTH)
    if length > 0:
        # Create buffer (multiply by 2 for safety with unicode)
        buffer = win32gui.PyMakeBuffer((length + 1) * 2)
        # Send WM_GETTEXT
        res = win32gui.SendMessage(hwnd, win32con.WM_GETTEXT, length + 1, buffer)
        
        # Extract meaningful bytes
        # Windows might fill it as Ansi (1 byte/char) or Unicode (2 bytes/char)
        # For VB6 ThunderRT6TextBox, it's often ANSI (CP949)
        raw_data = buffer[:length*2].tobytes()
        
        # Try CP949 (Korean ANSI) first - typical for VB6
        try:
            # Trim null bytes for ANSI
            ansi_data = buffer[:length].tobytes()
            decoded = ansi_data.decode('cp949')
            return decoded, ansi_data
        except:
            pass

        # Try UTF-16LE
        try:
            decoded = raw_data.decode('utf-16le').replace('\x00', '')
            return decoded, raw_data
        except:
            return "<Decoding Failed>", raw_data
            
    return "", b""

def test_clipboard(hwnd):
    print("\n[Test 2] Clipboard Injection (Ctrl+C)...")
    try:
        # Activate window
        win32gui.SetForegroundWindow(hwnd)
        time.sleep(0.5)
        
        # Send Ctrl+A, Ctrl+C
        import pyautogui
        pyautogui.hotkey('ctrl', 'a')
        time.sleep(0.1)
        pyautogui.hotkey('ctrl', 'c')
        time.sleep(0.5)
        
        win32clipboard.OpenClipboard()
        try:
            data = win32clipboard.GetClipboardData()
            print(f"   Clipboard content: {data[:50]}...")
        except:
            print("   Clipboard is empty or not text.")
        finally:
            win32clipboard.CloseClipboard()
            
    except Exception as e:
        print(f"   Clipboard test failed: {e}")

def run_force_test():
    target_title = "점포물건 카드"
    hwnd = win32gui.FindWindow(None, target_title)
    
    if not hwnd:
        print(f"Window '{target_title}' not found!")
        return

    print(f"Found Window Handle: {hwnd}")
    
    # 1. Enumerate Child Windows and Try WM_GETTEXT
    print("\n[Test 1] Win32 WM_GETTEXT Extraction...")
    
    def callback(child_hwnd, _):
        class_name = win32gui.GetClassName(child_hwnd)
        rect = win32gui.GetWindowRect(child_hwnd)
        # Convert to client coordinates relative to parent if needed, but screen coords are fine for comparison
        # WindowRect is (left, top, right, bottom)
        x, y = rect[0], rect[1]
        w, h = rect[2] - rect[0], rect[3] - rect[1]
        
        text, raw_bytes = get_text_from_hwnd(child_hwnd)
        if text.strip() or raw_bytes:
            print(f"   Handle: {child_hwnd}, Class: {class_name}, Rect: ({x}, {y}, {w}, {h})")
            print(f"      -> Text: '{text}'")
            print(f"      -> Raw: {raw_bytes.hex(' ')}")
        return True

    win32gui.EnumChildWindows(hwnd, callback, None)
    
    # 2. Try Clipboard
    # test_clipboard(hwnd) # Uncomment to test (might interfere if user is working)

if __name__ == "__main__":
    run_force_test()
