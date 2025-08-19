import bpy, json, logging, pathlib, requests, time
from bpy.app.handlers import persistent

bl_info = {
    "name": "BlenderRPC",
    "author": "Wixonic",
    "version": (1, 2, 0),
    "blender": (2, 8, 0),
    "description": "Blender add-on for WixiBot",
    "category": "System"
}

update_delay = 10.0
app_version = "Blender v?.?.?"
GPUName = "Unknown GPU"

small_image = None
small_text = None
large_image = None
large_text = None
details = None
state = None
start_time = int(round(time.time() * 1000))

@persistent
def start_timer(dummy):
    global app_version, GPUName, small_image, small_text, large_image, large_text, details, state, start_time

    app_version = f"Blender v{bpy.app.version_string}"
    
    try:
        GPUName = bpy.context.preferences.addons["cycles"].preferences.devices[0].name
    except (KeyError, IndexError, AttributeError):
        GPUName = "Unknown GPU"

    small_image = GPUName
    small_text = GPUName
    large_image = "icon"
    large_text = app_version
    start_time = int(round(time.time() * 1000))
    
    bpy.app.timers.register(update)
    print("Start timer")

@persistent
def render_started(dummy):
    global small_image, small_text, large_image, large_text, details, state, start_time
    
    scene = bpy.context.scene
    total_frames = scene.frame_end - scene.frame_start + 1
    
    small_image = "icon"
    small_text = app_version
    large_image = GPUName
    large_text = f"Rendering {total_frames} frames"
    details = f"Rendering on {GPUName}"
    state = f"Rendering {total_frames} frames"
    start_time = int(round(time.time() * 1000))
    
    print("Render started")

@persistent
def render_ended(dummy):
    global small_image, small_text, large_image, large_text, details, state, start_time
    
    small_image = GPUName
    small_text = GPUName
    large_image = "icon"
    large_text = app_version
    details = None
    state = None
    start_time = int(round(time.time() * 1000))
    
    print("Render ended")

@persistent
def render_frame(dummy):
    scene = bpy.context.scene
    total_frames = scene.frame_end - scene.frame_start + 1
    current_frame = scene.frame_current - scene.frame_start + 1
    frames_done = scene.frame_current - scene.frame_start
    progress_percentage = (frames_done / total_frames) * 100
    
    small_image = "icon"
    small_text = f"{progress_percentage:.1f}% completed"
    large_image = GPUName
    large_text = f"Rendering {current_frame}/{total_frames} frames"
    details = f"Rendering on {GPUName}"
    state = f"Rendering {current_frame}/{total_frames} frames"
    
    print("Render frame")

def update():
    data = {
        "small_image": small_image,
        "small_text": small_text,
        "large_image": large_image,
        "large_text": large_text,
        "details": details,
        "state": state,
        "start_time": start_time
    }

    try:
        with open(pathlib.Path(__file__).parent.resolve() / "secrets.json", "r") as f:
            secrets = json.load(f)
            ACCESS_TOKEN = secrets.get("wixkey")

        response = requests.post("https://server.wixonic.fr/rpc/blender/", json=data, headers={
            "Authorization": f"WixKey {ACCESS_TOKEN}"
        })

        if response.status_code != 200:
            print(f"Failed to send data: {response.status_code}, {response.text}")
    except requests.RequestException as e:
        print(f"Request error: {e}")
    
    return update_delay

def register():
    bpy.app.timers.register(update)

    bpy.app.handlers.load_post.append(start_timer)
    bpy.app.handlers.render_init.append(render_started)
    bpy.app.handlers.render_complete.append(render_ended)
    bpy.app.handlers.render_cancel.append(render_ended)
    bpy.app.handlers.render_write.append(render_frame)
    
    print("Blender RPC registered")

def unregister():
    bpy.app.handlers.load_post.remove(start_timer)
    bpy.app.handlers.render_init.remove(render_started)
    bpy.app.handlers.render_complete.remove(render_ended)
    bpy.app.handlers.render_cancel.remove(render_ended)
    bpy.app.handlers.render_write.remove(render_frame)
    
    print("Blender RPC unregistered")

if __name__ == "__main__":
    register()