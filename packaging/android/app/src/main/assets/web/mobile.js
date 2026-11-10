// EffectCraft Mobile Integration Module
(function () {
  'use strict';

  // State
  const state = {
    minWidth: 1080,
    zoom: 1.0,
    ctrlActive: false,
    shiftActive: false,
    altActive: false,
    metaActive: false,
    vkVisible: true,
    fullVkVisible: false,
    textBarVisible: false,
    modalOpen: false
  };

  // Restore saved DPI settings
  try {
    const savedWidth = localStorage.getItem('ec_mobile_min_width');
    const savedZoom = localStorage.getItem('ec_mobile_zoom');
    if (savedWidth) state.minWidth = parseInt(savedWidth, 10);
    if (savedZoom) state.zoom = parseFloat(savedZoom);
    if (window.AndroidBridge) {
      if (window.AndroidBridge.getSavedMinWidth) state.minWidth = window.AndroidBridge.getSavedMinWidth();
      if (window.AndroidBridge.getSavedZoom) state.zoom = window.AndroidBridge.getSavedZoom();
    }
  } catch (e) {
    console.warn('Could not load saved DPI settings', e);
  }

  // Expose global DPI setter for Android native calls
  window.__applyDpiSettings = function (minWidth, zoom) {
    applyDpi(minWidth, zoom);
  };

  function applyDpi(minWidth, zoom) {
    state.minWidth = minWidth || state.minWidth;
    state.zoom = zoom || state.zoom;

    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
      const screenW = window.screen.width || 1080;
      const initialScale = Math.min(1.0, (screenW / state.minWidth) * state.zoom);
      viewport.setAttribute(
        'content',
        `width=${state.minWidth}, initial-scale=${initialScale.toFixed(3)}, maximum-scale=3.0, user-scalable=yes`
      );
    }

    // Persist
    try {
      localStorage.setItem('ec_mobile_min_width', state.minWidth);
      localStorage.setItem('ec_mobile_zoom', state.zoom);
      if (window.AndroidBridge && window.AndroidBridge.saveDpiSettings) {
        window.AndroidBridge.saveDpiSettings(state.minWidth, state.zoom);
      }
    } catch (ignored) {}

    // Update UI elements in dialog if present
    updateModalValues();
  }

  // Request WakeLock in browser as secondary guarantee to Android native WakeLock
  if ('wakeLock' in navigator && navigator.wakeLock) {
    navigator.wakeLock.request('screen').catch(() => {});
  }

  // Dispatch genuine KeyboardEvents to egui canvas
  function dispatchKey(key, code, keyCode, printable) {
    const target = document.activeElement && document.activeElement !== document.body
      ? document.activeElement
      : document.getElementById('effectcraft_canvas') || window;

    const eventInit = {
      key: key,
      code: code || key,
      keyCode: keyCode || key.charCodeAt(0),
      which: keyCode || key.charCodeAt(0),
      bubbles: true,
      cancelable: true,
      ctrlKey: state.ctrlActive,
      shiftKey: state.shiftActive,
      altKey: state.altActive,
      metaKey: state.metaActive
    };

    target.dispatchEvent(new KeyboardEvent('keydown', eventInit));

    if (printable) {
      target.dispatchEvent(new KeyboardEvent('keypress', eventInit));
    }

    setTimeout(() => {
      target.dispatchEvent(new KeyboardEvent('keyup', eventInit));
    }, 40);
  }

  // UI Construction
  function initMobileUI() {
    // 1. Floating Action Buttons (Top Right)
    const fabContainer = document.createElement('div');
    fabContainer.id = 'ec-mobile-controls';
    fabContainer.innerHTML = `
      <button class="ec-mobile-fab" id="ec-fab-kb" title="Toggle Virtual Keyboard">⌨️</button>
      <button class="ec-mobile-fab" id="ec-fab-dpi" title="DPI & 100% Performance Settings">⚙️</button>
      <button class="ec-mobile-fab" id="ec-fab-fs" title="Fullscreen">⛶</button>
    `;
    document.body.appendChild(fabContainer);

    // 2. Virtual Keyboard Container
    const vkContainer = document.createElement('div');
    vkContainer.id = 'ec-vk-container';
    vkContainer.innerHTML = `
      <!-- Quick Text Input Bar -->
      <div id="ec-text-bar">
        <input type="text" id="ec-text-input" placeholder="Type text / expression here..." autocomplete="off" autocapitalize="none" />
        <button class="ec-vk-key primary" id="ec-btn-send-text">Send</button>
        <button class="ec-vk-key" id="ec-btn-close-text">✕</button>
      </div>

      <!-- Quick Action VFX Bar -->
      <div class="ec-vk-bar">
        <!-- Modifiers -->
        <button class="ec-vk-key" id="ec-key-ctrl" data-mod="ctrl">Ctrl</button>
        <button class="ec-vk-key" id="ec-key-shift" data-mod="shift">Shift</button>
        <button class="ec-vk-key" id="ec-key-alt" data-mod="alt">Alt</button>
        <div class="ec-vk-divider"></div>

        <!-- Hotkeys & Playback -->
        <button class="ec-vk-key highlight" id="ec-key-space" title="Tap to Play/Pause, Hold to Pan">Space (Pan)</button>
        <button class="ec-vk-key" id="ec-key-undo" title="Undo (Ctrl+Z)">Undo</button>
        <button class="ec-vk-key" id="ec-key-redo" title="Redo (Ctrl+Y)">Redo</button>
        <button class="ec-vk-key danger" id="ec-key-del" title="Delete selected">Del</button>
        <button class="ec-vk-key" id="ec-key-esc">Esc</button>
        <button class="ec-vk-key primary" id="ec-key-enter">Enter</button>
        <button class="ec-vk-key" id="ec-key-tab">Tab</button>
        <div class="ec-vk-divider"></div>

        <!-- VFX Tools -->
        <button class="ec-vk-key" id="ec-tool-v" title="Selection Tool (V)">V: Sel</button>
        <button class="ec-vk-key" id="ec-tool-h" title="Hand Tool (H)">H: Hand</button>
        <button class="ec-vk-key" id="ec-tool-z" title="Zoom Tool (Z)">Z: Zoom</button>
        <button class="ec-vk-key" id="ec-tool-t" title="Text Tool (T)">T: Text</button>
        <button class="ec-vk-key" id="ec-tool-g" title="Pen/Mask Tool (G)">G: Pen</button>
        <button class="ec-vk-key" id="ec-tool-y" title="Pan Behind (Y)">Y: Pan</button>
        <div class="ec-vk-divider"></div>

        <!-- Timeline / Keyframes -->
        <button class="ec-vk-key" id="ec-key-j" title="Previous Keyframe (J)">◄ J</button>
        <button class="ec-vk-key" id="ec-key-k" title="Next Keyframe (K)">K ►</button>
        <div class="ec-vk-divider"></div>

        <!-- Nudge Arrows -->
        <button class="ec-vk-key" id="ec-key-left">◀</button>
        <button class="ec-vk-key" id="ec-key-up">▲</button>
        <button class="ec-vk-key" id="ec-key-down">▼</button>
        <button class="ec-vk-key" id="ec-key-right">▶</button>
        <div class="ec-vk-divider"></div>

        <!-- Keyboard layout switchers -->
        <button class="ec-vk-key primary" id="ec-btn-toggle-ime" title="Summon Soft Keyboard">IME 🖮</button>
        <button class="ec-vk-key" id="ec-btn-toggle-full" title="Full Virtual QWERTY">QWERTY</button>
        <button class="ec-vk-key" id="ec-btn-hide-vk" title="Minimize Keyboard">▼</button>
      </div>

      <!-- Full QWERTY Virtual Keyboard (Slide Out) -->
      <div id="ec-vk-full">
        <div class="ec-vk-full-row">
          <button class="ec-vk-full-key" data-k="1">1</button>
          <button class="ec-vk-full-key" data-k="2">2</button>
          <button class="ec-vk-full-key" data-k="3">3</button>
          <button class="ec-vk-full-key" data-k="4">4</button>
          <button class="ec-vk-full-key" data-k="5">5</button>
          <button class="ec-vk-full-key" data-k="6">6</button>
          <button class="ec-vk-full-key" data-k="7">7</button>
          <button class="ec-vk-full-key" data-k="8">8</button>
          <button class="ec-vk-full-key" data-k="9">9</button>
          <button class="ec-vk-full-key" data-k="0">0</button>
          <button class="ec-vk-full-key wide" data-k="Backspace">⌫</button>
        </div>
        <div class="ec-vk-full-row">
          <button class="ec-vk-full-key" data-k="q">q</button>
          <button class="ec-vk-full-key" data-k="w">w</button>
          <button class="ec-vk-full-key" data-k="e">e</button>
          <button class="ec-vk-full-key" data-k="r">r</button>
          <button class="ec-vk-full-key" data-k="t">t</button>
          <button class="ec-vk-full-key" data-k="y">y</button>
          <button class="ec-vk-full-key" data-k="u">u</button>
          <button class="ec-vk-full-key" data-k="i">i</button>
          <button class="ec-vk-full-key" data-k="o">o</button>
          <button class="ec-vk-full-key" data-k="p">p</button>
        </div>
        <div class="ec-vk-full-row">
          <button class="ec-vk-full-key" data-k="a">a</button>
          <button class="ec-vk-full-key" data-k="s">s</button>
          <button class="ec-vk-full-key" data-k="d">d</button>
          <button class="ec-vk-full-key" data-k="f">f</button>
          <button class="ec-vk-full-key" data-k="g">g</button>
          <button class="ec-vk-full-key" data-k="h">h</button>
          <button class="ec-vk-full-key" data-k="j">j</button>
          <button class="ec-vk-full-key" data-k="k">k</button>
          <button class="ec-vk-full-key" data-k="l">l</button>
          <button class="ec-vk-full-key wide" data-k="Enter">↵</button>
        </div>
        <div class="ec-vk-full-row">
          <button class="ec-vk-full-key wide" id="ec-full-shift">Shift</button>
          <button class="ec-vk-full-key" data-k="z">z</button>
          <button class="ec-vk-full-key" data-k="x">x</button>
          <button class="ec-vk-full-key" data-k="c">c</button>
          <button class="ec-vk-full-key" data-k="v">v</button>
          <button class="ec-vk-full-key" data-k="b">b</button>
          <button class="ec-vk-full-key" data-k="n">n</button>
          <button class="ec-vk-full-key" data-k="m">m</button>
          <button class="ec-vk-full-key" data-k=",">,</button>
          <button class="ec-vk-full-key" data-k=".">.</button>
        </div>
        <div class="ec-vk-full-row">
          <button class="ec-vk-full-key wide" id="ec-full-ctrl">Ctrl</button>
          <button class="ec-vk-full-key wide" id="ec-full-alt">Alt</button>
          <button class="ec-vk-full-key space" data-k=" ">Space</button>
          <button class="ec-vk-full-key wide" data-k="Escape">Esc</button>
        </div>
      </div>
    `;
    document.body.appendChild(vkContainer);

    // 3. DPI Settings & 100% Performance Modal Dialog
    const modalOverlay = document.createElement('div');
    modalOverlay.id = 'ec-modal-overlay';
    modalOverlay.innerHTML = `
      <div class="ec-modal">
        <div class="ec-modal-header">
          <div class="ec-modal-title">⚙️ EffectCraft Mobile Settings</div>
          <button class="ec-modal-close" id="ec-modal-close-btn">✕</button>
        </div>
        <div class="ec-modal-body">
          <!-- DPI / Minimum Width -->
          <div class="ec-setting-group">
            <div class="ec-setting-label">
              <span>Minimum Width (DPI)</span>
              <span class="ec-setting-value" id="ec-val-min-width">1080 dp</span>
            </div>
            <div class="ec-setting-desc">
              Controls viewport minimum width. Higher widths give full desktop studio workspace; lower widths enlarge UI panels.
            </div>
            <div class="ec-preset-grid">
              <button class="ec-preset-btn" data-width="480">Phone (480)</button>
              <button class="ec-preset-btn" data-width="720">Phablet (720)</button>
              <button class="ec-preset-btn" data-width="960">Tablet (960)</button>
              <button class="ec-preset-btn active" data-width="1080">Desktop (1080)</button>
              <button class="ec-preset-btn" data-width="1280">Studio (1280)</button>
              <button class="ec-preset-btn" data-width="1440">Ultra (1440)</button>
            </div>
            <input type="range" class="ec-slider" id="ec-slider-min-width" min="360" max="1920" step="20" value="1080" />
          </div>

          <!-- UI Zoom / Scale -->
          <div class="ec-setting-group">
            <div class="ec-setting-label">
              <span>UI Scale / Density Zoom</span>
              <span class="ec-setting-value" id="ec-val-zoom">100%</span>
            </div>
            <div class="ec-setting-desc">
              Fine-tune scaling of canvas, buttons, and font sizes.
            </div>
            <input type="range" class="ec-slider" id="ec-slider-zoom" min="0.5" max="2.0" step="0.05" value="1.0" />
          </div>

          <!-- 100% GPU & CPU Performance Status -->
          <div class="ec-setting-group">
            <div class="ec-setting-label">
              <span>Performance & Hardware Acceleration</span>
              <span class="ec-setting-value" style="color:#72d993;">100% Unrestricted</span>
            </div>
            <div class="ec-setting-desc">
              Hardware acceleration is locked to maximum performance with sustained GPU/CPU clocks and no OS throttling.
            </div>
            <div class="ec-perf-badge-row">
              <span class="ec-perf-badge" id="ec-badge-cpu">⚡ CPU: ${navigator.hardwareConcurrency || 8} Cores</span>
              <span class="ec-perf-badge active-gpu" id="ec-badge-gpu">🎮 GPU: Accelerated</span>
              <span class="ec-perf-badge">🔒 Sustained Clocks: ON</span>
              <span class="ec-perf-badge">☀️ WakeLock: Active</span>
            </div>
            <button class="ec-action-btn" id="ec-btn-unlimited-power">Request Zero Throttling (Battery Exemption)</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modalOverlay);

    setupEventListeners();
    applyDpi(state.minWidth, state.zoom);
  }

  function setupEventListeners() {
    // FAB Buttons
    document.getElementById('ec-fab-kb').addEventListener('click', toggleVk);
    document.getElementById('ec-fab-dpi').addEventListener('click', () => openModal(true));
    document.getElementById('ec-fab-fs').addEventListener('click', toggleFullscreen);

    // Modal Close
    document.getElementById('ec-modal-close-btn').addEventListener('click', () => openModal(false));
    document.getElementById('ec-modal-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'ec-modal-overlay') openModal(false);
    });

    // DPI Presets
    document.querySelectorAll('.ec-preset-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const w = parseInt(btn.getAttribute('data-width'), 10);
        document.querySelectorAll('.ec-preset-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('ec-slider-min-width').value = w;
        applyDpi(w, state.zoom);
      });
    });

    // Sliders
    const widthSlider = document.getElementById('ec-slider-min-width');
    widthSlider.addEventListener('input', (e) => {
      const w = parseInt(e.target.value, 10);
      document.querySelectorAll('.ec-preset-btn').forEach((b) => {
        b.classList.toggle('active', parseInt(b.getAttribute('data-width'), 10) === w);
      });
      applyDpi(w, state.zoom);
    });

    const zoomSlider = document.getElementById('ec-slider-zoom');
    zoomSlider.addEventListener('input', (e) => {
      const z = parseFloat(e.target.value);
      applyDpi(state.minWidth, z);
    });

    // Unlimited Power Button
    document.getElementById('ec-btn-unlimited-power').addEventListener('click', () => {
      if (window.AndroidBridge && window.AndroidBridge.requestIgnoreBatteryOptimizations) {
        window.AndroidBridge.requestIgnoreBatteryOptimizations();
      }
    });

    // Modifiers in Virtual Keyboard
    setupModifier('ec-key-ctrl', 'ctrl');
    setupModifier('ec-key-shift', 'shift');
    setupModifier('ec-key-alt', 'alt');
    setupModifier('ec-full-ctrl', 'ctrl');
    setupModifier('ec-full-shift', 'shift');
    setupModifier('ec-full-alt', 'alt');

    // Pan / Space Key (Tap to Play/Pause, Hold to Pan)
    const spaceBtn = document.getElementById('ec-key-space');
    let spaceHoldTimer = null;
    let spaceHeld = false;

    spaceBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      spaceHeld = false;
      spaceHoldTimer = setTimeout(() => {
        spaceHeld = true;
        // Hold Space down for panning
        const target = document.getElementById('effectcraft_canvas') || window;
        target.dispatchEvent(new KeyboardEvent('keydown', {
          key: ' ',
          code: 'Space',
          keyCode: 32,
          which: 32,
          bubbles: true
        }));
        spaceBtn.classList.add('mod-active');
      }, 180);
    });

    spaceBtn.addEventListener('pointerup', (e) => {
      e.preventDefault();
      clearTimeout(spaceHoldTimer);
      const target = document.getElementById('effectcraft_canvas') || window;
      if (spaceHeld) {
        target.dispatchEvent(new KeyboardEvent('keyup', {
          key: ' ',
          code: 'Space',
          keyCode: 32,
          which: 32,
          bubbles: true
        }));
        spaceBtn.classList.remove('mod-active');
      } else {
        // Simple tap -> dispatch Play/Pause Space
        dispatchKey(' ', 'Space', 32, true);
      }
      spaceHeld = false;
    });

    spaceBtn.addEventListener('pointercancel', () => {
      clearTimeout(spaceHoldTimer);
      if (spaceHeld) {
        const target = document.getElementById('effectcraft_canvas') || window;
        target.dispatchEvent(new KeyboardEvent('keyup', {
          key: ' ',
          code: 'Space',
          keyCode: 32,
          which: 32,
          bubbles: true
        }));
        spaceBtn.classList.remove('mod-active');
      }
      spaceHeld = false;
    });

    // Hotkey bindings
    bindKey('ec-key-undo', () => {
      dispatchKeyWithMod('z', 'KeyZ', 90, { ctrl: true });
    });
    bindKey('ec-key-redo', () => {
      dispatchKeyWithMod('y', 'KeyY', 89, { ctrl: true });
    });
    bindKey('ec-key-del', () => dispatchKey('Delete', 'Delete', 46, false));
    bindKey('ec-key-esc', () => dispatchKey('Escape', 'Escape', 27, false));
    bindKey('ec-key-enter', () => dispatchKey('Enter', 'Enter', 13, false));
    bindKey('ec-key-tab', () => dispatchKey('Tab', 'Tab', 9, false));

    // Tools
    bindKey('ec-tool-v', () => dispatchKey('v', 'KeyV', 86, true));
    bindKey('ec-tool-h', () => dispatchKey('h', 'KeyH', 72, true));
    bindKey('ec-tool-z', () => dispatchKey('z', 'KeyZ', 90, true));
    bindKey('ec-tool-t', () => dispatchKey('t', 'KeyT', 84, true));
    bindKey('ec-tool-g', () => dispatchKey('g', 'KeyG', 71, true));
    bindKey('ec-tool-y', () => dispatchKey('y', 'KeyY', 89, true));

    // Timeline navigation
    bindKey('ec-key-j', () => dispatchKey('j', 'KeyJ', 74, true));
    bindKey('ec-key-k', () => dispatchKey('k', 'KeyK', 75, true));

    // Arrow keys
    bindKey('ec-key-left', () => dispatchKey('ArrowLeft', 'ArrowLeft', 37, false));
    bindKey('ec-key-up', () => dispatchKey('ArrowUp', 'ArrowUp', 38, false));
    bindKey('ec-key-down', () => dispatchKey('ArrowDown', 'ArrowDown', 40, false));
    bindKey('ec-key-right', () => dispatchKey('ArrowRight', 'ArrowRight', 39, false));

    // Layout toggles
    document.getElementById('ec-btn-hide-vk').addEventListener('click', toggleVk);
    document.getElementById('ec-btn-toggle-full').addEventListener('click', toggleFullVk);
    document.getElementById('ec-btn-toggle-ime').addEventListener('click', toggleTextBar);

    // Text bar
    document.getElementById('ec-btn-close-text').addEventListener('click', () => {
      document.getElementById('ec-text-bar').classList.remove('visible');
    });

    document.getElementById('ec-btn-send-text').addEventListener('click', sendTextInput);
    document.getElementById('ec-text-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        sendTextInput();
      }
    });

    // Full QWERTY keys
    document.querySelectorAll('.ec-vk-full-key[data-k]').forEach((keyEl) => {
      keyEl.addEventListener('click', () => {
        const char = keyEl.getAttribute('data-k');
        if (char === 'Backspace') {
          dispatchKey('Backspace', 'Backspace', 8, false);
        } else if (char === 'Enter') {
          dispatchKey('Enter', 'Enter', 13, false);
        } else if (char === 'Escape') {
          dispatchKey('Escape', 'Escape', 27, false);
        } else {
          const isShift = state.shiftActive;
          const k = isShift ? char.toUpperCase() : char.toLowerCase();
          dispatchKey(k, 'Key' + k.toUpperCase(), k.charCodeAt(0), true);
        }
      });
    });
  }

  function setupModifier(elementId, modName) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.addEventListener('click', () => {
      if (modName === 'ctrl') state.ctrlActive = !state.ctrlActive;
      if (modName === 'shift') state.shiftActive = !state.shiftActive;
      if (modName === 'alt') state.altActive = !state.altActive;
      updateModifierUI();
    });
  }

  function updateModifierUI() {
    ['ctrl', 'shift', 'alt'].forEach((mod) => {
      const active = state[mod + 'Active'];
      const el1 = document.getElementById('ec-key-' + mod);
      const el2 = document.getElementById('ec-full-' + mod);
      if (el1) el1.classList.toggle('mod-active', active);
      if (el2) el2.classList.toggle('mod-active', active);
    });
  }

  function bindKey(id, handler) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('click', (e) => {
      e.preventDefault();
      handler();
    });
  }

  function dispatchKeyWithMod(key, code, keyCode, mods) {
    const origCtrl = state.ctrlActive;
    const origShift = state.shiftActive;
    const origAlt = state.altActive;

    if (mods.ctrl !== undefined) state.ctrlActive = mods.ctrl;
    if (mods.shift !== undefined) state.shiftActive = mods.shift;
    if (mods.alt !== undefined) state.altActive = mods.alt;

    dispatchKey(key, code, keyCode, false);

    state.ctrlActive = origCtrl;
    state.shiftActive = origShift;
    state.altActive = origAlt;
    updateModifierUI();
  }

  function toggleVk() {
    state.vkVisible = !state.vkVisible;
    const vk = document.getElementById('ec-vk-container');
    const fab = document.getElementById('ec-fab-kb');
    if (vk) vk.classList.toggle('hidden', !state.vkVisible);
    if (fab) fab.classList.toggle('active', state.vkVisible);
  }

  function toggleFullVk() {
    state.fullVkVisible = !state.fullVkVisible;
    const full = document.getElementById('ec-vk-full');
    const btn = document.getElementById('ec-btn-toggle-full');
    if (full) full.classList.toggle('visible', state.fullVkVisible);
    if (btn) btn.classList.toggle('primary', state.fullVkVisible);
  }

  function toggleTextBar() {
    const textBar = document.getElementById('ec-text-bar');
    const input = document.getElementById('ec-text-input');
    textBar.classList.toggle('visible');
    if (textBar.classList.contains('visible')) {
      input.focus();
      if (window.AndroidBridge && window.AndroidBridge.showSoftKeyboard) {
        window.AndroidBridge.showSoftKeyboard();
      }
    }
  }

  function sendTextInput() {
    const input = document.getElementById('ec-text-input');
    const text = input.value;
    if (!text) return;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      dispatchKey(char, 'Key' + char.toUpperCase(), char.charCodeAt(0), true);
    }
    input.value = '';
  }

  function openModal(open) {
    state.modalOpen = open;
    const overlay = document.getElementById('ec-modal-overlay');
    if (overlay) overlay.classList.toggle('open', open);
    if (open) updateModalValues();
  }

  function updateModalValues() {
    const valWidth = document.getElementById('ec-val-min-width');
    const sliderWidth = document.getElementById('ec-slider-min-width');
    const valZoom = document.getElementById('ec-val-zoom');
    const sliderZoom = document.getElementById('ec-slider-zoom');

    if (valWidth) valWidth.textContent = state.minWidth + ' dp';
    if (sliderWidth) sliderWidth.value = state.minWidth;
    if (valZoom) valZoom.textContent = Math.round(state.zoom * 100) + '%';
    if (sliderZoom) sliderZoom.value = state.zoom;
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  // Initialize once DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobileUI);
  } else {
    initMobileUI();
  }
})();
