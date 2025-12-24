from pywinauto import Application
import sys

# Force UTF-8
sys.stdout.reconfigure(encoding='utf-8')

def check_uia_values():
    target_title = "점포물건 카드"
    print(f"Connecting to '{target_title}'...")
    
    try:
        app = Application(backend="uia").connect(title=target_title, timeout=10)
        dlg = app.window(title=target_title)
        
        # Find the Price History Grid (Top one)
        # Based on UIA dump, it's auto_id="302086032" or just the first Table
        # Let's verify by finding all tables
        tables = dlg.descendants(control_type="Table")
        if not tables:
            print("No UIA Tables found.")
            return

        print(f"Found {len(tables)} tables.")
        
        for i, table in enumerate(tables):
            print(f"\n--- Table {i} ---")
            # Try to get rows
            rows = table.descendants(control_type="Custom") # Rows are 'Custom' type
            print(f"Row Count: {len(rows)}")
            
            if len(rows) > 0:
                # Check Row 1 (assuming Row 0 is header)
                target_row = rows[1] if len(rows) > 1 else rows[0]
                print(f"Inspecting {target_row.window_text()}...")
                
                cells = target_row.children(control_type="DataItem")
                for j, cell in enumerate(cells):
                    print(f"  Cell {j} Name: '{cell.window_text()}'")
                    
                    # 1. Try Value Pattern
                    try:
                        val = cell.iface_value.CurrentValue
                        print(f"    -> Pattern.Value: '{val}'")
                    except:
                        print("    -> Pattern.Value: <Not Supported>")

                    # 2. Try Legacy Pattern (Win32)
                    try:
                        legacy = cell.iface_legacy_iaccessible
                        print(f"    -> Legacy.Value: '{legacy.CurrentValue}'")
                        print(f"    -> Legacy.Name:  '{legacy.CurrentName}'")
                        print(f"    -> Legacy.Role:  '{legacy.CurrentRole}'")
                    except:
                        print("    -> Legacy: <Not Supported>")

    except Exception as e:
        print(f"[ERROR] {e}")

if __name__ == "__main__":
    check_uia_values()
