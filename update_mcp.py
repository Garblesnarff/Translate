import json
import os

settings_path = os.path.expanduser("~/.gemini/settings.json")

try:
    with open(settings_path, 'r') as f:
        settings = json.load(f)

    pearls_config = {
        "httpUrl": "https://pearls.infiniterealms.tech/mcp",
        "headers": {
            "Authorization": "Bearer pearl_e4u9x83zvURFiVN3tdWCKr-wSERfGhtQ"
        }
    }

    if "mcpServers" not in settings:
        settings["mcpServers"] = {}
    
    settings["mcpServers"]["pearls"] = pearls_config

    with open("temp_settings.json", 'w') as f:
        json.dump(settings, f, indent=2)
        
    print("Successfully updated settings configuration.")

except Exception as e:
    print(f"Error updating settings: {e}")
