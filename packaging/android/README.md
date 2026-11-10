# EffectCraft Android Mobile Port (v0.23.1 Pocket)

This directory contains the complete native Android wrapper, build configuration, and assets for running **EffectCraft v0.23.1** on Android mobile devices and tablets, ported and maintained by **@duplexspy**.

## Architecture & Features

1. **Native Shell (`MainActivity.java` & `EffectCraftServer.java`)**:
   - Hardware-accelerated runtime (`android:hardwareAccelerated="true"` and `View.LAYER_TYPE_HARDWARE`).
   - Built-in multi-threaded embedded HTTP server (`127.0.0.1`) serving WebAssembly and assets with `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` headers to unlock `SharedArrayBuffer` and high-performance Web Workers.
   - Dual-path offline streaming: direct embedded local server with redundant `shouldInterceptRequest` asset streaming fallback.
   - Immersive full-screen sticky mode maximizing editing space.

2. **Chiclet Virtual Laptop Keyboard (`mobile.js`, `mobile.css`)**:
   - Floating draggable toggle button.
   - **Quick VFX Action Bar**:
     - Latching modifier keys (`Ctrl`, `Alt`, `Shift`) with illuminated toggle state.
     - Playback & Pan: Tap `Space` to Play/Pause; **hold `Space` to Pan** the composition viewer with a second touch.
     - Dedicated editing shortcuts: `Undo` (Ctrl+Z), `Redo` (Ctrl+Y), `Del`, `Esc`, `Enter`, `Tab`.
     - Tool selectors: `V` (Select), `H` (Hand), `Z` (Zoom), `T` (Text), `G` (Pen/Mask), `Y` (Pan Behind).
     - Timeline navigation: `◄ J` (Previous Keyframe), `K ►` (Next Keyframe).
     - Nudge cluster: Arrow keys `▲`, `▼`, `◀`, `▶` (hold Shift for 10px nudges).
   - **Full Virtual QWERTY Keyboard**: Slide-up on-screen touch keyboard with numbers, symbols, Backspace, Enter, Esc, and Space.
   - **Native Soft Keyboard (IME) Summoner**: Dedicated text input bar integrating Android system keyboards via `InputMethodManager.showSoftInput`.

3. **DPI & Minimum Width Settings**:
   - Floating Settings dialog (`⚙️`) allowing real-time viewport configuration.
   - **Presets**: Phone (480 dp), Phablet (720 dp), Tablet (960 dp), Desktop HD (1080 dp), Studio Pro (1280 dp), UltraWide (1440 dp).
   - **Continuous Sliders**: Custom Minimum Width from 360 dp to 1920 dp, and UI Scale / Density Zoom from 50% to 200%.
   - Persistent settings saved across launches via `localStorage` and `SharedPreferences`.

4. **100% CPU & GPU Unrestricted Performance**:
   - `setSustainedPerformanceMode(true)` on Android 7.0+ to lock peak CPU and GPU frequencies and prevent thermal downclocking.
   - Window `FLAG_KEEP_SCREEN_ON` and screen WakeLock API to keep processors active during heavy renders.
   - Priority boost via `Process.THREAD_PRIORITY_URGENT_DISPLAY`.
   - `setOffscreenPreRaster(true)` for multi-threaded rasterization across all logical CPU cores (`navigator.hardwareConcurrency`).
   - One-tap Request Battery Optimization Exemption for unrestricted background renders.

## Building

```bash
cd packaging/android
gradle assembleDebug
```

Output:
- Debug APK: `app/build/outputs/apk/debug/app-debug.apk`
