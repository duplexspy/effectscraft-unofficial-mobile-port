# EffectCraft Android Mobile Port

This directory contains the complete native Android wrapper, build configuration, and assets for running **EffectCraft** on Android mobile devices and tablets.

## Architecture

1. **Native Shell (`MainActivity.java`)**:
   - Immersive full-screen sticky landscape mode (`sensorLandscape`).
   - Hardware-accelerated `WebView` acting as a secure local runtime host.
   - Offline asset streaming via `shouldInterceptRequest` serving bundled WebAssembly and JavaScript assets directly from APK storage without requiring an external internet connection.
   - Low-latency touch-slop gesture handling for the floating virtual keyboard trigger.

2. **Core Engine**:
   - Original pure-Rust engine compiled to `wasm32-unknown-unknown` and optimized for mobile memory constraints.
   - Progressive WebAssembly streaming via `WebAssembly.compileStreaming` with uncompressed `.wasm` storage (`noCompress 'wasm'`) to eliminate on-the-fly decompression memory pressure.

3. **Virtual Laptop Keyboard (`keyboard.js`, `keyboard.css`)**:
   - Draggable floating trigger button.
   - Full virtual laptop chiclet keyboard featuring:
     - Function row (Esc, F1–F12).
     - Standard numbers and symbols.
     - Full QWERTY layout with Caps Lock.
     - Latching and sticky modifier keys (Ctrl, Alt, Shift, Win) supporting shortcuts (`Ctrl+Z`, `Ctrl+S`, `Ctrl+Y`, etc.).
     - Dedicated navigation cluster (Insert, Home, PgUp, Del, End, PgDn, Arrows).
     - Functional dedicated Number Pad (Numpad) with NumLock toggle.
   - Dual-dispatch input engine: broadcasts standard DOM `KeyboardEvent`s and dispatches directly to the egui control bus via `window.effectcraft.request('ui.key')` and `ui.type`.

4. **Mouse & Touch Support**:
   - Preserves all desktop interactions (clicking, dragging, zooming, scrubbing timeline keyframes, text selection).

## Building

```bash
cd packaging/android
/opt/gradle/gradle-8.14.3/bin/gradle assembleRelease bundleRelease
```

Build outputs:
- Release APK: `app/build/outputs/apk/release/app-release.apk`
- App Bundle: `app/build/outputs/bundle/release/app-release.aab`
