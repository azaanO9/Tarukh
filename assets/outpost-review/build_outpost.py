"""Assemble the reviewed outpost with licensed furniture; no gameplay integration.

Blender 5.2:
  blender --background --python build_outpost.py -- --output /path/to/review --render
Source hashes, authors and licenses are recorded in sources.json.
"""

import argparse
import hashlib
import json
import math
import struct
import sys
from pathlib import Path

import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
parser = argparse.ArgumentParser()
parser.add_argument("--output", type=Path, default=HERE)
parser.add_argument("--render", action="store_true")
parser.add_argument("--preview-only", action="store_true")
parser.add_argument("--samples", type=int, default=64)
args = parser.parse_args(
    sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
)
args.output = args.output.resolve()
args.output.mkdir(parents=True, exist_ok=True)
SCALE = 3.048 / 178
manifest = json.loads((HERE / "sources.json").read_text(encoding="utf-8"))
sources = {a["id"]: a for a in manifest}
for entry in manifest:
    data = (HERE / entry["file"]).read_bytes()
    if hashlib.sha256(data).hexdigest() != entry["sha256"]:
        raise ValueError("Source hash mismatch: " + entry["id"])

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(HERE / "sources/architecture.glb"))
scene = bpy.context.scene
scene.unit_settings.system = "METRIC"
scene["title"] = "TARUKH Mars Dune Outpost — licensed interior review"
scene["credits"] = json.dumps(manifest)
scene["scope"] = "Separate review asset. No gameplay or collision integration."
templates = {}
placements = []


def root(name):
    obj = bpy.data.objects.get(name)
    if obj is None:
        obj = bpy.data.objects.new(name, None)
        scene.collection.objects.link(obj)
    return obj


def bounds(objects):
    bpy.context.view_layer.update()
    points = [
        o.matrix_world @ Vector(c)
        for o in objects
        if o.type == "MESH"
        for c in o.bound_box
    ]
    low = Vector([min(p[a] for p in points) for a in range(3)])
    high = Vector([max(p[a] for p in points) for a in range(3)])
    return low, high


def screen_material():
    existing = bpy.data.materials.get("TARUKH display")
    if existing:
        return existing
    mat = bpy.data.materials.new("TARUKH display")
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    shader = nodes.get("Principled BSDF")
    image = nodes.new("ShaderNodeTexImage")
    image.image = bpy.data.images.load(
        str(HERE / "sources/surface-ops.png"), check_existing=True
    )
    links.new(image.outputs["Color"], shader.inputs["Base Color"])
    links.new(image.outputs["Color"], shader.inputs["Emission Color"])
    shader.inputs["Emission Strength"].default_value = 0.45
    shader.inputs["Roughness"].default_value = 0.24
    return mat


def prepare_laptop(objects):
    pivot = next(o for o in objects if o.name.startswith("LidPivot"))
    pivot.rotation_mode = "XYZ"
    pivot.rotation_euler.x = math.radians(103)
    # Replaceable screen artwork follows the downloaded asset's measured display.
    width, height, cy, z = 0.389878, 0.263614, 0.143757, 0.0002
    mesh = bpy.data.meshes.new("Laptop display artwork")
    mesh.from_pydata(
        [
            (width / 2, cy - height / 2, z),
            (-width / 2, cy - height / 2, z),
            (-width / 2, cy + height / 2, z),
            (width / 2, cy + height / 2, z),
        ],
        [],
        [(0, 1, 2, 3)],
    )
    uv = mesh.uv_layers.new()
    for loop, coords in zip(mesh.loops, [(0, 0), (1, 0), (1, 1), (0, 1)]):
        uv.data[loop.index].uv = coords
    obj = bpy.data.objects.new("TARUKH screen artwork", mesh)
    scene.collection.objects.link(obj)
    obj.parent = pivot
    mesh.materials.append(screen_material())
    objects.append(obj)
    bpy.context.view_layer.update()


def template(key):
    if key in templates:
        return templates[key]
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(HERE / sources[key]["file"]))
    objects = [o for o in bpy.data.objects if o not in before]
    if key == "laptop":
        prepare_laptop(objects)
    meshes = [o for o in objects if o.type == "MESH"]
    low, high = bounds(meshes)
    centre = Vector(((low.x + high.x) / 2, (low.y + high.y) / 2, low.z))
    holder = root("TEMPLATE_" + key)
    matrices = {o: o.matrix_world.copy() for o in meshes}
    for obj in meshes:
        obj.parent = holder
        obj.matrix_world = matrices[obj]
        obj.location -= centre
        obj.name = key + "/" + obj.name
    for obj in objects:
        if obj.type != "MESH":
            bpy.data.objects.remove(obj, do_unlink=True)
    result = (holder, meshes, high - low)
    templates[key] = result
    return result


def place(key, room, u, v, z=0.01, angle=0, dimensions=None):
    holder, parts, native = template(key)
    obj = bpy.data.objects.new(key + " instance", None)
    scene.collection.objects.link(obj)
    obj.parent = root(room)
    obj.location = ((u - 573) * SCALE, (372.5 - v) * SCALE, z)
    obj.rotation_euler.z = math.radians(angle)
    if dimensions:
        obj.scale = tuple(
            dimensions[i] / native[i] if dimensions[i] is not None else 1
            for i in range(3)
        )
    entry = sources[key]
    obj["asset_id"] = key
    obj["creator"] = entry["creator"]
    obj["source"] = entry["source"]
    obj["license"] = entry["license"]
    for part in parts:
        child = part.copy()
        child.data = part.data
        scene.collection.objects.link(child)
        child.parent = obj
        child.matrix_parent_inverse.identity()
        child.matrix_basis = part.matrix_basis.copy()
    placements.append(
        {
            "asset": key,
            "room": room,
            "plan": [u, v],
            "z": z,
            "rotation": angle,
            "dimensions": list(dimensions or native),
        }
    )
    return obj


# Personal rooms. Bed headboards face east; access remains on the clear side.
for i, (v, bed_v) in enumerate([(188, 171), (309, 288), (429, 454), (549, 571)], 1):
    room = "ROOM_CREW_%02d" % i
    place("bed", room, 185, bed_v, angle=-90, dimensions=(1.01, 2.02, 1.12))
    place("desk", room, 85, v - 24, angle=0, dimensions=(1.25, 0.53, 0.75))
    place("laptop", room, 85, v - 23, z=0.76, angle=180, dimensions=(0.35, None, None))
    place("office-chair", room, 87, v + 18, angle=180, dimensions=(0.62, 0.61, 1.06))
    place("drawers", room, 230, v + 34, dimensions=(0.34, 0.36, 0.72))

# Hydroponic work areas retain the two crop locations in the supplied plan.
for v in [156, 591]:
    room = "ROOM_HYDROPONICS"
    place(
        "grow-bench",
        room,
        382,
        v,
        dimensions=(1.65, 0.49, 0.84),
        angle=180 if v > 300 else 0,
    )
    for u in [346, 381, 416]:
        place("plant-tray", room, u, v, z=0.85, dimensions=(0.43, 0.28, 0.08))
        for du in [-8, 8]:
            plant = place(
                "lettuce",
                room,
                u + du,
                v,
                z=0.91,
                angle=(u + du) % 70,
                dimensions=(0.22, 0.22, 0.16),
            )
    place("cabinet", room, 382, 210 if v < 300 else 546, dimensions=(1.4, 0.36, 0.65))

# Laundry and hygiene: source models replace the previous cylinders and blocks.
for u in [352, 407]:
    place(
        "washer", "ROOM_HYGIENE_CORE", u, 250, angle=180, dimensions=(0.65, 0.65, 0.86)
    )
for u, v, angle in [(360, 296, 0), (420, 373, -90), (459, 373, 90)]:
    place(
        "vanity", "ROOM_HYGIENE_CORE", u, v, angle=angle, dimensions=(0.46, 0.39, 0.84)
    )
place("toilet", "ROOM_HYGIENE_CORE", 408, 312, dimensions=(0.40, 0.64, 0.82))
place("vanity", "ROOM_HYGIENE_EAST", 982, 161, dimensions=(0.46, 0.40, 0.84))
place("toilet", "ROOM_HYGIENE_EAST", 1035, 165, dimensions=(0.40, 0.64, 0.82))
for u, v, room in [(410, 440, "ROOM_HYGIENE_CORE"), (931, 169, "ROOM_HYGIENE_EAST")]:
    place("shower-tray", room, u, v, dimensions=(0.76, 0.76, 0.06))
    place("shower", room, u, v - 18, z=0.45, dimensions=(0.16, 0.16, 1.45))

# Shared lounge; soft surfaces keep the technical space comfortable.
room = "ROOM_RECREATION"
place("sofa", room, 549, 270, angle=90, dimensions=(2.05, 0.86, 0.79))
place("lounge-chair", room, 624, 191, dimensions=(0.66, 0.59, 0.80))
place("lounge-chair", room, 624, 321, angle=180, dimensions=(0.66, 0.59, 0.80))
place("dining-table", room, 611, 263, dimensions=(0.68, 0.64, 0.44))
place("cabinet", room, 657, 265, angle=-90, dimensions=(1.48, 0.38, 0.58))
place("monitor", room, 657, 265, z=0.60, angle=-90, dimensions=(1.10, 0.20, 0.68))

# Galley: fitted cabinetry, real appliances and a compact folding table.
room = "ROOM_KITCHEN"
for u in [496, 544, 592, 640]:
    place("kitchen-unit", room, u, 590, angle=180, dimensions=(0.80, 0.49, 0.86))
place("microwave", room, 635, 590, z=0.87, angle=180, dimensions=(0.48, 0.34, 0.30))
place("fridge", room, 465, 497, angle=90, dimensions=(0.55, 0.49, 1.76))
place("kitchen-unit", room, 465, 432, angle=90, dimensions=(0.90, 0.49, 0.86))
place("sink", room, 465, 432, z=0.70, angle=90, dimensions=(0.84, 0.43, 0.19))
place("dining-table", room, 590, 497, dimensions=(1.60, 0.83, 0.75))
for u in [565, 615]:
    place("lounge-chair", room, u, 451, dimensions=(0.52, 0.48, 0.80))
    place("lounge-chair", room, u, 544, angle=180, dimensions=(0.52, 0.48, 0.80))

# Operations desks: four workplaces facing the correct side of the table.
room = "ROOM_WORKROOM"
place("workbench", room, 927, 375, dimensions=(4.12, 1.15, 0.75))
for u in [861, 992]:
    for v, chair_v, angle, chair_angle in [(358, 326, 0, 0), (392, 424, 180, 180)]:
        place("laptop", room, u, v, z=0.76, angle=angle, dimensions=(0.38, None, None))
        place(
            "mouse",
            room,
            u + 17,
            v,
            z=0.76,
            angle=angle,
            dimensions=(0.065, 0.10, 0.033),
        )
        place(
            "office-chair",
            room,
            u,
            chair_v,
            angle=chair_angle,
            dimensions=(0.64, 0.64, 1.10),
        )

room = "ROOM_FABRICATION"
place("printer", room, 733, 296, dimensions=(0.83, 0.77, 1.35))
room = "ROOM_ROBOTICS"
place("desk", room, 766, 582, angle=180, dimensions=(2.25, 0.54, 0.75))
for u in [730, 807]:
    place("laptop", room, u, 580, z=0.76, dimensions=(0.35, None, None))
    place("office-chair", room, u, 546, dimensions=(0.61, 0.59, 1.07))
place("cabinet", room, 786, 520, dimensions=(0.82, 0.52, 0.75))
place("robot-arm", room, 786, 520, z=0.76, dimensions=(0.72, 0.55, 0.81))

room = "ROOM_TREATMENT"
place("medical-bed", room, 1033, 554, angle=-90, dimensions=(0.85, 1.95, 0.89))
place("cabinet", room, 875, 550, angle=90, dimensions=(1.32, 0.40, 0.84))
place("medical-sink", room, 884, 513, angle=90, dimensions=(0.47, 0.43, 0.84))
place("medical-trolley", room, 971, 583, dimensions=(0.46, 0.40, 1.12))
place("monitor", room, 875, 553, z=0.86, angle=90, dimensions=(0.46, 0.18, 0.38))
place("keyboard", room, 891, 552, z=0.86, angle=90, dimensions=(0.37, 0.12, 0.025))

room = "ROOM_FITNESS"
place("rower", room, 786, 168, angle=90, dimensions=(0.58, 2.07, 0.87))
place("exercise-bike", room, 733, 222, angle=90, dimensions=(0.52, 1.04, 1.13))

# Storage occupies the same plan locations, using the library cabinets.
for u, v, w, d, h, angle in [
    (546, 146, 3.1, 0.37, 0.94, 0),
    (867, 159, 0.54, 0.67, 0.94, 0),
    (875, 232, 0.54, 0.48, 0.94, 180),
    (710, 445, 0.47, 0.93, 0.94, 90),
    (1083, 155, 0.41, 0.48, 0.94, 0),
]:
    place("cabinet", "STORAGE", u, v, dimensions=(w, d, h), angle=angle)

# Remove source staging objects, retaining shared mesh and image data in instances.
for holder, parts, _ in templates.values():
    for part in parts:
        bpy.data.objects.remove(part, do_unlink=True)
    bpy.data.objects.remove(holder, do_unlink=True)

# Keep the reviewed material choice. Imported libraries use independent variant
# indices, which cannot be combined into a single scene-wide variant registry.
for mesh in bpy.data.meshes:
    if hasattr(mesh, "gltf2_variant_mesh_data"):
        mesh.gltf2_variant_mesh_data.clear()
if hasattr(scene, "gltf2_KHR_materials_variants_variants"):
    scene.gltf2_KHR_materials_variants_variants.clear()

# Calibrated soft lighting for the review renders, not exported as gameplay lights.
world = bpy.data.worlds.new("Warm architectural studio")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.65, 0.72, 0.78, 1)
world.node_tree.nodes["Background"].inputs[1].default_value = 0.32
scene.world = world


def light(name, location, energy, size, color):
    data = bpy.data.lights.new(name, "AREA")
    data.energy = energy
    data.shape = "DISK"
    data.size = size
    data.color = color
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    obj.location = location
    obj.rotation_euler = (
        (Vector((0, 0, 0)) - obj.location).to_track_quat("-Z", "Y").to_euler()
    )


light("Studio key", (-5, -2, 15), 4300, 9, (1, 0.85, 0.69))
light("Studio fill", (9, -7, 10), 2800, 8, (0.71, 0.85, 1))
light("Studio rim", (-5, 8, 10), 2300, 7, (1, 0.93, 0.82))


def camera(name, position, target, scale):
    data = bpy.data.cameras.new(name)
    data.type = "ORTHO"
    data.ortho_scale = scale
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    obj.location = position
    obj.rotation_euler = (
        (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()
    )
    return obj


cams = {
    "cutaway": camera("Review cutaway", (4, -13, 21), (0, 0, 0.2), 23),
    "workspace": camera("Review workspace", (8, -4.7, 5.8), (5.6, 0.1, 0.7), 6.2),
    "crew": camera("Review crew", (-11, -0.8, 5), (-7.1, 2.1, 0.65), 5),
    "exterior": camera("Review exterior", (14, -19, 17), (0, 0, 1.3), 24),
}
scene.render.engine = "CYCLES"
scene.cycles.samples = args.samples
scene.cycles.use_denoising = True
scene.cycles.max_bounces = 6
scene.view_settings.view_transform = "AgX"
scene.view_settings.exposure = 0.3
scene.render.resolution_percentage = 100
scene.render.image_settings.media_type = "IMAGE"
scene.render.image_settings.file_format = "PNG"
# Prefer available GPU compute without making it a rebuild requirement.
try:
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "CUDA"
    prefs.get_devices()
    available = [d for d in prefs.devices if d.type == "CUDA"]
    if available:
        for device in prefs.devices:
            device.use = device.type == "CUDA"
        scene.cycles.device = "GPU"
except (TypeError, ValueError, RuntimeError):
    pass


def render(name, width=1800, height=1100):
    scene.camera = cams[name]
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.filepath = str(args.output / (name + "-preview.png"))
    bpy.ops.render.render(write_still=True)


def export(name):
    if args.preview_only:
        return
    bpy.ops.object.select_all(action="DESELECT")
    for obj in scene.objects:
        if obj.type not in ["LIGHT", "CAMERA"] and not obj.hide_render:
            obj.hide_set(False)
            obj.select_set(True)
    kwargs = dict(
        filepath=str(args.output / (name + ".glb")),
        export_format="GLB",
        use_selection=True,
        export_extras=True,
        export_lights=False,
        export_cameras=False,
        export_materials="EXPORT",
        export_texcoords=True,
        export_tangents=True,
        export_image_format="AUTO",
    )
    # Preserve the source maps as embedded PNG/JPEG. Blender 5.2's WebP exporter
    # cannot write some of the chair's grayscale maps and silently omits them.
    bpy.ops.export_scene.gltf(**kwargs)
    raw = (args.output / (name + ".glb")).read_bytes()
    document = json.loads(raw[20 : 20 + struct.unpack_from("<I", raw, 12)[0]])
    if any("bufferView" not in image for image in document.get("images", [])):
        raise ValueError("Export contains an external or missing image")
    for texture in document.get("textures", []):
        source = texture.get(
            "source",
            texture.get("extensions", {}).get("EXT_texture_webp", {}).get("source"),
        )
        if source is None or not 0 <= source < len(document.get("images", [])):
            raise ValueError("Export omitted a texture source")
    bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=str(args.output / (name + ".blend")))


# Cutaway and complete models share furniture, materials, coordinates and source credits.
wall_states = []
hidden = []
roof = bpy.data.objects.get("ROOF")
for obj in list(scene.objects):
    if obj.name.startswith("Partition_") and "_trim" not in obj.name:
        wall_states.append((obj, obj.location.copy(), obj.scale.copy()))
        obj.scale.z *= 1.12 / obj.dimensions.z
        obj.location.z = 0.56
    elif obj.name.startswith("Partition_") and "_trim.002" in obj.name:
        wall_states.append((obj, obj.location.copy(), obj.scale.copy()))
        obj.location.z = 1.095
    elif obj.name.startswith(("Shell rib", "Wet-room jamb")):
        wall_states.append((obj, obj.location.copy(), obj.scale.copy()))
        obj.scale.z *= 1.12 / obj.dimensions.z
        obj.location.z = 0.56
    upper_cladding = (
        obj.name.startswith("Printed shell stratum")
        and obj.matrix_world.translation.z > 1.12
    )
    if (
        upper_cladding
        or obj.name.startswith(("Door header", "Outer door head"))
        or obj == roof
        or (roof and obj in roof.children_recursive)
    ):
        obj.hide_render = True
        hidden.append(obj)
scene.camera = cams["cutaway"]
if args.render:
    render("cutaway")
    render("workspace", 1600, 1100)
    render("crew", 1400, 1050)
export("tarukh-outpost-cutaway")
for obj, position, scale in wall_states:
    obj.location = position
    obj.scale = scale
for obj in hidden:
    obj.hide_render = False
scene.camera = cams["exterior"]
if args.render:
    render("exterior", 1500, 1000)
export("tarukh-outpost-full")
stats = {
    "instances": len(placements),
    "source_models": len(sources),
    "placements": placements,
    "objects": len(scene.objects),
    "materials": len([m for m in bpy.data.materials if m.users]),
    "blender": bpy.app.version_string,
}
(args.output / "assembly-report.json").write_text(
    json.dumps(stats, indent=2) + "\n", encoding="utf-8"
)
print("ASSEMBLY COMPLETE", len(placements), "licensed model instances")
