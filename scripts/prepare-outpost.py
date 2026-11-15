"""Extract game collision/floor data from the local v9 Blender review.

Run with Blender --background --python-exit-code 1 --python this_file.
The reviewed source is read only. No presentation terrain is exported.
"""
import bpy
import json
import math
from pathlib import Path
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "outputs/outpost-v9/final/tarukh-outpost-full.blend"
DEST = ROOT / "public/models/outpost"
DEST.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
bpy.context.scene.frame_set(1)
bpy.context.view_layer.update()
deps = bpy.context.evaluated_depsgraph_get()
cell = .16
low_x, low_y, high_x, high_y = -30., -16., 28., 30.
cols, rows = math.ceil((high_x-low_x)/cell), math.ceil((high_y-low_y)/cell)
occupied = np.zeros((rows, cols), dtype=bool)
floors, floor_faces = [], []
removed = []
moving = set()
for obj in bpy.context.scene.objects:
    if obj.get("interaction"):
        moving.add(obj)
        moving.update(obj.children_recursive)

def stamp_line(a, b):
    steps = max(1, math.ceil(max(abs(b[0]-a[0]), abs(b[1]-a[1])) / (cell*.35)))
    for t in np.linspace(0, 1, steps+1):
        x, y = a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t
        col, row = math.floor((x-low_x)/cell), math.floor((y-low_y)/cell)
        if 0 <= col < cols and 0 <= row < rows:
            occupied[row, col] = True

for obj in list(bpy.context.scene.objects):
    if obj.name.startswith(("MARS /", "Basalt /")):
        removed.append(obj.name)
        continue
    if obj.type != "MESH" or obj.hide_render or obj in moving:
        continue
    evaluated = obj.evaluated_get(deps)
    mesh = evaluated.to_mesh()
    mesh.calc_loop_triangles()
    coordinates = np.array([evaluated.matrix_world @ v.co for v in mesh.vertices])
    triangles = np.array([t.vertices[:] for t in mesh.loop_triangles], dtype=np.int32)
    if not len(triangles):
        evaluated.to_mesh_clear()
        continue
    points = coordinates[triangles]
    name = obj.name.lower()
    floor_name = any(word in name for word in ("floor", "deck", "steel runner", "threshold", "continuous accessible ramp"))
    if floor_name:
        for tri in points:
            normal = np.cross(tri[1]-tri[0], tri[2]-tri[0])
            if normal[2] > .6*np.linalg.norm(normal) and -.3 < tri[:,2].mean() < .85:
                index = len(floors)
                floors.extend([tuple(v) for v in tri])
                floor_faces.append((index,index+1,index+2))
    # Horizontal cross-sections capture real walls, rails and furnishings.
    # Moving leaves are excluded and receive independent runtime colliders.
    for height in (.95, 1.5, 2.15):
        mask = (points[:,:,2].min(axis=1) < height) & (points[:,:,2].max(axis=1) > height)
        for tri in points[mask]:
            hits = []
            for i in range(3):
                a, b = tri[i], tri[(i+1)%3]
                if (a[2] < height) != (b[2] < height):
                    t = (height-a[2])/(b[2]-a[2])
                    hits.append(a+(b-a)*t)
            if len(hits) == 2:
                stamp_line(hits[0], hits[1])
    evaluated.to_mesh_clear()

# Greedy rectangles preserve the rasterized outline without thousands of
# individual cells in the continuous collision solver.
boxes = []
remaining = occupied.copy()
for row in range(rows):
    col = 0
    while col < cols:
        if not remaining[row,col]:
            col += 1
            continue
        end = col+1
        while end < cols and remaining[row,end]:
            end += 1
        bottom = row+1
        while bottom < rows and remaining[bottom,col:end].all():
            bottom += 1
        remaining[row:bottom,col:end] = False
        boxes.append([round(low_x+(col+end)*cell/2,4), round(-(low_y+(row+bottom)*cell/2),4), round((end-col)*cell/2,4), round((bottom-row)*cell/2,4)])
        col = end

tree = BVHTree.FromPolygons(floors, floor_faces, all_triangles=True)
floor_cell = .25
width, depth = round((high_x-low_x)/floor_cell)+1, round((high_y-low_y)/floor_cell)+1
floor_grid = []
for iz in range(depth):
    y = high_y-iz*floor_cell
    for ix in range(width):
        hit, _, _, _ = tree.ray_cast(Vector((low_x+ix*floor_cell,y,1)), Vector((0,0,-1)), 1.4)
        floor_grid.append(round(hit.z*1000) if hit else -32768)

# RLE is compact for the level decks; millimetre heights retain the ramp.
runs = []
for value in floor_grid:
    if runs and runs[-1][1] == value:
        runs[-1][0] += 1
    else:
        runs.append([1,value])
manifest = json.loads((ROOT / 'outputs/outpost-v9/final/doors.json').read_text())
data = {"version":1,"cell":cell,"boxes":boxes,"floor":{"x":low_x,"z":-high_y,"cell":floor_cell,"width":width,"depth":depth,"runs":runs},"doors":manifest}
(DEST / "layout.json").write_text(json.dumps(data,separators=(',',':')))
(ROOT / 'outputs/outpost-integration/preparation.json').write_text(json.dumps({"source":str(SOURCE),"removedTerrain":removed,"collisionBoxes":len(boxes),"floorTriangles":len(floor_faces),"floorGridSize":[width,depth],"doorCount":len(manifest)},indent=2))
print(json.dumps({"collisionBoxes":len(boxes),"floorTriangles":len(floor_faces),"removedGroundObjects":len(removed),"doors":len(manifest)}), flush=True)
