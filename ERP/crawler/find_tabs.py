from pywinauto import Application
import sys

sys.stdout.reconfigure(encoding='utf-8')

def find_tabs_by_location():
    target_title = "점포물건 카드"
    print(f"Connecting to '{target_title}'...")
    try:
        app = Application(backend="uia").connect(title=target_title, timeout=10)
        win = app.window(title=target_title)
        
        print("\n[Listing all CheckBoxes/RadioButtons around Y=300-330]...")
        
        controls = win.descendants(control_type="CheckBox") + win.descendants(control_type="RadioButton")
        
        tabs = []
        for c in controls:
            r = c.rectangle()
            # "금액작업" was at 309. Let's look for anything in that row.
            if 300 <= r.top <= 340:
                print(f"Tab Candidate: '{c.window_text()}' - Rect: ({r.left}, {r.top}, {r.right}, {r.bottom})")
                tabs.append((r.left, c))
        
        # Sort by X position
        tabs.sort(key=lambda x: x[0])
        print("\n[Sorted Tabs (Left to Right)]")
        for i, (x, c) in enumerate(tabs):
             print(f"Tab [{i+1}]: '{c.window_text()}' at X={x}")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    find_tabs_by_location()
