from pywinauto import Application

def map_fields():
    target_title = "점포물건 카드"
    print(f"Connecting to window: '{target_title}'...")

    try:
        app = Application(backend="uia").connect(title=target_title, timeout=10)
        dlg = app.window(title=target_title)
        dlg.set_focus()
    except Exception as e:
        print(f"Connection failed: {e}")
        return

    # Labels we want to find
    target_labels = [
        "물건명", "보증금", "권리금", "월임대료", "합계금", 
        "관리비", "면적", "층수", "주소", "지번주소"
    ]
    
    print("\nScanning for field labels...")
    found_any = False
    
    # Iterate all descendants once
    descendants = dlg.descendants()
    
    for child in descendants:
        try:
            txt = child.window_text()
            rect = child.rectangle()
            
            # Check if this element is one of our target labels
            # We use strict matching or 'in' depending on noise
            matched = [L for L in target_labels if L in txt]
            
            if matched:
                found_any = True
                label = matched[0]
                print(f"[FOUND] Label: '{label}' | Text: '{txt}'")
                print(f"   - Coords: (L={rect.left}, T={rect.top}, R={rect.right}, B={rect.bottom})")
                
                # Propose a value region (Right of the label)
                # Assuming value is typically to the right ~100px width
                val_L = rect.right + 5
                val_R = val_L + 150
                val_T = rect.top
                val_B = rect.bottom
                print(f"   - Proposed Value Region: ({val_L}, {val_T}, {val_R}, {val_B})")
                print("-" * 40)
                
        except:
            pass
            
    if not found_any:
        print("[WARNING] No labels found. The text might be images or inaccessible.")
        # Fallback suggestion
        print("Fallback: We might need to use absolute coordinates based on window size.")

if __name__ == "__main__":
    map_fields()
