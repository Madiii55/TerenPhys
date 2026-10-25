# Einstein model

`einstein.glb` is the finished version of the user's `base.obj`, not the earlier
procedural character. It contains the authored 120,000-triangle sculpt, two
embedded 2048px PBR textures, shallow dimensional pupils, eyelids and a head rig.
The source OBJ and reproducible export instructions are in `model-source/einstein/`.

The GLB is self-contained: 1,537,180 bytes, 15 meshes and 134,176 triangles in total.
Meshopt compression and 16-bit position/UV quantization retain the source silhouette.
No external images, buffers, paid services or model-generation APIs are required.
The front faces +Z, the feet stand at Y=0 and the full height is 3.95 units.

The original hands-at-pockets pose is retained. The assistant gently turns its
head and gaze toward highlighted controls, breathes and blinks with actual eyelids.
The `wave` preview mode is a welcoming head nod. Reduced-motion preference freezes
idle movement and blinking. Native eye pivots remain outside quantized mesh nodes.

The site loads this exact GLB through `EinsteinAvatar`; it does not rebuild geometry
on the browser's main thread. Rendering is capped at 30 FPS / 1.5 DPR. Hidden tabs
and inactive avatars stop the animation loop. All geometry, materials, textures,
image bitmaps, shadow maps and observers are released on unmount.

```tsx
<div style={{ width: 128, height: 180 }}>
  <EinsteinAvatar mode="guide" guideDirection="left" active={true} />
</div>
```

The parent owns placement, buttons and accessibility; the transparent canvas is
decorative. The local inspection page is `/tests/fixtures/einstein.html`, with
front / side / back views, portrait framing, still frames and an eyelid check.
Inspection-only props (`viewAngle`, `portrait`, `still`, `sampleTime`) are optional.

Model checks: `node --experimental-strip-types --test tests/einsteinModel.test.ts`.
The source SHA-256, retained source triangle count and finishing measurements are
stored inside the GLB and verified by these checks.
