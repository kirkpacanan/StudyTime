# Mixamo Animation Files

Place the following GLB animation files in this directory to enable avatar animations in the 3D library:

| File | Mixamo Animation | Notes |
|------|-----------------|-------|
| `idle.glb` | "Idle" or "Standing Idle" | Character standing still |
| `walk.glb` | "Walking" | Character walking forward |
| `sit.glb` | "Sitting Idle" or "Sitting" | Character seated at desk |

## How to Download

1. Go to [mixamo.com](https://www.mixamo.com)
2. Sign in with a free Adobe account
3. Search for and select each animation listed above
4. Click **Download**
5. In the download dialog:
   - Format: **FBX Binary** or **FBX for Unity**
   - Skin: **Without Skin** (important — this keeps the file small)
6. Convert the `.fbx` files to `.glb` using one of:
   - [Blender](https://www.blender.org): File → Import FBX → Export GLTF/GLB
   - [Online converter](https://products.aspose.app/3d/conversion/fbx-to-glb)
7. Name and place them as `idle.glb`, `walk.glb`, `sit.glb` in this folder

## Without Animations

The app works perfectly without these files. Avatars will remain in their default pose
(no walking/sitting animations). The fallback capsule avatar is shown when an RPM
avatar URL is unavailable.
