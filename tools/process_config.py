import json, argparse

import hashlib
import os
import re
import shutil
import time

addon_identifier = 'yn:torchouseful' #! MAKE THIS AUTOGENERATED
lang_code = 'en_US' #! MAKE THIS AUTOGENERATED

parser = argparse.ArgumentParser(description='Build config file from configuration_settings.json')
parser.add_argument('--target', choices=['release', 'debug', 'server'], default='debug', help='Whether to build the addon in debug or release mode or for servers')
parser.add_argument('--watch', '-w', action='store_true', help='Watch config.js and wordedit_settings.json for changes and update')
parser.add_argument('--generateConfigTS', action='store_true', help='Generate/update config.ts in the src folder')
parser.add_argument('--generateConfigJSON', action='store_true', help='Generate/update variables.json in the builds folder')
args = parser.parse_args()

settings = {
    "debug": {
        "description": "Enables debug messages to content logs.",
        "default": args.target == 'debug'
    }
}
version_str = ''

def compute_hash(filename):
    with open(filename, 'rb') as f:
        file_hash = hashlib.sha256()
        while chunk := f.read(8192):
            file_hash.update(chunk)
    return file_hash.hexdigest()

def generateScript(isServer):
    indent = "\t" * 2
    result = ''
    if isServer:
        result += 'import { variables } from "@minecraft/server-admin";\n\n'

    result += 'export default {\n'
    lang_entries = []

    for name, data in settings.items():
        if isServer:
            result += f'  {name}: variables.get("{name}"),\n'
        else:
            value = data["default"]
            if type(value) is str:
                value = f'"{value}"'
            elif type(value) is bool:
                value = "true" if value else "false"
            elif data['type'] == "range":
                value = f'{{\n{indent}"from": {value["from"]},\n{indent}"to": {value["to"]}\n\t}}'
            elif data["type"] == "customizableArray":
                value = "[" + ", ".join([f'"{x}"' if isinstance(x, str) else ("true" if x else "false") if isinstance(x, bool) else str(x) for x in value]) + "]"
            elif data["type"] == "selectionArray":
                new_value = "[" + ", ".join([f'"{x}"' if isinstance(x, str) else ("true" if x else "false") if isinstance(x, bool) else str(x) for x in value]) + "]"
                value = "{" + f'\n{indent}"selection": {new_value}\n\t' + "}"
            elif data['type'] == "customizableMap":
                if type(value) is str:
                    value = f'"{value}"'
                elif type(value) is bool:
                    value = "true" if value else "false"
                    
                entries_list = []
                for key, value in value.items():
                    if isinstance(value, str):
                        formatted_value = f'"{value}"'
                    elif isinstance(value, bool):
                        formatted_value = "true" if value else "false"
                    else:
                        formatted_value = str(value)
                    entries_list.append(f'"{key}": {formatted_value}')
                entries = ', '.join(entries_list)
                value = '{\n' + indent + entries.replace(', ', f',\n{indent}') + '\n\t}'

            result += f'  /**\n'
            for line in data['description'].splitlines():
                result += f'   * {line}\n'
            result += f'   */\n'
            result += f'  {name}: {value},\n'

            # Generate language file entries
            lang_entries.append((
                f'ConfigurationForm.{addon_identifier}.{name}.name',
                f'{name}'
            ))
            description = data["description"].replace('\n', '%s')  # Replace newline with %s
            lang_entries.append((
                f'ConfigurationForm.{addon_identifier}.{name}.description',
                f'{name}: %s{description}'
            ))

    result += '};\n\n'

    result += '\n'.join([
        '// version (do not change)',
        f'export const VERSION = "{version_str}";'
    ])

    # Generate language file content
    lang_content = '\n'.join([f'{entry[0]}={entry[1]}' for entry in lang_entries])

    # Write language file content
    lang_file_path = f'RP/texts/{lang_code}.lang'

    # Read existing language file content to preserve other sections
    existing_lang_content = ''
    if os.path.exists(lang_file_path):
        with open(lang_file_path, 'r') as existing_lang_file:
            existing_lang_content = existing_lang_file.read()

    # Find the starting and ending index of the "Configuration" section
    config_start_idx = existing_lang_content.find('## Configuration\n')
    config_end_idx = existing_lang_content.find('## ', config_start_idx + 1)
    if config_end_idx == -1:
        config_end_idx = len(existing_lang_content)

    # Generate language file content for the "Configuration" section
    config_section_content = '\n'.join([f'{entry[0]}={entry[1]}' for entry in lang_entries])

    # Modify the existing content by replacing the "Configuration" section
    modified_lang_content = (
        existing_lang_content[:config_start_idx + len('## Configuration\n')] +
        config_section_content +
        existing_lang_content[config_end_idx:]
    )

    # Add two new lines before the "## Error Message" section
    modified_lang_content = modified_lang_content.replace('## Post-Configuration', '\n\n## Post-Configuration')

    # Write the modified language file content
    with open(lang_file_path, 'w') as lang_file:
        lang_file.write(modified_lang_content)

    return result

def generateVariables():
    result = []
    for name, data in settings.items():
        value = data["default"]

        if type(value) is str:
            value = f'"{value}"'
        elif type(value) is bool:
            value = "true" if value else "false"
        
        var = '\n    /**\n'
        for line in data['description'].splitlines():
            var += f'     * {line}\n'
        var += '     */\n'
        var += f'    "{name}": {value}'
        result.append(var)
    return '{' + ",".join(result) + '\n}'

prevResult = ''

def update():
    global prevResult
    # Load settings from configuration_settings.json before updating
    load_settings()
    
    with open('src/config.ts', 'w') as file:
        file.write(generateScript(False))

    time.sleep(0.5)
    with open('BP/scripts/config.js', 'w') as file:
        prevResult = generateScript(args.target == 'server')
        file.write(prevResult)
    
        
def check_for_changes():
    settings_hash = compute_hash('src/configuration_settings.json')
    config_js_hash = compute_hash('BP/scripts/config.js')
    config_ts_hash = compute_hash('src/config.ts')

    try:
        with open('src/.config_hashes', 'r') as f:
            data = f.read().splitlines()
    except FileNotFoundError:
        data = ['', '', '']
        
    if data[0] == settings_hash and data[1] == config_js_hash:
        return False
    else:
        with open('src/.config_hashes', 'w') as f:
            f.write(f"{settings_hash}\n{config_js_hash}\n{config_ts_hash}\n")

        # Update config.js
        update()

        # Copy config.js to BP/scripts if not already there
        if not os.path.exists('BP/scripts/config.js'):
            shutil.copyfile('BP/scripts/config.js', 'BP/scripts/config.js')

        # Update config.ts
        with open('src/config.ts', 'r') as f:
            config_ts_content = f.read()
            with open('src/config.ts', 'w') as f:
                f.write(re.sub(r"const VERSION = .+;", f"const VERSION = \"{version_str}\";", config_ts_content))
        
        return True     
    

def load_settings():
    global settings
    try:
        os.utime('src/configuration_settings.json', None)
        with open('src/configuration_settings.json', 'r') as file:
            settings = {**settings, **json.load(file)}
            
    except (FileNotFoundError, json.JSONDecodeError):
        # Handle the case where the file is empty or not valid JSON.
        print("Error: Unable to load settings from configuration_settings.json.")
    finally:
        # print(settings)
        pass

# load settings file
load_settings()

# load addon version
with open('setup/mc_manifest.json', 'r') as file:
    manifest = json.load(file)
    version = manifest['header']['version']

    if type(version) is str:
        version_str = version
    else:
        version_str = '.'.join(map(str, version)) + (' [BETA]' if len(version) > 3 else '')\

# Generate src/config.ts
if args.generateConfigTS:
    with open('src/config.ts', 'w') as file:
        file.write(generateScript(False))
    exit(0)

# Generate builds/variables.json
if args.generateConfigJSON:
    with open('builds/variables.json', 'w') as file:
        file.write(generateVariables())
    exit(0)

if args.watch:
    from watchdog.observers import Observer
    from watchdog.events import FileSystemEventHandler
    
    class MyHandler(FileSystemEventHandler):
        def on_modified(self, ev):
            if ev.src_path in ['src\configuration_settings.json']:
                if check_for_changes():
                    print("Settings changed! Updating...")
    
    obsSettings = Observer()
    obsSettings.schedule(MyHandler(),  path='src')
    obsSettings.start()

    obsConfigJS = Observer()
    obsConfigJS.schedule(MyHandler(),  path='BP\scripts')
    obsConfigJS.start()

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        obsSettings.stop()
        obsConfigJS.stop()
    
    obsSettings.join()
    obsConfigJS.join()
else:
    update()