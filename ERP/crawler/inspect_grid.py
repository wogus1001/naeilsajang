from pywinauto import Application
import win32gui
import win32clipboard
import time
import sys

# Force UTF-8
sys.stdout.reconfigure(encoding='utf-8')

def get_clipboard_text():
    try:
        win32clipboard.OpenClipboard()
        data = win32clipboard.GetClipboardData()
        win32clipboard.CloseClipboard()
        return data
    except:
        return None

def test_grid_access():
    target_title = "점포물건 카드"
    print(f"Connecting to '{target_title}'...")
    
    try:
        app = Application(backend="uia").connect(title=target_title, timeout=10)
        dlg = app.window(title=target_title)
        dlg.set_focus()
        time.sleep(1)
        
        # Coordinates for "Price Change History" Grid (from scan_controls.py)
        # VSFlexGrid8L | (758, 116, 535, 164)
        # We need to click inside it to focus.
        # Let's verify exact handle from coords using scan logic again or just click relative.
        
        # Scan to find the handle for the top grid
        grid_handle = 0
        def callback(hwnd, _):
            nonlocal grid_handle
            cls = win32gui.GetClassName(hwnd)
            if "VSFlexGrid8L" in cls:
                r = win32gui.GetWindowRect(hwnd)
                # Check height to distinguish top (164h) vs bottom (420h)
                h = r[3] - r[1]
                if 150 < h < 200: # Target the top grid (approx 164)
                    grid_handle = hwnd
                    print(f"Found Grid Handle: {hwnd} (Height: {h})")
        
        win32gui.EnumChildWindows(dlg.handle, callback, None)
        
        if grid_handle:
            # Inspection 1: UIA Dump
            print("\n[Test 1] Inspecting Grid with UIA...")
            try:
                # Wrap the raw handle in basic wrapper to print identifiers
                grid_ctrl = app.window(handle=grid_handle)
                print(grid_ctrl.print_control_identifiers())
            except Exception as e:
                print(f"   UIA Inspect failed: {e}")

            # Inspection 2: Clipboard
            print("\n[Test 2] Clipboard Copy (Ctrl+C)...")
            try:
                # Click center of grid to focus
                rect = win32gui.GetWindowRect(grid_handle)
                cx = (rect[0] + rect[2]) // 2
                cy = (rect[1] + rect[3]) // 2
                dlg.click_input(coords=(cx - rect[0], cy - rect[1]), absolute=False) # absolute=False means relative to dlg? No, pywinauto click_input uses screen or client.
                # Safer: click_input on the wrapper
                grid_ctrl = app.window(handle=grid_handle)
                grid_ctrl.click_input()
                time.sleep(0.5)
                
                import pyautogui
                # Try Ctrl+A then Ctrl+C
                pyautogui.hotkey('ctrl', 'a')
                time.sleep(0.2)
                pyautogui.hotkey('ctrl', 'c')
                time.sleep(0.5)
                
                copied = get_clipboard_text()
                if copied:
                    print(f"   [SUCCESS] Clipboard Data:\n{copied[:200]}...")
                else:
                    print("   [FAIL] Clipboard empty or not text.")
                    
            except Exception as e:
                print(f"   Clipboard test failed: {e}")
        else:
            print("Could not find the target grid handle.")

    except Exception as e:
        print(f"[ERROR] {e}")

if __name__ == "__main__":
    test_grid_access()
