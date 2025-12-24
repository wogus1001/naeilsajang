from pywinauto import Application
import sys

sys.stdout.reconfigure(encoding='utf-8')

def find_tabs():
    target_title = "점포물건 카드"
    print(f"Connecting to '{target_title}'...")
    try:
        app = Application(backend="uia").connect(title=target_title, timeout=10)
        win = app.window(title=target_title)
        
        print("\n[Searching for '매출' and '금액작업']...")
        
        # Search for "매출"
        sales_tab = win.descendants(title="매출")
        if sales_tab:
            for s in sales_tab:
                r = s.rectangle()
                print(f"FOUND '매출': {s.friendly_class_name()} - Rect: ({r.left}, {r.top}, {r.right}, {r.bottom})")
        else:
            print("NOT FOUND '매출'")

        # Search for "금액작업" (to go back)
        default_tab = win.descendants(title="금액작업")
        if default_tab:
            for d in default_tab:
                r = d.rectangle()
                print(f"FOUND '금액작업': {d.friendly_class_name()} - Rect: ({r.left}, {r.top}, {r.right}, {r.bottom})")
        else:
            print("NOT FOUND '금액작업'")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    find_tabs()
