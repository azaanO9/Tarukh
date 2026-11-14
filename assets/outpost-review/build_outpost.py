"""Rebuild TARUKH's separate outpost review assets with Blender 5.2.

Run: blender --background --python build_outpost.py -- --output <directory>
The input floor plan is a user-supplied Mars Dune Alpha reference. No source
pixels, downloaded meshes or external textures are embedded in these models.
The geometry, colours, inferred elevations and furnishings are TARUKH adaptations.
"""

import argparse
import sys
from pathlib import Path
import bpy

parser = argparse.ArgumentParser()
parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parent)
args = parser.parse_args(
    sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
)
args.output.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)

# Geometry, metre coordinates, reusable materials and presentation helpers.
import bpy, math, random
from mathutils import Vector

random.seed(41)
S = 3.048 / 178


def xy(u, v):
    return ((u - 573) * S, (372.5 - v) * S)


def mat(name, hex, rough=0.5, metal=0, emit=0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    c = [int(hex[i : i + 2], 16) / 255 for i in (0, 2, 4)]
    c = [v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c]
    p = m.node_tree.nodes.get("Principled BSDF")
    p.inputs["Base Color"].default_value = (*c, 1)
    p.inputs["Roughness"].default_value = rough
    p.inputs["Metallic"].default_value = metal
    if emit:
        p.inputs["Emission Color"].default_value = (*c, 1)
        p.inputs["Emission Strength"].default_value = emit
    m.diffuse_color = (*c, 1)
    return m


M = {}
for n, c, r, met, em in [
    ("ivory", "d8d8cf", 0.48, 0.15, 0),
    ("dark", "273039", 0.42, 0.6, 0),
    ("orange", "c77636", 0.38, 0.25, 0),
    ("teal", "286064", 0.4, 0.3, 0),
    ("glass", "163846", 0.16, 0.65, 0),
    ("floor", "998d7d", 0.75, 0.1, 0),
    ("sand", "a77a59", 0.94, 0, 0),
    ("silver", "9caba9", 0.29, 0.75, 0),
    ("linen", "e3d8bd", 0.91, 0, 0),
    ("cushion", "53636a", 0.8, 0, 0),
    ("leaf", "69805b", 0.76, 0, 0),
    ("leaflight", "9aa875", 0.72, 0, 0),
    ("soil", "43382e", 0.96, 0, 0),
    ("light", "e8d4a7", 0.36, 0.1, 3),
    ("cyan", "73d5cf", 0.25, 0.1, 2),
    ("screen", "1e555e", 0.28, 0.4, 0.25),
]:
    M[n] = mat("MAT_" + n, c, r, met, em)


def root(name):
    o = bpy.data.objects.get(name)
    if o:
        return o
    o = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(o)
    return o


def link(o, parent):
    if parent:
        o.parent = root(parent)
    return o


def box(name, loc, dim, material="ivory", bevel=0.025, parent=None):
    import bmesh

    key = "box_" + str(tuple(round(v, 4) for v in dim)) + "_" + str(bevel)
    mesh = bpy.data.meshes.get(key)
    if not mesh:
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1)
        for v in bm.verts:
            v.co.x *= dim[0]
            v.co.y *= dim[1]
            v.co.z *= dim[2]
        if bevel:
            bmesh.ops.bevel(
                bm,
                geom=list(bm.edges),
                offset=min(bevel, min(dim) * 0.22),
                segments=3,
                affect="EDGES",
            )
        mesh = bpy.data.meshes.new(key)
        bm.to_mesh(mesh)
        bm.free()
    o = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(o)
    o.location = loc
    o.data = (
        mesh.copy()
        if len(mesh.materials) and mesh.materials[0] != M[material]
        else mesh
    )
    if not len(o.data.materials):
        o.data.materials.append(M[material])
    return link(o, parent)


def pbox(name, u, v, w, d, h, z=0, material="ivory", parent=None, bevel=0.025):
    x, y = xy(u, v)
    return box(name, (x, y, z + h / 2), (w * S, d * S, h), material, bevel, parent)


def cylinder(
    name, loc, r, depth, material="silver", parent=None, rotation=None, vertices=24
):
    key = "cyl_" + str((r, depth, vertices, material))
    mesh = bpy.data.meshes.get(key)
    if not mesh:
        import bmesh

        bm = bmesh.new()
        bmesh.ops.create_cone(
            bm,
            cap_ends=True,
            cap_tris=False,
            segments=vertices,
            radius1=r,
            radius2=r,
            depth=depth,
        )
        mesh = bpy.data.meshes.new(key)
        bm.to_mesh(mesh)
        bm.free()
        mesh.materials.append(M[material])
        for p in mesh.polygons:
            p.use_smooth = len(p.vertices) == 4
    o = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(o)
    o.location = loc
    if rotation:
        o.rotation_euler = rotation
    return link(o, parent)


def rod(name, a, b, r=0.025, material="silver", parent=None):
    a, b = Vector(a), Vector(b)
    o = cylinder(name, (a + b) / 2, r, (b - a).length, material, parent)
    o.rotation_euler = (b - a).to_track_quat("Z", "Y").to_euler()
    return o


def text(
    name, string, loc, size=0.16, material="ivory", rotation=(0, 0, 0), parent=None
):
    c = bpy.data.curves.new(name, "FONT")
    c.body = string
    c.size = size
    c.align_x = "CENTER"
    c.extrude = 0.0008
    c.bevel_depth = 0.0004
    o = bpy.data.objects.new(name, c)
    bpy.context.scene.collection.objects.link(o)
    o.location = loc
    o.rotation_euler = rotation
    c.materials.append(M[material])
    link(o, parent)
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.convert(target="MESH")
    return o


def label(string, u, v, size=0.14):
    x, y = xy(u, v)
    return text(
        "LABEL_" + string, string, (x, y, 0.015), size, "dark", parent="SIGNAGE"
    )


def wall(name, u1, v1, u2, v2, height=1.12):
    x1, y1 = xy(u1, v1)
    x2, y2 = xy(u2, v2)
    ln = math.hypot(x2 - x1, y2 - y1)
    o = box(
        name,
        ((x1 + x2) / 2, (y1 + y2) / 2, height / 2),
        (ln, 0.15, height),
        "ivory",
        0.025,
        "WALLS",
    )
    o.rotation_euler.z = math.atan2(y2 - y1, x2 - x1)
    for z, h, m in [
        (0.055, 0.11, "dark"),
        (0.88, 0.045, "orange"),
        (height - 0.025, 0.05, "silver"),
    ]:
        q = box(
            name + "_trim",
            ((x1 + x2) / 2, (y1 + y2) / 2, z),
            (ln, 0.175, h),
            m,
            0.008,
            "WALLS",
        )
        q.rotation_euler.z = o.rotation_euler.z
    return o


def light(name, kind, loc, energy, color=(1, 0.87, 0.72), size=5):
    d = bpy.data.lights.new(name, kind)
    d.energy = energy
    d.color = color
    if kind == "POINT":
        d.shadow_soft_size = size
    o = bpy.data.objects.new(name, d)
    bpy.context.scene.collection.objects.link(o)
    o.location = loc
    return o


def camera(name, loc, target, ortho):
    d = bpy.data.cameras.new(name)
    d.type = "ORTHO"
    d.ortho_scale = ortho
    o = bpy.data.objects.new(name, d)
    bpy.context.scene.collection.objects.link(o)
    o.location = loc
    o.rotation_euler = (Vector(target) - o.location).to_track_quat("-Z", "Y").to_euler()
    return o


# Floor-plan shell and presentation.

bpy.context.scene.unit_settings.system = "METRIC"
pbox("Foundation", 573, 372.5, 1090, 510, 0.22, -0.27, "dark", "STRUCTURE", 0.08)
pbox("Interior floor", 573, 372.5, 1070, 487, 0.08, -0.08, "floor", "STRUCTURE", 0.02)
# Every wall endpoint follows the supplied floor plan. Openings remain physically open.
segments = [
    (40, 130, 1105, 130),
    (40, 130, 40, 613),
    (40, 613, 256, 613),
    (322, 613, 898, 613),
    (950, 613, 1105, 613),
    (1105, 130, 1105, 173),
    (1105, 233, 1105, 385),
    (1105, 474, 1105, 613),
    (40, 251, 251, 251),
    (40, 370, 251, 370),
    (40, 490, 251, 490),
    (251, 130, 251, 201),
    (251, 263, 251, 319),
    (251, 378, 251, 432),
    (251, 497, 251, 542),
    (325, 225, 325, 344),
    (325, 398, 325, 520),
    (325, 575, 325, 613),
    (440, 225, 440, 519),
    (325, 281, 440, 281),
    (325, 343, 440, 343),
    (325, 398, 440, 398),
    (325, 482, 440, 482),
    (682, 130, 682, 331),
    (682, 331, 733, 331),
    (682, 257, 745, 257),
    (848, 257, 954, 257),
    (900, 130, 900, 244),
    (900, 234, 952, 234),
    (1010, 234, 1105, 234),
    (958, 130, 958, 189),
    (1010, 130, 1010, 189),
    (1060, 130, 1060, 189),
    (682, 411, 682, 613),
    (682, 411, 733, 411),
    (682, 490, 785, 490),
    (848, 490, 945, 490),
    (1008, 490, 1105, 490),
    (848, 490, 848, 613),
]
for i, s in enumerate(segments):
    wall("Partition_%02d" % i, *s)
# Paving joints physically inset rather than overlaid noise.
for u in range(55, 1100, 40):
    pbox("Floor joint X", u, 373, 1, 474, 0.002, 0, "dark", "FLOOR_JOINTS", 0)
for v in range(150, 613, 40):
    pbox("Floor joint Y", 572, v, 1054, 1, 0.002, 0, "dark", "FLOOR_JOINTS", 0)
# Zone inserts, fine seam around every slab.
for n, u, v, w, d, m in [
    ("Crew", 143, 373, 204, 474, "cushion"),
    ("GrowN", 383, 204, 100, 128, "teal"),
    ("GrowS", 383, 566, 100, 75, "teal"),
    ("Lounge", 565, 293, 195, 282, "floor"),
    ("Fitness", 792, 194, 192, 105, "cushion"),
    ("Clinic", 979, 550, 239, 105, "linen"),
    ("Engineering", 768, 551, 143, 103, "cushion"),
]:
    pbox("Zone_" + n, u, v, w, d, 0.006, 0.002, m, "FLOORS", 0.02)
scene = bpy.context.scene
scene.world = bpy.data.worlds.new("Warm neutral studio")
scene.world.use_nodes = True
scene.world.node_tree.nodes["Background"].inputs[0].default_value = (0.34, 0.3, 0.27, 1)
scene.world.node_tree.nodes["Background"].inputs[1].default_value = 0.45
sun = light("LGT_key", "SUN", (0, 0, 14), 3)
sun.rotation_euler = (0.35, -0.5, -0.4)
sun.data.angle = 0.2
light("LGT_fill", "POINT", (0, -7, 13), 1700, (0.73, 0.84, 1), 7)
scene.camera = camera("CAM_cutaway", (4, -12, 20), (0, 0, 0), 23)
camera("CAM_plan", (0, 0, 26), (0, 0, 0), 21)
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 1400
scene.render.resolution_y = 900
scene.render.resolution_percentage = 65
scene.view_settings.view_transform = "AgX"


# Furnishings, fitted equipment and room labels.


def chair(u, v, parent, flip=False):
    x, y = xy(u, v)
    sg = -1 if flip else 1
    box("Chair seat", (x, y, 0.46), (0.48, 0.46, 0.12), "cushion", 0.07, parent)
    box(
        "Chair back",
        (x, y + sg * 0.19, 0.78),
        (0.48, 0.08, 0.55),
        "cushion",
        0.07,
        parent,
    )
    cylinder("Chair pedestal", (x, y, 0.23), 0.035, 0.42, "silver", parent)
    for a in range(5):
        ang = a * math.tau / 5
        rod(
            "Chair foot",
            (x, y, 0.11),
            (x + 0.27 * math.cos(ang), y + 0.27 * math.sin(ang), 0.07),
            0.018,
            "dark",
            parent,
        )


def desk(u, v, w, d, parent, h=0.76):
    x, y = xy(u, v)
    box("Desk surface", (x, y, h), (w * S, d * S, 0.07), "ivory", 0.045, parent)
    for dx in [-w * S * 0.4, w * S * 0.4]:
        box(
            "Desk leg",
            (x + dx, y, h / 2),
            (0.06, d * S * 0.7, h - 0.04),
            "dark",
            0.015,
            parent,
        )
    box(
        "Desk orange edge",
        (x, y - d * S / 2, h - 0.02),
        (w * S, 0.018, 0.035),
        "orange",
        0.005,
        parent,
    )


def screen(u, v, parent, flip=False):
    x, y = xy(u, v)
    a = math.pi if flip else 0
    o = box("Display housing", (x, y, 1.02), (0.53, 0.055, 0.34), "dark", 0.025, parent)
    o.rotation_euler.z = a
    box(
        "Display active glass",
        (x, y + (0.031 if flip else -0.031), 1.02),
        (0.48, 0.008, 0.285),
        "screen",
        0.01,
        parent,
    )
    rod("Display stand", (x, y, 0.8), (x, y, 0.94), 0.023, "silver", parent)
    box("Display base", (x, y, 0.8), (0.23, 0.16, 0.025), "silver", 0.01, parent)
    for i in range(3):
        box(
            "Telemetry line",
            (x - 0.10, y + (0.038 if flip else -0.038), 1.1 - i * 0.065),
            (0.21 + 0.04 * (i % 2), 0.004, 0.008),
            "cyan",
            0.002,
            parent,
        )
    box("Keyboard", (x, y - 0.23, 0.813), (0.45, 0.16, 0.025), "dark", 0.01, parent)
    for i in range(9):
        for j in range(3):
            box(
                "Key",
                (x - 0.185 + i * 0.046, y - 0.28 + j * 0.045, 0.83),
                (0.035, 0.029, 0.008),
                "silver",
                0.002,
                parent,
            )


def cabinet(u, v, w, d, parent, h=0.85):
    pbox("Cabinet shell", u, v, w, d, h, 0, "ivory", parent, 0.04)
    pbox("Counter", u, v, w + 2, d + 2, 0.06, h, "dark", parent, 0.02)
    for du in [-w * 0.25, w * 0.25]:
        pbox(
            "Cabinet panel",
            u + du,
            v + d / 2 + 0.25,
            w / 2 - 2,
            1.2,
            h - 0.13,
            0.07,
            "ivory",
            parent,
            0.01,
        )
        pbox(
            "Pull",
            u + du,
            v + d / 2 + 1.2,
            11,
            1.4,
            0.02,
            h - 0.12,
            "silver",
            parent,
            0.004,
        )


def bed(u, v, parent, flip=False):
    x, y = xy(u, v)
    box("Bed plinth", (x, y, 0.18), (1.94, 0.94, 0.30), "dark", 0.07, parent)
    box("Bed edge", (x, y, 0.32), (2.04, 1.02, 0.09), "ivory", 0.035, parent)
    box("Mattress", (x, y, 0.45), (1.97, 0.95, 0.21), "linen", 0.085, parent)
    box(
        "Headboard",
        (x + (0.96 if not flip else -0.96), y, 0.62),
        (0.08, 1.05, 0.65),
        "ivory",
        0.05,
        parent,
    )
    box(
        "Duvet",
        (x - 0.23 if not flip else x + 0.23, y, 0.57),
        (1.36, 0.97, 0.075),
        "cushion",
        0.045,
        parent,
    )
    for i in range(7):
        box(
            "Quilt seam",
            (x - 0.7 + i * 0.17, y, 0.612),
            (0.012, 0.83, 0.003),
            "silver",
            0.001,
            parent,
        )
    for dy in [-0.24, 0.24]:
        box(
            "Pillow",
            (x + (0.67 if not flip else -0.67), y + dy, 0.615),
            (0.43, 0.39, 0.15),
            "linen",
            0.07,
            parent,
        )
    box(
        "Bed amber foot trim",
        (x - 0.99, y, 0.29),
        (0.02, 0.86, 0.055),
        "orange",
        0.005,
        parent,
    )


# Four rooms with their individual desk arrangements.
for i, (v, bv) in enumerate([(188, 171), (309, 288), (429, 454), (549, 571)]):
    p = "ROOM_CREW_%02d" % (i + 1)
    bed(188, bv, p)
    desk(85, v - 24, 75, 31, p)
    screen(85, v - 30, p)
    chair(85, v + 3, p)
    pbox("Personal locker", 230, v + 37, 22, 24, 0.86, 0, "ivory", p)
    pbox("Locker pull", 230, v + 50, 8, 1, 0.04, 0.66, "silver", p)
    label("CREW 0%d" % (i + 1), 153, v + 43, 0.125)
# Tiered hydroponics at exact north and south crop locations.
for v in [152, 594]:
    p = "ROOM_HYDROPONICS"
    for u in [353, 405]:
        for level in [0.30, 0.82, 1.34]:
            pbox("Growth tray", u, v, 43, 23, 0.08, level, "ivory", p)
            pbox("Substrate", u, v, 39, 19, 0.015, level + 0.08, "soil", p, 0)
            for du in [-12, 0, 12]:
                for dv in [-5, 5]:
                    x, y = xy(u + du, v + dv)
                    cylinder(
                        "Irrigation collar",
                        (x, y, level + 0.10),
                        0.025,
                        0.035,
                        "dark",
                        p,
                        vertices=12,
                    )
                    for j in range(5):
                        angle = j * math.tau / 5 + random.random() * 0.4
                        length = 0.09 + random.random() * 0.05
                        verts = [
                            (0, 0, 0),
                            (length * 0.4, -0.035, 0.05),
                            (length, 0, 0.10),
                            (length * 0.4, 0.035, 0.05),
                            (length * 0.45, 0, 0.08),
                        ]
                        verts = [
                            (
                                x + vx * math.cos(angle) - vy * math.sin(angle),
                                y + vx * math.sin(angle) + vy * math.cos(angle),
                                level + 0.11 + vz,
                            )
                            for vx, vy, vz in verts
                        ]
                        me = bpy.data.meshes.new("Leaf")
                        me.from_pydata(
                            verts, [], [(0, 1, 4), (1, 2, 4), (2, 3, 4), (3, 0, 4)]
                        )
                        me.materials.append(M["leaflight" if j % 2 else "leaf"])
                        ob = bpy.data.objects.new("Lettuce leaf", me)
                        bpy.context.scene.collection.objects.link(ob)
                        link(ob, p)
            pbox("Grow lamp", u, v, 40, 5, 0.025, level + 0.40, "light", p, 0.005)
        for du in [-21, 21]:
            pbox("Rack upright", u + du, v, 2, 24, 1.86, 0, "silver", p, 0.005)
    for u in [331, 429]:
        x, y = xy(u, v)
        rod("Nutrient feed", (x, y, 0.1), (x, y, 1.8), 0.025, "teal", p)
# Laundry pair.
for u in [352, 407]:
    p = "ROOM_HYGIENE_CORE"
    pbox("Washer", u, 250, 42, 42, 0.83, 0, "ivory", p)
    x, y = xy(u, 272)
    cylinder("Washer rim", (x, y, 0.43), 0.22, 0.035, "silver", p, (math.pi / 2, 0, 0))
    cylinder(
        "Washer glazing",
        (x, y - 0.025, 0.43),
        0.173,
        0.036,
        "glass",
        p,
        (math.pi / 2, 0, 0),
    )
    pbox("Controls", u, 271, 30, 1, 0.09, 0.68, "dark", p)


def sink(u, v, parent):
    x, y = xy(u, v)
    box("Vanity", (x, y, 0.40), (0.48, 0.40, 0.8), "ivory", 0.025, parent)
    cylinder("Basin dark inset", (x, y, 0.81), 0.175, 0.018, "dark", parent)
    bpy.ops.mesh.primitive_torus_add(
        major_radius=0.17,
        minor_radius=0.026,
        major_segments=32,
        minor_segments=10,
        location=(x, y, 0.827),
    )
    o = bpy.context.object
    o.name = "Basin lip"
    o.data.materials.append(M["ivory"])
    link(o, parent)
    rod("Faucet", (x, y + 0.14, 0.82), (x, y + 0.14, 1.04), 0.017, "silver", parent)
    rod("Spout", (x, y + 0.14, 1.04), (x, y, 1.04), 0.017, "silver", parent)


def toilet(u, v, parent):
    x, y = xy(u, v)
    o = cylinder("WC pedestal", (x, y, 0.18), 0.16, 0.36, "ivory", parent)
    o.scale.y = 1.3
    o = cylinder("WC bowl", (x, y, 0.37), 0.23, 0.12, "ivory", parent)
    o.scale.y = 1.35
    o = cylinder("WC interior", (x, y, 0.433), 0.16, 0.012, "dark", parent)
    o.scale.y = 1.35
    bpy.ops.mesh.primitive_torus_add(
        major_radius=0.196,
        minor_radius=0.027,
        major_segments=36,
        minor_segments=10,
        location=(x, y, 0.45),
    )
    o = bpy.context.object
    o.scale.y = 1.35
    o.name = "WC seat"
    o.data.materials.append(M["ivory"])
    link(o, parent)
    box("WC cistern", (x, y + 0.25, 0.57), (0.41, 0.17, 0.42), "ivory", 0.035, parent)


def shower(u, v, parent):
    x, y = xy(u, v)
    pbox("Shower tray", u, v, 45, 46, 0.06, 0, "ivory", parent)
    cylinder("Drain", (x, y, 0.065), 0.065, 0.008, "silver", parent)
    for a in [-0.25, 0, 0.25]:
        box("Shower grate", (x + a, y, 0.071), (0.008, 0.55, 0.003), "dark", 0, parent)
    rod(
        "Shower riser",
        (x + 0.3, y + 0.27, 0.4),
        (x + 0.3, y + 0.27, 1.97),
        0.02,
        "silver",
        parent,
    )
    rod(
        "Shower head neck",
        (x + 0.3, y + 0.27, 1.97),
        (x + 0.3, y, 1.97),
        0.02,
        "silver",
        parent,
    )
    cylinder("Shower head", (x + 0.3, y, 1.96), 0.095, 0.035, "silver", parent)


sink(420, 373, "ROOM_HYGIENE_CORE")
sink(459, 373, "ROOM_HYGIENE_CORE")
sink(339, 310, "ROOM_HYGIENE_CORE")
toilet(408, 312, "ROOM_HYGIENE_CORE")
shower(410, 440, "ROOM_HYGIENE_CORE")
shower(931, 169, "ROOM_HYGIENE_EAST")
sink(982, 161, "ROOM_HYGIENE_EAST")
toilet(1035, 165, "ROOM_HYGIENE_EAST")
# Lounge: articulated soft upholstery, rounded legs and tables.
p = "ROOM_RECREATION"
for u in [550]:
    pbox("Sofa frame", u, 269, 31, 81, 0.22, 0.12, "dark", p)
    pbox("Sofa back", u - 15, 269, 8, 84, 0.62, 0.26, "cushion", p)
    for v in [243, 269, 295]:
        pbox("Seat cushion", u + 2, v, 30, 24, 0.19, 0.30, "cushion", p, 0.065)
    for v in [225, 312]:
        pbox("Arm rest", u, v, 36, 8, 0.40, 0.22, "ivory", p)
for v in [193, 319]:
    pbox("Lounge chair base", 625, v, 30, 31, 0.18, 0.18, "dark", p)
    pbox("Lounge cushion", 625, v, 32, 31, 0.16, 0.36, "cushion", p, 0.06)
    pbox("Lounge back", 625, v - 15, 33, 7, 0.42, 0.42, "ivory", p, 0.05)
pbox("Coffee table", 609, 261, 33, 47, 0.07, 0.44, "ivory", p, 0.05)
for u, v in [(602, 251), (614, 271)]:
    x, y = xy(u, v)
    cylinder("Cup", (x, y, 0.57), 0.05, 0.14, "teal", p)
x, y = xy(670, 260)
box("Entertainment screen housing", (x, y, 1.53), (0.07, 1.22, 0.72), "dark", 0.035, p)
box("Entertainment glass", (x - 0.045, y, 1.53), (0.008, 1.13, 0.63), "screen", 0.01, p)
for dy in [-0.3, 0, 0.3]:
    box(
        "Entertainment telemetry",
        (x - 0.052, y + dy, 1.53),
        (0.004, 0.19, 0.014),
        "cyan",
        0.003,
        p,
    )
# Kitchen, dining and supplies.
p = "ROOM_KITCHEN"
for u in [490, 545, 600, 649]:
    cabinet(u, 590, 47, 30, p)
cabinet(461, 487, 25, 110, p)
sink(461, 431, p)
desk(590, 497, 99, 52, p)
for u in [566, 615]:
    chair(u, 456, p)
    chair(u, 536, p, True)
for u in [575, 608]:
    x, y = xy(u, 497)
    cylinder("Plate", (x, y, 0.811), 0.13, 0.012, "linen", p)
    cylinder("Mug", (x + 0.18, y, 0.86), 0.045, 0.11, "orange", p)
# Central work table, four terminals.
p = "ROOM_WORKROOM"
desk(927, 375, 263, 35, p)
for u, v, flip in [
    (846, 370, False),
    (952, 370, False),
    (900, 382, True),
    (1008, 382, True),
]:
    screen(u, v, p, flip)
    chair(u, v + (29 if not flip else -29), p, not flip)
# Printer with visible gantry and fabrication part.
p = "ROOM_FABRICATION"
cabinet(730, 295, 49, 45, p, 0.75)
for du in [-20, 20]:
    for dv in [-18, 18]:
        pbox("Printer upright", 730 + du, 295 + dv, 2, 2, 0.65, 0.8, "dark", p, 0.005)
pbox("Printer top", 730, 295, 45, 42, 0.055, 1.43, "orange", p)
pbox("Print bed", 730, 295, 37, 34, 0.035, 0.87, "silver", p)
x, y = xy(730, 295)
cylinder("Printed sample", (x, y, 1.01), 0.12, 0.22, "ivory", p)
rod("Printer gantry", (x - 0.32, y, 1.24), (x + 0.32, y, 1.24), 0.02, "silver", p)
# Robotics bench: two consoles and articulated manipulator.
p = "ROOM_ROBOTICS"
desk(767, 582, 144, 32, p)
for u in [735, 807]:
    screen(u, 585, p, True)
    chair(u, 551, p, True)
x, y = xy(780, 520)
cylinder("Robot arm base", (x, y, 0.23), 0.18, 0.46, "dark", p)
points = [(x, y, 0.46), (x, y, 0.78), (x + 0.35, y, 0.98), (x + 0.49, y - 0.1, 0.75)]
for a, b in zip(points, points[1:]):
    rod("Manipulator link", a, b, 0.055, "orange", p)
for q in points[1:]:
    cylinder("Manipulator joint", q, 0.09, 0.13, "silver", p, (math.pi / 2, 0, 0))
for dx in [-0.045, 0.045]:
    rod(
        "Gripper",
        (points[-1][0] + dx, points[-1][1], 0.75),
        (points[-1][0] + dx, points[-1][1], 0.64),
        0.014,
        "dark",
        p,
    )
# Treatment room.
p = "ROOM_TREATMENT"
bed(1041, 554, p)
cabinet(875, 550, 29, 91, p, 0.80)
screen(886, 515, p)
pbox("Medical trolley", 985, 585, 28, 22, 0.65, 0, "ivory", p)
for u in [978, 991]:
    x, y = xy(u, 584)
    cylinder("Medical canister", (x, y, 0.76), 0.045, 0.20, "teal", p)
# Fitness machines with rails, pedals, saddle and flywheel.
p = "ROOM_FITNESS"
x, y = xy(786, 164)
box("Rower rail", (x, y, 0.18), (1.7, 0.12, 0.12), "silver", 0.025, p)
box("Rower seat", (x - 0.35, y, 0.35), (0.30, 0.34, 0.13), "cushion", 0.06, p)
cylinder(
    "Rower flywheel", (x + 0.65, y, 0.46), 0.28, 0.26, "dark", p, (math.pi / 2, 0, 0)
)
cylinder(
    "Flywheel hub",
    (x + 0.65, y - 0.14, 0.46),
    0.14,
    0.012,
    "orange",
    p,
    (math.pi / 2, 0, 0),
)
rod("Rower handle stem", (x + 0.6, y, 0.57), (x + 0.38, y, 0.8), 0.024, "silver", p)
rod(
    "Rower handle",
    (x + 0.38, y - 0.19, 0.8),
    (x + 0.38, y + 0.19, 0.8),
    0.025,
    "dark",
    p,
)
for dx in [-0.65, 0.65]:
    rod(
        "Rower foot",
        (x + dx, y - 0.27, 0.06),
        (x + dx, y + 0.27, 0.06),
        0.04,
        "dark",
        p,
    )
x, y = xy(733, 223)
for a, b in [
    ((x - 0.35, y, 0.1), (x, y, 0.63)),
    ((x, y, 0.63), (x + 0.35, y, 0.1)),
    ((x - 0.35, y, 0.1), (x + 0.35, y, 0.1)),
    ((x, y, 0.63), (x + 0.18, y, 0.95)),
]:
    rod("Cycle frame", a, b, 0.04, "ivory", p)
cylinder(
    "Cycle flywheel", (x + 0.20, y, 0.33), 0.23, 0.14, "dark", p, (math.pi / 2, 0, 0)
)
box("Cycle saddle", (x - 0.12, y, 0.74), (0.25, 0.22, 0.07), "cushion", 0.04, p)
rod(
    "Cycle handlebar",
    (x + 0.18, y - 0.22, 0.95),
    (x + 0.18, y + 0.22, 0.95),
    0.025,
    "dark",
    p,
)
rod("Crank axle", (x, y - 0.22, 0.30), (x, y + 0.22, 0.30), 0.025, "silver", p)
for sign in [-1, 1]:
    box(
        "Pedal",
        (x + 0.11 * sign, y + 0.23 * sign, 0.3),
        (0.18, 0.10, 0.035),
        "dark",
        0.01,
        p,
    )
# Storage banks and room wayfinding.
for u, v, w, d in [
    (546, 146, 185, 23),
    (867, 159, 34, 41),
    (875, 232, 34, 34),
    (710, 445, 29, 61),
    (1083, 155, 26, 30),
]:
    cabinet(u, v, w, d, "STORAGE", 0.94)
for caption, u, v in [
    ("CROP LAB", 380, 195),
    ("CROP LAB", 382, 552),
    ("RECREATION", 574, 349),
    ("GALLEY", 571, 558),
    ("FITNESS", 807, 231),
    ("OPERATIONS", 940, 325),
    ("ROBOTICS", 768, 512),
    ("MEDICAL", 977, 514),
    ("HYGIENE", 984, 218),
]:
    label(caption, u, v, 0.12)
# Recessed service panels, vents and perimeter ribs.
for u in range(65, 1100, 56):
    for v in [130, 613]:
        pbox("Shell rib", u, v, 2.7, 13, 1.11, 0, "ivory", "WALLS", 0.012)
for u, v in [(460, 154), (653, 590), (1088, 280), (80, 600)]:
    pbox("Service panel", u, v, 28, 2, 0.55, 0.35, "dark", "HARDWARE")
    for j in range(7):
        pbox(
            "Louver",
            u,
            v - 1,
            23,
            1,
            0.018,
            0.41 + j * 0.055,
            "silver",
            "HARDWARE",
            0.004,
        )
# Open entry portals keep circulation clear; whole lintels sit at inferred full elevation.
for u, v, width, orient in [(288, 613, 60, 0), (1105, 430, 85, 1), (924, 613, 50, 0)]:
    x, y = xy(u, v)
    span = width * S
    for sg in [-1, 1]:
        dx = sg * span / 2 if not orient else 0
        dy = sg * span / 2 if orient else 0
        box(
            "Airlock jamb",
            (x + dx, y + dy, 1.25),
            (0.14, 0.18, 2.5),
            "dark",
            0.03,
            "ENTRIES",
        )
        box(
            "Door status strip",
            (x + dx, y + dy - 0.10, 1.4),
            (0.035, 0.015, 0.72),
            "cyan",
            0.004,
            "ENTRIES",
        )
    b = box(
        "Airlock lintel",
        (x, y, 2.48),
        (span + 0.14, 0.19, 0.16),
        "orange",
        0.03,
        "ENTRIES",
    )
    if orient:
        b.rotation_euler.z = math.pi / 2
    pbox(
        "Entry threshold",
        u,
        v,
        75 if not orient else 15,
        15 if not orient else 95,
        0.04,
        0,
        "silver",
        "ENTRIES",
    )
label("TARUKH / MARS DUNE OUTPOST", 568, 384, 0.23)
scene = bpy.context.scene
scene.render.resolution_percentage = 100


# Verified doorway clearances, operator positions and finish details.

# Restore clear room access before creating full-height walls.
for index in [13, 14, 15, 16]:
    prefix = "Partition_%02d" % index
    for o in list(bpy.data.objects):
        if o.name == prefix or o.name.startswith(prefix + "_trim"):
            bpy.data.objects.remove(o, do_unlink=True)
wall("Partition_13", 251, 430, 251, 490)
wall("Partition_14", 251, 554, 251, 613)
wall("Partition_15", 325, 225, 325, 284)
wall("Partition_15b", 325, 337, 325, 344)
wall("Partition_16", 325, 451, 325, 520)
# Shift the WC hand basin away from the open doorway.
sx, sy = xy(339, 310)
tx, ty = xy(360, 296)
for o in bpy.data.objects:
    if (
        o.parent
        and o.parent.name == "ROOM_HYGIENE_CORE"
        and o.name.startswith(("Vanity", "Basin", "Faucet", "Spout"))
        and abs(o.location.x - sx) < 0.3
        and abs(o.location.y - sy) < 0.3
    ):
        o.location.x += tx - sx
        o.location.y += ty - sy
# Correct the seating direction in private quarters.
for o in bpy.data.objects:
    if (
        o.parent
        and o.parent.name.startswith("ROOM_CREW_")
        and o.name.startswith("Chair back")
    ):
        o.location.y -= 0.38
# Put each keyboard on the operator's side of its screen.
for u, v, p in [
    (900, 382, "ROOM_WORKROOM"),
    (1008, 382, "ROOM_WORKROOM"),
    (735, 585, "ROOM_ROBOTICS"),
    (807, 585, "ROOM_ROBOTICS"),
]:
    x, y = xy(u, v)
    for o in bpy.data.objects:
        if (
            o.parent
            and o.parent.name == p
            and o.name.startswith(("Keyboard", "Key"))
            and abs(o.location.x - x) < 0.24
            and -0.34 < o.location.y - y < -0.12
        ):
            o.location.y = 2 * y - o.location.y
# Fine floor joints rather than oversized dark grid lines.
for o in bpy.data.objects:
    if o.name.startswith("Floor joint X"):
        o.scale.x = 0.28
    if o.name.startswith("Floor joint Y"):
        o.scale.y = 0.28
    if o.name == "LABEL_TARUKH / MARS DUNE OUTPOST":
        o.scale *= 0.62
# Door trim and clear passages; headers will remain overhead in the full version.
for v in [310.5, 424.5]:
    x, y = xy(325, v)
    for dy in [-0.47, 0.47]:
        box(
            "Wet-room jamb",
            (x, y + dy, 0.56),
            (0.19, 0.045, 1.12),
            "teal",
            0.008,
            "WALLS",
        )
    for dy in [-0.40, 0.40]:
        box(
            "Wet-room floor marker",
            (x - 0.12, y + dy, 0.014),
            (0.18, 0.05, 0.006),
            "orange",
            0.002,
            "SIGNAGE",
        )
for u, v, w, ori in [(288, 613, 60, 0), (1105, 430, 85, 1), (924, 613, 50, 0)]:
    x, y = xy(u, v)
    if ori == 0:
        box(
            "Entry step",
            (x, y - 0.34, -0.11),
            (w * S + 0.15, 0.65, 0.16),
            "silver",
            0.035,
            "STRUCTURE",
        )
        for dx in [-w * S * 0.37, w * S * 0.37]:
            rod(
                "Entry rail",
                (x + dx, y - 0.02, 0.02),
                (x + dx, y - 0.5, 0.02),
                0.025,
                "dark",
                "STRUCTURE",
            )
    else:
        box(
            "Entry step",
            (x + 0.34, y, -0.11),
            (0.65, w * S + 0.15, 0.16),
            "silver",
            0.035,
            "STRUCTURE",
        )
# Utility access covers, recessed seams and fasteners.
for u in [80, 165, 370, 480, 590, 700, 810, 1000, 1070]:
    x, y = xy(u, 615)
    box(
        "External access panel",
        (x, y, 0.52),
        (0.64, 0.025, 0.59),
        "ivory",
        0.025,
        "EXTERIOR_DETAILS",
    )
    box(
        "Access inset",
        (x, y - 0.018, 0.52),
        (0.53, 0.012, 0.43),
        "dark",
        0.015,
        "EXTERIOR_DETAILS",
    )
    for a in [-0.23, 0.23]:
        for b in [-0.18, 0.18]:
            cylinder(
                "Quarter turn fastener",
                (x + a, y - 0.029, 0.52 + b),
                0.011,
                0.01,
                "silver",
                "EXTERIOR_DETAILS",
                (math.pi / 2, 0, 0),
                12,
            )
    box(
        "Panel grip",
        (x, y - 0.034, 0.66),
        (0.18, 0.025, 0.018),
        "silver",
        0.005,
        "EXTERIOR_DETAILS",
    )
# A local service display at the main entry.
x, y = xy(1088, 380)
box(
    "Entry control housing",
    (x + 0.04, y, 1.4),
    (0.08, 0.26, 0.42),
    "dark",
    0.02,
    "EXTERIOR_DETAILS",
)
box(
    "Entry control glass",
    (x + 0.086, y, 1.4),
    (0.008, 0.22, 0.34),
    "screen",
    0.005,
    "EXTERIOR_DETAILS",
)
# Scene metadata travels with both review variants.
s = bpy.context.scene
s["asset_title"] = "TARUKH Mars Dune Outpost - review asset"
s["source"] = (
    "User-supplied Mars Dune Alpha floor-plan reference; elevations and furnishings interpreted for TARUKH."
)
s["nominal_footprint_m"] = [18.46, 8.51]
s["purpose"] = "Separate review model; not integrated into gameplay"
s.world.node_tree.nodes["Background"].inputs[1].default_value = 0.6
bpy.data.objects["LGT_fill"].data.energy = 2400
s.render.resolution_x = 1600
s.render.resolution_y = 1000
s.render.resolution_percentage = 100
s.camera = bpy.data.objects["CAM_cutaway"]
# Save the construction helpers with the editable Blender source.
bpy.data.texts.new("OUTPOST_FURNISHING_NOTES").write(
    "Furnished plan in metre units. Four crew rooms, two crop racks, hygiene, fitness, recreation, galley, operations, robotics, treatment. Wall tops are intentionally cut to 1.12 m in the review variant."
)


def export_variant(name):
    bpy.ops.export_scene.gltf(
        filepath=str(args.output / (name + ".glb")),
        export_format="GLB",
        export_lights=True,
        export_cameras=True,
        export_extras=True,
        export_texcoords=False,
    )
    bpy.ops.wm.save_as_mainfile(filepath=str(args.output / (name + ".blend")))


export_variant("tarukh-outpost-cutaway")

# Full-height shell and removable roof assembly.

# Full-height variant retains the same room footprint and open doorways.
for o in bpy.data.objects:
    if o.name.startswith("Partition_") and "_trim" not in o.name:
        o.scale.z = 2.7 / 1.12
        o.location.z = 1.35
    elif o.name.startswith("Partition_") and "_trim.002" in o.name:
        o.location.z = 2.675
    elif o.name.startswith("Shell rib"):
        o.scale.z = 2.7 / max(o.dimensions.z, 0.001)
        o.location.z = 1.35
    elif o.name.startswith("Wet-room jamb"):
        o.scale.z = 2.25 / 1.12
        o.location.z = 1.125
# Structural headers above internal openings.
for u, v, w, axis in [
    (251, 227, 52, 1),
    (251, 348.5, 59, 1),
    (251, 405, 50, 1),
    (251, 525.5, 57, 1),
    (325, 310.5, 53, 1),
    (325, 424.5, 53, 1),
    (682, 371, 80, 1),
    (798, 257, 106, 0),
    (976.5, 490, 63, 0),
]:
    x, y = xy(u, v)
    dims = (0.17, w * S, 0.45) if axis else (w * S, 0.17, 0.45)
    box("Door header", (x, y, 2.475), dims, "ivory", 0.02, "WALLS")
# Roof panels share an independently removable parent.
for i in range(6):
    x = (i - 2.5) * 3.08
    box(
        "Roof section %02d" % (i + 1),
        (x, 0, 2.82),
        (3.07, 8.53, 0.24),
        "ivory",
        0.10,
        "ROOF",
    )
    box(
        "Roof expansion seam",
        (x - 1.535, 0, 2.95),
        (0.014, 8.42, 0.014),
        "dark",
        0.003,
        "ROOF",
    )
    for y in [-4.23, 4.23]:
        box(
            "Roof amber edge",
            (x, y, 2.78),
            (3.06, 0.045, 0.10),
            "orange",
            0.012,
            "ROOF",
        )
    for y in [-3.1, -1.55, 0, 1.55, 3.1]:
        box(
            "Roof reinforcement",
            (x, y, 2.96),
            (2.99, 0.065, 0.065),
            "silver",
            0.012,
            "ROOF",
        )
# Low relief printed shell lines on outer faces, not large texture images.
outer = [
    (40, 130, 1105, 130),
    (40, 130, 40, 613),
    (40, 613, 256, 613),
    (322, 613, 898, 613),
    (950, 613, 1105, 613),
    (1105, 130, 1105, 173),
    (1105, 233, 1105, 385),
    (1105, 474, 1105, 613),
]
for u1, v1, u2, v2 in outer:
    x1, y1 = xy(u1, v1)
    x2, y2 = xy(u2, v2)
    ang = math.atan2(y2 - y1, x2 - x1)
    length = math.hypot(x2 - x1, y2 - y1)
    dx, dy = (
        (0, 0.078)
        if v1 == v2 == 130
        else (
            (0, -0.078)
            if v1 == v2 == 613
            else ((-0.078, 0) if u1 == u2 == 40 else (0.078, 0))
        )
    )
    for z in [0.24 + i * 0.12 for i in range(19)]:
        o = box(
            "Printed shell stratum",
            ((x1 + x2) / 2 + dx, (y1 + y2) / 2 + dy, z),
            (length, 0.012, 0.015),
            "ivory",
            0.003,
            "EXTERIOR_DETAILS",
        )
        o.rotation_euler.z = ang
# Exterior lifelines and protected service cable conduits.
for z in [0.35, 0.48]:
    rod(
        "North service conduit",
        (-8.9, 4.24, z),
        (8.9, 4.24, z),
        0.035,
        "silver",
        "EXTERIOR_DETAILS",
    )
    for x in [-8, -5, -2, 1, 4, 7]:
        box(
            "Conduit clip",
            (x, 4.28, z),
            (0.045, 0.04, 0.13),
            "dark",
            0.008,
            "EXTERIOR_DETAILS",
        )
# Three rooftop life-support packs with finned heat exchangers.
for x in [-6.1, 0, 6.1]:
    y = 2.5
    box("HVAC isolation base", (x, y, 3.03), (1.8, 1.2, 0.12), "dark", 0.03, "ROOF")
    box("HVAC enclosure", (x, y, 3.31), (1.65, 1.05, 0.48), "ivory", 0.065, "ROOF")
    for dx in [-0.44, 0.44]:
        cylinder(
            "Fan casing", (x + dx, y, 3.58), 0.31, 0.055, "dark", "ROOF", vertices=32
        )
        cylinder("Fan hub", (x + dx, y, 3.63), 0.07, 0.035, "silver", "ROOF")
        for a in range(6):
            angle = a * math.tau / 6
            o = box(
                "Fan blade",
                (x + dx + 0.15 * math.cos(angle), y + 0.15 * math.sin(angle), 3.615),
                (0.27, 0.07, 0.014),
                "silver",
                0.012,
                "ROOF",
            )
            o.rotation_euler.z = angle + 0.35
    for dx in [i * 0.11 - 0.65 for i in range(13)]:
        box(
            "Heat exchanger fin",
            (x + dx, y - 0.535, 3.31),
            (0.022, 0.035, 0.31),
            "dark",
            0.005,
            "ROOF",
        )
    box(
        "HVAC service stripe",
        (x, y + 0.53, 3.32),
        (1.4, 0.015, 0.06),
        "orange",
        0.004,
        "ROOF",
    )
# Roof service access and communications mast.
box("Roof access curb", (-7.7, -2.8, 3.02), (1.15, 1.35, 0.16), "dark", 0.035, "ROOF")
box("Roof access hatch", (-7.7, -2.8, 3.12), (1.05, 1.25, 0.09), "teal", 0.04, "ROOF")
rod("Hatch handle", (-7.85, -2.8, 3.2), (-7.55, -2.8, 3.2), 0.025, "silver", "ROOF")
cylinder("Comms foot", (7.8, 2.8, 3.03), 0.24, 0.16, "dark", "ROOF")
rod("Comms mast", (7.8, 2.8, 3.06), (7.8, 2.8, 4.2), 0.025, "silver", "ROOF")
for z, w in [(3.72, 0.65), (3.96, 0.42)]:
    rod("Comms antenna", (7.8 - w, 2.8, z), (7.8 + w, 2.8, z), 0.018, "silver", "ROOF")
# Exterior identity, readable without texture downloads.
text("Roof identity", "TARUKH  /  01", (0, -0.8, 2.962), 0.62, "teal", parent="ROOF")
text(
    "Roof small identity",
    "MARS DUNE OUTPOST",
    (0, -1.47, 2.963),
    0.22,
    "dark",
    parent="ROOF",
)
x, y = xy(570, 613)
box(
    "Facade name plaque",
    (x, y - 0.10, 2.1),
    (3.8, 0.045, 0.52),
    "teal",
    0.04,
    "EXTERIOR_DETAILS",
)
text(
    "Facade name",
    "TARUKH / MARS OUTPOST",
    (x, y - 0.13, 1.99),
    0.19,
    "ivory",
    (math.pi / 2, 0, 0),
    "EXTERIOR_DETAILS",
)
# Continuous warm interior light strips are stored under the removable roof.
for x in [-7.4, -3.5, 0, 3.3, 7.2]:
    for y in [-2.2, 2.2]:
        box(
            "Ceiling luminaire", (x, y, 2.67), (1.1, 0.10, 0.04), "light", 0.012, "ROOF"
        )
# The full scene keeps both review cameras; the shell camera frames rooftop details.
s = bpy.context.scene
s.camera = camera("CAM_exterior", (14, -19, 17), (0, 0, 1.3), 24)
s["variant"] = "full-height shell with removable ROOF parent"
s.render.resolution_x = 1400
s.render.resolution_y = 900
s.render.resolution_percentage = 100


# Final exterior doorway and signage details.
# Close shell above door heads and complete the northeast change-room exit.
for u, v, width, orient in [
    (288, 613, 60, 0),
    (1105, 430, 85, 1),
    (924, 613, 50, 0),
    (1105, 203, 60, 1),
]:
    x, y = xy(u, v)
    dims = (
        (width * S + 0.14, 0.19, 0.23) if not orient else (0.19, width * S + 0.14, 0.23)
    )
    box("Outer door head infill", (x, y, 2.595), dims, "ivory", 0.025, "WALLS")
u, v = 1105, 203
x, y = xy(u, v)
for sg in [-1, 1]:
    box(
        "Change exit jamb",
        (x, y + sg * 0.51, 1.125),
        (0.18, 0.10, 2.25),
        "dark",
        0.025,
        "ENTRIES",
    )
    box(
        "Change exit status",
        (x + 0.10, y + sg * 0.51, 1.4),
        (0.014, 0.025, 0.6),
        "cyan",
        0.004,
        "ENTRIES",
    )
box("Change exit lintel", (x, y, 2.3), (0.19, 1.12, 0.14), "orange", 0.025, "ENTRIES")
box(
    "Change exit step",
    (x + 0.29, y, -0.11),
    (0.55, 1.15, 0.16),
    "silver",
    0.03,
    "STRUCTURE",
)
# A single clear roof plate keeps the identity legible across panel seams.
box("Roof identity plate", (0, -1.03, 3.045), (6.3, 1.50, 0.06), "teal", 0.08, "ROOF")
for name in ["Roof identity", "Roof small identity"]:
    o = bpy.data.objects[name]
    o.location.z = 3.079
    o.data = o.data.copy()
    o.data.materials.clear()
    o.data.materials.append(M["ivory"])

export_variant("tarukh-outpost-full")
