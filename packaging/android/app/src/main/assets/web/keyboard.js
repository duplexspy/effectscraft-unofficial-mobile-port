// Virtual Laptop Keyboard for EffectCraft Android & Mobile Web
(function () {
  'use strict';

  // State
  const state = {
    visible: false,
    transparent: false,
    ctrl: false,
    alt: false,
    shift: false,
    meta: false,
    capsLock: false,
    numLock: true,
    ctrlLocked: false,
    altLocked: false,
    shiftLocked: false,
    metaLocked: false,
  };

  // DPI & Mobile Display State
  const dpiState = {
    minWidth: 1080,
    zoom: 1.0,
    modalOpen: false
  };

  try {
    const sw = localStorage.getItem('ec_mobile_min_width');
    const sz = localStorage.getItem('ec_mobile_zoom');
    if (sw) dpiState.minWidth = parseInt(sw, 10);
    if (sz) dpiState.zoom = parseFloat(sz);
    if (window.AndroidBridge) {
      if (window.AndroidBridge.getSavedMinWidth) dpiState.minWidth = window.AndroidBridge.getSavedMinWidth();
      if (window.AndroidBridge.getSavedZoom) dpiState.zoom = window.AndroidBridge.getSavedZoom();
    }
  } catch (_) {}

  function applyDpi(minWidth, zoom) {
    dpiState.minWidth = minWidth || dpiState.minWidth;
    dpiState.zoom = zoom || dpiState.zoom;
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
      const screenW = window.screen.width || 1080;
      const initialScale = Math.min(1.0, (screenW / dpiState.minWidth) * dpiState.zoom);
      viewport.setAttribute(
        'content',
        `width=${dpiState.minWidth}, initial-scale=${initialScale.toFixed(3)}, maximum-scale=3.0, user-scalable=yes`
      );
    }
    try {
      localStorage.setItem('ec_mobile_min_width', dpiState.minWidth);
      localStorage.setItem('ec_mobile_zoom', dpiState.zoom);
      if (window.AndroidBridge && window.AndroidBridge.saveDpiSettings) {
        window.AndroidBridge.saveDpiSettings(dpiState.minWidth, dpiState.zoom);
      }
    } catch (_) {}
    updateDpiModalUI();
  }

  window.__applyDpiSettings = function(w, z) {
    applyDpi(w, z);
  };

  // 1. Native Mobile File Import Trigger
  function triggerMobileFileImport() {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '*/*';
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    input.style.opacity = '0';
    document.body.appendChild(input);
    input.onchange = async () => {
      if (!input.files || input.files.length === 0) return;
      for (const file of input.files) {
        if (window.effectcraft && window.effectcraft.addFile) {
          try {
            await window.effectcraft.addFile(file);
            console.log('[MobileImport] Successfully added:', file.name);
          } catch (err) {
            console.error('[MobileImport] Error loading file:', file.name, err);
          }
        }
      }
      setTimeout(() => { if (input.parentNode) input.parentNode.removeChild(input); }, 1000);
    };
    input.click();
  }

  // 2. Global DOM hook so ANY dynamically created <input type="file"> attaches to document body
  // This ensures Android WebView's WebChromeClient.onShowFileChooser is reliably called for all in-app imports!
  const origInputClick = HTMLInputElement.prototype.click;
  HTMLInputElement.prototype.click = function() {
    if (this.type === 'file' && !document.contains(this)) {
      this.style.position = 'fixed';
      this.style.left = '-9999px';
      this.style.opacity = '0';
      document.body.appendChild(this);
      try {
        return origInputClick.call(this);
      } finally {
        setTimeout(() => { if (this.parentNode) this.parentNode.removeChild(this); }, 60000);
      }
    }
    return origInputClick.call(this);
  };

  // 3. Global download hook: Intercepts all render exports / downloads and routes to mobile Downloads directory
  const origAnchorClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function() {
    if (this.hasAttribute('download') && this.href) {
      const filename = this.getAttribute('download') || 'effectcraft_export';
      const href = this.href;
      if (href.startsWith('blob:') || href.startsWith('data:')) {
        fetch(href)
          .then(r => r.blob())
          .then(blob => {
            const reader = new FileReader();
            reader.onloadend = function() {
              const base64Data = (reader.result || '').split(',')[1];
              if (base64Data && window.AndroidBridge && window.AndroidBridge.saveToDownloads) {
                window.AndroidBridge.saveToDownloads(base64Data, filename, blob.type || 'application/octet-stream');
              }
            };
            reader.readAsDataURL(blob);
          })
          .catch(err => console.error('[MobileDownload] Failed to read blob for download:', err));
        return;
      }
    }
    return origAnchorClick.call(this);
  };

  const canvasId = 'effectcraft_canvas';

  function getCanvas() {
    return document.getElementById(canvasId) || document.querySelector('canvas') || document.body;
  }

  // Dual Dispatch: DOM KeyboardEvent + window.effectcraft control protocol
  function sendKeyEvent(action, keyName, codeName, keyCodeVal, isChar) {
    const isDown = action === 'keydown';
    const target = getCanvas();

    const effectiveShift = state.shift || (state.capsLock && isChar);
    const effectiveCtrl = state.ctrl;
    const effectiveAlt = state.alt;
    const effectiveMeta = state.meta;

    const eventInit = {
      key: keyName,
      code: codeName,
      keyCode: keyCodeVal,
      which: keyCodeVal,
      charCode: isDown && isChar && keyName.length === 1 ? keyName.charCodeAt(0) : 0,
      bubbles: true,
      cancelable: true,
      composed: true,
      ctrlKey: effectiveCtrl,
      altKey: effectiveAlt,
      shiftKey: effectiveShift,
      metaKey: effectiveMeta,
    };

    const evt = new KeyboardEvent(action, eventInit);
    try {
      target.dispatchEvent(evt);
      window.dispatchEvent(evt);
      document.dispatchEvent(evt);
    } catch (e) {
      console.warn('Dispatch event error:', e);
    }

    // Also communicate through window.effectcraft if present
    if (window.effectcraft && typeof window.effectcraft.request === 'function') {
      try {
        let scKey = keyName;
        if (codeName && codeName.startsWith('Numpad')) {
          if (codeName === 'Numpad0') scKey = 'Num0';
        }
        window.effectcraft.request('ui.key', {
          key: scKey,
          ctrl: effectiveCtrl,
          alt: effectiveAlt,
          shift: effectiveShift,
          pressed: isDown,
        }).catch(() => {});
      } catch (err) {}
    }
  }

  function sendTypeChar(char) {
    if (window.effectcraft && typeof window.effectcraft.request === 'function') {
      window.effectcraft.request('ui.type', { text: char }).catch(() => {});
    }
  }

  // Send full key press (down then up)
  function sendKeyPress(keyName, codeName, keyCodeVal, isChar) {
    sendKeyEvent('keydown', keyName, codeName, keyCodeVal, isChar);
    setTimeout(() => {
      sendKeyEvent('keyup', keyName, codeName, keyCodeVal, isChar);
      if (isChar && keyName.length === 1 && !state.ctrl && !state.alt && !state.meta) {
        sendTypeChar(keyName);
      }
      // If modifiers were latched (not locked), unlatch them
      if (state.ctrl && !state.ctrlLocked) { state.ctrl = false; }
      if (state.alt && !state.altLocked) { state.alt = false; }
      if (state.shift && !state.shiftLocked) { state.shift = false; }
      if (state.meta && !state.metaLocked) { state.meta = false; }
      updateModifierUI();
    }, 15);
  }

  function updateModifierUI() {
    const elCtrl = document.querySelectorAll('.ec-key-ctrl');
    const elAlt = document.querySelectorAll('.ec-key-alt');
    const elShift = document.querySelectorAll('.ec-key-shift');
    const elWin = document.querySelectorAll('.ec-key-win');
    const elCaps = document.querySelector('.ec-key-caps');
    const elNumLk = document.querySelector('.ec-key-numlk');

    elCtrl.forEach(el => el.classList.toggle('ec-kb-mod-active', state.ctrl));
    elAlt.forEach(el => el.classList.toggle('ec-kb-mod-active', state.alt));
    elShift.forEach(el => el.classList.toggle('ec-kb-mod-active', state.shift));
    elWin.forEach(el => el.classList.toggle('ec-kb-mod-active', state.meta));
    if (elCaps) elCaps.classList.toggle('ec-kb-locked', state.capsLock);
    if (elNumLk) elNumLk.classList.toggle('ec-kb-locked', state.numLock);

    // Update keys showing shifted symbols vs regular
    const shifted = state.shift;
    document.querySelectorAll('[data-shift]').forEach(keyEl => {
      const main = keyEl.querySelector('.ec-kb-main-label');
      const sub = keyEl.querySelector('.ec-kb-sub');
      const regChar = keyEl.getAttribute('data-key');
      const shiftChar = keyEl.getAttribute('data-shift');
      if (main && sub) {
        if (shifted) {
          main.textContent = shiftChar;
          sub.textContent = regChar;
        } else {
          main.textContent = regChar;
          sub.textContent = shiftChar;
        }
      }
    });

    // Update letter keys for caps/shift
    const uppercase = (state.shift && !state.capsLock) || (!state.shift && state.capsLock);
    document.querySelectorAll('[data-letter]').forEach(keyEl => {
      const letter = keyEl.getAttribute('data-letter');
      const main = keyEl.querySelector('.ec-kb-main-label') || keyEl;
      main.textContent = uppercase ? letter.toUpperCase() : letter.toLowerCase();
    });
  }

  // Build Virtual Keyboard HTML
  function createKeyboardDOM() {
    if (document.getElementById('ec-keyboard-container')) return;
    if (!document.body) return;

    // 1. Floating button
    const floatBtn = document.createElement('div');
    floatBtn.id = 'ec-floating-kb-btn';
    floatBtn.title = 'Toggle Virtual Laptop Keyboard';
    floatBtn.innerHTML = `
      <svg viewBox="0 0 24 24">
        <path d="M20 5H4c-1.1 0-1.99.9-1.99 2L2 17c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-9 3h2v2h-2V8zm0 3h2v2h-2v-2zM8 8h2v2H8V8zm0 3h2v2H8v-2zm-1 2H5v-2h2v2zm0-3H5V8h2v2zm9 7H8v-2h8v2zm0-4h-2v-2h2v2zm0-3h-2V8h2v2zm3 3h-2v-2h2v2zm0-3h-2V8h2v2z"/>
      </svg>
    `;

    // Floating button touch/drag
    let startX = 0, startY = 0, initialLeft = 0, initialTop = 0, isDragging = false, moved = false;
    floatBtn.addEventListener('pointerdown', (e) => {
      isDragging = true;
      moved = false;
      startX = e.clientX;
      startY = e.clientY;
      const rect = floatBtn.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;
      floatBtn.setPointerCapture(e.pointerId);
    });

    floatBtn.addEventListener('pointermove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        moved = true;
        floatBtn.style.left = `${Math.max(10, Math.min(window.innerWidth - 64, initialLeft + dx))}px`;
        floatBtn.style.top = `${Math.max(10, Math.min(window.innerHeight - 64, initialTop + dy))}px`;
        floatBtn.style.right = 'auto';
        floatBtn.style.bottom = 'auto';
      }
    });

    floatBtn.addEventListener('pointerup', (e) => {
      if (isDragging) {
        isDragging = false;
        try { floatBtn.releasePointerCapture(e.pointerId); } catch (_) {}
        if (!moved) {
          toggleVirtualKeyboard();
        }
      }
    });

    // 1b. Floating DPI button
    const floatDpiBtn = document.createElement('div');
    floatDpiBtn.id = 'ec-floating-dpi-btn';
    floatDpiBtn.title = 'Open DPI & Scale Settings';
    floatDpiBtn.innerHTML = '⚙️';

    let dStartX = 0, dStartY = 0, dInitialLeft = 0, dInitialTop = 0, dIsDragging = false, dMoved = false;
    floatDpiBtn.addEventListener('pointerdown', (e) => {
      dIsDragging = true;
      dMoved = false;
      dStartX = e.clientX;
      dStartY = e.clientY;
      const rect = floatDpiBtn.getBoundingClientRect();
      dInitialLeft = rect.left;
      dInitialTop = rect.top;
      floatDpiBtn.setPointerCapture(e.pointerId);
    });

    floatDpiBtn.addEventListener('pointermove', (e) => {
      if (!dIsDragging) return;
      const dx = e.clientX - dStartX;
      const dy = e.clientY - dStartY;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        dMoved = true;
        floatDpiBtn.style.left = `${Math.max(10, Math.min(window.innerWidth - 54, dInitialLeft + dx))}px`;
        floatDpiBtn.style.top = `${Math.max(10, Math.min(window.innerHeight - 54, dInitialTop + dy))}px`;
        floatDpiBtn.style.right = 'auto';
        floatDpiBtn.style.bottom = 'auto';
      }
    });

    floatDpiBtn.addEventListener('pointerup', (e) => {
      if (dIsDragging) {
        dIsDragging = false;
        try { floatDpiBtn.releasePointerCapture(e.pointerId); } catch (_) {}
        if (!dMoved) {
          openDpiModal(true);
        }
      }
    });

    // 1c. Floating Extensions button
    const floatExtBtn = document.createElement('div');
    floatExtBtn.id = 'ec-floating-ext-btn';
    floatExtBtn.title = 'Extensions & Plug-ins Manager';
    floatExtBtn.innerHTML = '🧩';

    let eStartX = 0, eStartY = 0, eInitialLeft = 0, eInitialTop = 0, eIsDragging = false, eMoved = false;
    floatExtBtn.addEventListener('pointerdown', (e) => {
      eIsDragging = true;
      eMoved = false;
      eStartX = e.clientX;
      eStartY = e.clientY;
      const rect = floatExtBtn.getBoundingClientRect();
      eInitialLeft = rect.left;
      eInitialTop = rect.top;
      floatExtBtn.setPointerCapture(e.pointerId);
    });

    floatExtBtn.addEventListener('pointermove', (e) => {
      if (!eIsDragging) return;
      const dx = e.clientX - eStartX;
      const dy = e.clientY - eStartY;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        eMoved = true;
        floatExtBtn.style.left = `${Math.max(10, Math.min(window.innerWidth - 54, eInitialLeft + dx))}px`;
        floatExtBtn.style.top = `${Math.max(10, Math.min(window.innerHeight - 54, eInitialTop + dy))}px`;
        floatExtBtn.style.right = 'auto';
        floatExtBtn.style.bottom = 'auto';
      }
    });

    floatExtBtn.addEventListener('pointerup', (e) => {
      if (eIsDragging) {
        eIsDragging = false;
        try { floatExtBtn.releasePointerCapture(e.pointerId); } catch (_) {}
        if (!eMoved) {
          openExtensionsModal(true);
        }
      }
    });

    // 2. Keyboard overlay container
    const kb = document.createElement('div');
    kb.id = 'ec-keyboard-container';
    kb.className = 'ec-kb-hidden';

    kb.innerHTML = `
      <div class="ec-kb-header">
        <div class="ec-kb-header-left">
          <span class="ec-kb-title">Pocket Laptop Keyboard</span>
          <div class="ec-kb-quick-actions">
            <button class="ec-kb-action-btn" data-action="undo">Undo (Ctrl+Z)</button>
            <button class="ec-kb-action-btn" data-action="redo">Redo (Ctrl+Y)</button>
            <button class="ec-kb-action-btn" data-action="save">Save (Ctrl+S)</button>
            <button class="ec-kb-action-btn" data-action="import">📁 Import</button>
            <button class="ec-kb-action-btn" data-action="plugins">🧩 Extensions</button>
            <button class="ec-kb-action-btn" data-action="space">Play/Pause</button>
            <button class="ec-kb-action-btn" data-action="fit">Fit View</button>
            <button class="ec-kb-action-btn" data-action="dpi">⚙️ DPI</button>
          </div>
        </div>
        <div class="ec-kb-header-right">
          <button class="ec-kb-tool-btn" id="ec-kb-ext-btn" title="Extensions & Plug-ins Manager">🧩</button>
          <button class="ec-kb-tool-btn" id="ec-kb-dpi-btn" title="DPI & Scale Settings">⚙️</button>
          <button class="ec-kb-tool-btn" id="ec-kb-opacity-btn" title="Toggle Transparency">◐</button>
          <button class="ec-kb-tool-btn" id="ec-kb-close-btn" title="Close Keyboard">✕</button>
        </div>
      </div>

      <div class="ec-kb-body">
        <!-- Main Laptop Section -->
        <div class="ec-kb-section-main">
          <!-- Row 0: Function Keys -->
          <div class="ec-kb-row">
            <button class="ec-kb-key ec-kb-key-fn" data-key="Escape" data-code="Escape" data-keycode="27">Esc</button>
            <button class="ec-kb-key ec-kb-key-fn" data-key="F1" data-code="F1" data-keycode="112">F1</button>
            <button class="ec-kb-key ec-kb-key-fn" data-key="F2" data-code="F2" data-keycode="113">F2</button>
            <button class="ec-kb-key ec-kb-key-fn" data-key="F3" data-code="F3" data-keycode="114">F3</button>
            <button class="ec-kb-key ec-kb-key-fn" data-key="F4" data-code="F4" data-keycode="115">F4</button>
            <button class="ec-kb-key ec-kb-key-fn" data-key="F5" data-code="F5" data-keycode="116">F5</button>
            <button class="ec-kb-key ec-kb-key-fn" data-key="F6" data-code="F6" data-keycode="117">F6</button>
            <button class="ec-kb-key ec-kb-key-fn" data-key="F7" data-code="F7" data-keycode="118">F7</button>
            <button class="ec-kb-key ec-kb-key-fn" data-key="F8" data-code="F8" data-keycode="119">F8</button>
            <button class="ec-kb-key ec-kb-key-fn" data-key="F9" data-code="F9" data-keycode="120">F9</button>
            <button class="ec-kb-key ec-kb-key-fn" data-key="F10" data-code="F10" data-keycode="121">F10</button>
            <button class="ec-kb-key ec-kb-key-fn" data-key="F11" data-code="F11" data-keycode="122">F11</button>
            <button class="ec-kb-key ec-kb-key-fn" data-key="F12" data-code="F12" data-keycode="123">F12</button>
          </div>

          <!-- Row 1: Numbers & Symbols -->
          <div class="ec-kb-row">
            <button class="ec-kb-key" data-key="\`" data-shift="~" data-code="Backquote" data-keycode="192"><span class="ec-kb-sub">~</span><span class="ec-kb-main-label">\`</span></button>
            <button class="ec-kb-key" data-key="1" data-shift="!" data-code="Digit1" data-keycode="49"><span class="ec-kb-sub">!</span><span class="ec-kb-main-label">1</span></button>
            <button class="ec-kb-key" data-key="2" data-shift="@" data-code="Digit2" data-keycode="50"><span class="ec-kb-sub">@</span><span class="ec-kb-main-label">2</span></button>
            <button class="ec-kb-key" data-key="3" data-shift="#" data-code="Digit3" data-keycode="51"><span class="ec-kb-sub">#</span><span class="ec-kb-main-label">3</span></button>
            <button class="ec-kb-key" data-key="4" data-shift="$" data-code="Digit4" data-keycode="52"><span class="ec-kb-sub">$</span><span class="ec-kb-main-label">4</span></button>
            <button class="ec-kb-key" data-key="5" data-shift="%" data-code="Digit5" data-keycode="53"><span class="ec-kb-sub">%</span><span class="ec-kb-main-label">5</span></button>
            <button class="ec-kb-key" data-key="6" data-shift="^" data-code="Digit6" data-keycode="54"><span class="ec-kb-sub">^</span><span class="ec-kb-main-label">6</span></button>
            <button class="ec-kb-key" data-key="7" data-shift="&" data-code="Digit7" data-keycode="55"><span class="ec-kb-sub">&amp;</span><span class="ec-kb-main-label">7</span></button>
            <button class="ec-kb-key" data-key="8" data-shift="*" data-code="Digit8" data-keycode="56"><span class="ec-kb-sub">*</span><span class="ec-kb-main-label">8</span></button>
            <button class="ec-kb-key" data-key="9" data-shift="(" data-code="Digit9" data-keycode="57"><span class="ec-kb-sub">(</span><span class="ec-kb-main-label">9</span></button>
            <button class="ec-kb-key" data-key="0" data-shift=")" data-code="Digit0" data-keycode="48"><span class="ec-kb-sub">)</span><span class="ec-kb-main-label">0</span></button>
            <button class="ec-kb-key" data-key="-" data-shift="_" data-code="Minus" data-keycode="189"><span class="ec-kb-sub">_</span><span class="ec-kb-main-label">-</span></button>
            <button class="ec-kb-key" data-key="=" data-shift="+" data-code="Equal" data-keycode="187"><span class="ec-kb-sub">+</span><span class="ec-kb-main-label">=</span></button>
            <button class="ec-kb-key ec-kb-w-1-5" data-key="Backspace" data-code="Backspace" data-keycode="8">⌫ Back</button>
          </div>

          <!-- Row 2: QWERTY -->
          <div class="ec-kb-row">
            <button class="ec-kb-key ec-kb-w-1-5" data-key="Tab" data-code="Tab" data-keycode="9">Tab ⇥</button>
            <button class="ec-kb-key" data-letter="q" data-code="KeyQ" data-keycode="81">Q</button>
            <button class="ec-kb-key" data-letter="w" data-code="KeyW" data-keycode="87">W</button>
            <button class="ec-kb-key" data-letter="e" data-code="KeyE" data-keycode="69">E</button>
            <button class="ec-kb-key" data-letter="r" data-code="KeyR" data-keycode="82">R</button>
            <button class="ec-kb-key" data-letter="t" data-code="KeyT" data-keycode="84">T</button>
            <button class="ec-kb-key" data-letter="y" data-code="KeyY" data-keycode="89">Y</button>
            <button class="ec-kb-key" data-letter="u" data-code="KeyU" data-keycode="85">U</button>
            <button class="ec-kb-key" data-letter="i" data-code="KeyI" data-keycode="73">I</button>
            <button class="ec-kb-key" data-letter="o" data-code="KeyO" data-keycode="79">O</button>
            <button class="ec-kb-key" data-letter="p" data-code="KeyP" data-keycode="80">P</button>
            <button class="ec-kb-key" data-key="[" data-shift="{" data-code="BracketLeft" data-keycode="219"><span class="ec-kb-sub">{</span><span class="ec-kb-main-label">[</span></button>
            <button class="ec-kb-key" data-key="]" data-shift="}" data-code="BracketRight" data-keycode="221"><span class="ec-kb-sub">}</span><span class="ec-kb-main-label">]</span></button>
            <button class="ec-kb-key" data-key="\\" data-shift="|" data-code="Backslash" data-keycode="220"><span class="ec-kb-sub">|</span><span class="ec-kb-main-label">\\</span></button>
          </div>

          <!-- Row 3: Home Row -->
          <div class="ec-kb-row">
            <button class="ec-kb-key ec-kb-w-1-75 ec-key-caps" data-action="caps">Caps Lock</button>
            <button class="ec-kb-key" data-letter="a" data-code="KeyA" data-keycode="65">A</button>
            <button class="ec-kb-key" data-letter="s" data-code="KeyS" data-keycode="83">S</button>
            <button class="ec-kb-key" data-letter="d" data-code="KeyD" data-keycode="68">D</button>
            <button class="ec-kb-key" data-letter="f" data-code="KeyF" data-keycode="70">F</button>
            <button class="ec-kb-key" data-letter="g" data-code="KeyG" data-keycode="71">G</button>
            <button class="ec-kb-key" data-letter="h" data-code="KeyH" data-keycode="72">H</button>
            <button class="ec-kb-key" data-letter="j" data-code="KeyJ" data-keycode="74">J</button>
            <button class="ec-kb-key" data-letter="k" data-code="KeyK" data-keycode="75">K</button>
            <button class="ec-kb-key" data-letter="l" data-code="KeyL" data-keycode="76">L</button>
            <button class="ec-kb-key" data-key=";" data-shift=":" data-code="Semicolon" data-keycode="186"><span class="ec-kb-sub">:</span><span class="ec-kb-main-label">;</span></button>
            <button class="ec-kb-key" data-key="'" data-shift='"' data-code="Quote" data-keycode="222"><span class="ec-kb-sub">"</span><span class="ec-kb-main-label">'</span></button>
            <button class="ec-kb-key ec-kb-w-2" data-key="Enter" data-code="Enter" data-keycode="13">↵ Enter</button>
          </div>

          <!-- Row 4: Shift Row -->
          <div class="ec-kb-row">
            <button class="ec-kb-key ec-kb-w-2-25 ec-key-shift" data-mod="shift">⇧ Shift</button>
            <button class="ec-kb-key" data-letter="z" data-code="KeyZ" data-keycode="90">Z</button>
            <button class="ec-kb-key" data-letter="x" data-code="KeyX" data-keycode="88">X</button>
            <button class="ec-kb-key" data-letter="c" data-code="KeyC" data-keycode="67">C</button>
            <button class="ec-kb-key" data-letter="v" data-code="KeyV" data-keycode="86">V</button>
            <button class="ec-kb-key" data-letter="b" data-code="KeyB" data-keycode="66">B</button>
            <button class="ec-kb-key" data-letter="n" data-code="KeyN" data-keycode="78">N</button>
            <button class="ec-kb-key" data-letter="m" data-code="KeyM" data-keycode="77">M</button>
            <button class="ec-kb-key" data-key="," data-shift="<" data-code="Comma" data-keycode="188"><span class="ec-kb-sub">&lt;</span><span class="ec-kb-main-label">,</span></button>
            <button class="ec-kb-key" data-key="." data-shift=">" data-code="Period" data-keycode="190"><span class="ec-kb-sub">&gt;</span><span class="ec-kb-main-label">.</span></button>
            <button class="ec-kb-key" data-key="/" data-shift="?" data-code="Slash" data-keycode="191"><span class="ec-kb-sub">?</span><span class="ec-kb-main-label">/</span></button>
            <button class="ec-kb-key ec-kb-w-2-25 ec-key-shift" data-mod="shift">⇧ Shift</button>
          </div>

          <!-- Row 5: Modifier Row -->
          <div class="ec-kb-row">
            <button class="ec-kb-key ec-kb-w-1-25 ec-key-ctrl" data-mod="ctrl">Ctrl</button>
            <button class="ec-kb-key ec-key-win" data-mod="meta">⊞ Win</button>
            <button class="ec-kb-key ec-kb-w-1-25 ec-key-alt" data-mod="alt">Alt</button>
            <button class="ec-kb-key ec-kb-w-space" data-key=" " data-code="Space" data-keycode="32">Space</button>
            <button class="ec-kb-key ec-kb-w-1-25 ec-key-alt" data-mod="alt">Alt</button>
            <button class="ec-kb-key ec-kb-w-1-25 ec-key-ctrl" data-mod="ctrl">Ctrl</button>
          </div>
        </div>

        <!-- Navigation Cluster -->
        <div class="ec-kb-section-nav">
          <div class="ec-kb-row">
            <button class="ec-kb-key ec-kb-key-fn" data-key="Insert" data-code="Insert" data-keycode="45">Ins</button>
            <button class="ec-kb-key ec-kb-key-fn" data-key="Home" data-code="Home" data-keycode="36">Home</button>
            <button class="ec-kb-key ec-kb-key-fn" data-key="PageUp" data-code="PageUp" data-keycode="33">PgUp</button>
          </div>
          <div class="ec-kb-row">
            <button class="ec-kb-key ec-kb-key-fn" data-key="Delete" data-code="Delete" data-keycode="46">Del</button>
            <button class="ec-kb-key ec-kb-key-fn" data-key="End" data-code="End" data-keycode="35">End</button>
            <button class="ec-kb-key ec-kb-key-fn" data-key="PageDown" data-code="PageDown" data-keycode="34">PgDn</button>
          </div>
          <div class="ec-kb-row">
            <div style="flex:1;"></div>
            <button class="ec-kb-key ec-kb-arrow" data-key="ArrowUp" data-code="ArrowUp" data-keycode="38">▲</button>
            <div style="flex:1;"></div>
          </div>
          <div class="ec-kb-row">
            <button class="ec-kb-key ec-kb-arrow" data-key="ArrowLeft" data-code="ArrowLeft" data-keycode="37">◀</button>
            <button class="ec-kb-key ec-kb-arrow" data-key="ArrowDown" data-code="ArrowDown" data-keycode="40">▼</button>
            <button class="ec-kb-key ec-kb-arrow" data-key="ArrowRight" data-code="ArrowRight" data-keycode="39">▶</button>
          </div>
        </div>

        <!-- Functional Number Pad (Numpad) -->
        <div class="ec-kb-section-numpad">
          <div class="ec-kb-row">
            <button class="ec-kb-key ec-kb-key-fn ec-key-numlk" data-action="numlock">NumLk</button>
            <button class="ec-kb-key" data-key="/" data-code="NumpadDivide" data-keycode="111">/</button>
            <button class="ec-kb-key" data-key="*" data-code="NumpadMultiply" data-keycode="106">*</button>
            <button class="ec-kb-key" data-key="-" data-code="NumpadSubtract" data-keycode="109">-</button>
          </div>
          <div class="ec-kb-row">
            <button class="ec-kb-key" data-numpad="7" data-code="Numpad7" data-keycode="103">7</button>
            <button class="ec-kb-key" data-numpad="8" data-code="Numpad8" data-keycode="104">8</button>
            <button class="ec-kb-key" data-numpad="9" data-code="Numpad9" data-keycode="105">9</button>
            <button class="ec-kb-key" data-key="+" data-code="NumpadAdd" data-keycode="107">+</button>
          </div>
          <div class="ec-kb-row">
            <button class="ec-kb-key" data-numpad="4" data-code="Numpad4" data-keycode="100">4</button>
            <button class="ec-kb-key" data-numpad="5" data-code="Numpad5" data-keycode="101">5</button>
            <button class="ec-kb-key" data-numpad="6" data-code="Numpad6" data-keycode="102">6</button>
            <button class="ec-kb-key" data-key="Delete" data-code="NumpadDecimal" data-keycode="110">.</button>
          </div>
          <div class="ec-kb-row">
            <button class="ec-kb-key" data-numpad="1" data-code="Numpad1" data-keycode="97">1</button>
            <button class="ec-kb-key" data-numpad="2" data-code="Numpad2" data-keycode="98">2</button>
            <button class="ec-kb-key" data-numpad="3" data-code="Numpad3" data-keycode="99">3</button>
            <button class="ec-kb-key" data-key="Enter" data-code="NumpadEnter" data-keycode="13">↵</button>
          </div>
          <div class="ec-kb-row">
            <button class="ec-kb-key ec-kb-w-2" data-numpad="0" data-code="Numpad0" data-keycode="96">0</button>
            <button class="ec-kb-key" data-key="." data-code="NumpadDecimal" data-keycode="110">.</button>
            <button class="ec-kb-key" data-key="Enter" data-code="NumpadEnter" data-keycode="13">↵</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(floatBtn);
    document.body.appendChild(floatDpiBtn);
    document.body.appendChild(floatExtBtn);
    document.body.appendChild(kb);

    createDpiModalDOM();
    createExtensionsModalDOM();
    applyDpi(dpiState.minWidth, dpiState.zoom);

    attachKeyboardEvents(kb);
    updateModifierUI();
  }

  function attachKeyboardEvents(kb) {
    // Close button
    document.getElementById('ec-kb-close-btn').addEventListener('click', () => {
      hideVirtualKeyboard();
    });

    // Opacity button
    document.getElementById('ec-kb-opacity-btn').addEventListener('click', () => {
      state.transparent = !state.transparent;
      kb.classList.toggle('ec-kb-transparent', state.transparent);
    });

    // DPI Settings button in header
    const dpiToolBtn = document.getElementById('ec-kb-dpi-btn');
    if (dpiToolBtn) {
      dpiToolBtn.addEventListener('click', () => {
        openDpiModal(true);
      });
    }

    // Extensions & Plug-ins button in header
    const extToolBtn = document.getElementById('ec-kb-ext-btn');
    if (extToolBtn) {
      extToolBtn.addEventListener('click', () => {
        openExtensionsModal(true);
      });
    }

    // Quick Actions
    kb.querySelectorAll('.ec-kb-action-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.getAttribute('data-action');
        if (action === 'undo') {
          sendKeyPress('z', 'KeyZ', 90, true);
        } else if (action === 'redo') {
          sendKeyPress('y', 'KeyY', 89, true);
        } else if (action === 'save') {
          sendKeyPress('s', 'KeyS', 83, true);
        } else if (action === 'import') {
          triggerMobileFileImport();
        } else if (action === 'plugins') {
          openExtensionsModal(true);
        } else if (action === 'space') {
          sendKeyPress(' ', 'Space', 32, false);
        } else if (action === 'fit') {
          // Shift + /
          state.shift = true;
          sendKeyPress('/', 'Slash', 191, false);
          state.shift = false;
          updateModifierUI();
        } else if (action === 'dpi') {
          openDpiModal(true);
        }
      });
    });

    // Key presses on regular keys
    kb.addEventListener('pointerdown', (e) => {
      const keyBtn = e.target.closest('.ec-kb-key');
      if (!keyBtn) return;
      e.preventDefault();
      keyBtn.classList.add('ec-kb-pressed');

      // 1. Modifiers toggle
      const mod = keyBtn.getAttribute('data-mod');
      if (mod) {
        if (mod === 'ctrl') { state.ctrl = !state.ctrl; state.ctrlLocked = state.ctrl; }
        if (mod === 'alt') { state.alt = !state.alt; state.altLocked = state.alt; }
        if (mod === 'shift') { state.shift = !state.shift; state.shiftLocked = state.shift; }
        if (mod === 'meta') { state.meta = !state.meta; state.metaLocked = state.meta; }
        updateModifierUI();
        return;
      }

      // 2. Action toggles (caps, numlock)
      const action = keyBtn.getAttribute('data-action');
      if (action === 'caps') {
        state.capsLock = !state.capsLock;
        updateModifierUI();
        return;
      }
      if (action === 'numlock') {
        state.numLock = !state.numLock;
        updateModifierUI();
        return;
      }

      // 3. Numpad keys
      const numpadDigit = keyBtn.getAttribute('data-numpad');
      if (numpadDigit !== null) {
        const code = keyBtn.getAttribute('data-code');
        const keyCode = parseInt(keyBtn.getAttribute('data-keycode') || '0', 10);
        if (state.numLock) {
          sendKeyPress(numpadDigit, code, keyCode, true);
        } else {
          // Nav mode when NumLock is off
          const navMap = {
            '7': ['Home', 'Home', 36],
            '8': ['ArrowUp', 'ArrowUp', 38],
            '9': ['PageUp', 'PageUp', 33],
            '4': ['ArrowLeft', 'ArrowLeft', 37],
            '5': ['Clear', '', 12],
            '6': ['ArrowRight', 'ArrowRight', 39],
            '1': ['End', 'End', 35],
            '2': ['ArrowDown', 'ArrowDown', 40],
            '3': ['PageDown', 'PageDown', 34],
            '0': ['Insert', 'Insert', 45],
          };
          const nav = navMap[numpadDigit];
          if (nav) {
            sendKeyPress(nav[0], nav[1], nav[2], false);
          }
        }
        return;
      }

      // 4. Letter keys
      const letter = keyBtn.getAttribute('data-letter');
      if (letter) {
        const code = keyBtn.getAttribute('data-code');
        const keyCode = parseInt(keyBtn.getAttribute('data-keycode') || '0', 10);
        const uppercase = (state.shift && !state.capsLock) || (!state.shift && state.capsLock);
        const char = uppercase ? letter.toUpperCase() : letter.toLowerCase();
        sendKeyPress(char, code, keyCode, true);
        return;
      }

      // 5. Symbol / Regular keys
      let key = keyBtn.getAttribute('data-key');
      const shiftKey = keyBtn.getAttribute('data-shift');
      if (state.shift && shiftKey) {
        key = shiftKey;
      }
      if (key) {
        const code = keyBtn.getAttribute('data-code') || key;
        const keyCode = parseInt(keyBtn.getAttribute('data-keycode') || '0', 10);
        const isChar = key.length === 1;
        sendKeyPress(key, code, keyCode, isChar);
      }
    });

    kb.addEventListener('pointerup', (e) => {
      const keyBtn = e.target.closest('.ec-kb-key');
      if (keyBtn) keyBtn.classList.remove('ec-kb-pressed');
    });

    kb.addEventListener('pointercancel', (e) => {
      const keyBtn = e.target.closest('.ec-kb-key');
      if (keyBtn) keyBtn.classList.remove('ec-kb-pressed');
    });
  }

  // Global APIs
  function toggleVirtualKeyboard() {
    if (state.visible) {
      hideVirtualKeyboard();
    } else {
      showVirtualKeyboard();
    }
  }

  function showVirtualKeyboard() {
    let kb = document.getElementById('ec-keyboard-container');
    if (!kb) {
      createKeyboardDOM();
      kb = document.getElementById('ec-keyboard-container');
    }
    state.visible = true;
    if (kb) {
      kb.classList.remove('ec-kb-hidden');
      kb.style.display = 'flex';
      kb.style.transform = 'translateY(0)';
      kb.style.opacity = '1';
      kb.style.pointerEvents = 'auto';
    }
    const btn = document.getElementById('ec-floating-kb-btn');
    if (btn) btn.style.transform = 'scale(0.85)';
  }

  function hideVirtualKeyboard() {
    state.visible = false;
    const kb = document.getElementById('ec-keyboard-container');
    if (kb) {
      kb.classList.add('ec-kb-hidden');
      kb.style.transform = 'translateY(105%)';
      kb.style.opacity = '0';
      kb.style.pointerEvents = 'none';
    }
    const btn = document.getElementById('ec-floating-kb-btn');
    if (btn) btn.style.transform = 'scale(1)';
  }

  // DPI Modal Dialog DOM and Handlers
  function createDpiModalDOM() {
    if (document.getElementById('ec-dpi-modal-overlay')) return;
    if (!document.body) return;

    const modal = document.createElement('div');
    modal.id = 'ec-dpi-modal-overlay';
    modal.innerHTML = `
      <div class="ec-dpi-modal-card">
        <div class="ec-dpi-modal-header">
          <div class="ec-dpi-modal-title">⚙️ Mobile Display & DPI Settings</div>
          <button class="ec-dpi-modal-close" id="ec-dpi-close-btn">✕</button>
        </div>
        <div class="ec-dpi-modal-content">
          <div class="ec-dpi-group">
            <div class="ec-dpi-label-row">
              <span>Minimum Width (DPI)</span>
              <span class="ec-dpi-val-badge" id="ec-dpi-width-val">${dpiState.minWidth}px</span>
            </div>
            <input type="range" class="ec-dpi-slider" id="ec-dpi-width-slider" min="720" max="2560" step="40" value="${dpiState.minWidth}" />
            <div class="ec-dpi-presets">
              <button class="ec-dpi-preset-btn" data-width="1080">1080p</button>
              <button class="ec-dpi-preset-btn" data-width="1280">1280p</button>
              <button class="ec-dpi-preset-btn" data-width="1440">1440p (2K)</button>
              <button class="ec-dpi-preset-btn" data-width="1920">1920p (Desktop)</button>
            </div>
          </div>
          <div class="ec-dpi-group">
            <div class="ec-dpi-label-row">
              <span>UI Scale / Zoom</span>
              <span class="ec-dpi-val-badge" id="ec-dpi-zoom-val">${Math.round(dpiState.zoom * 100)}%</span>
            </div>
            <input type="range" class="ec-dpi-slider" id="ec-dpi-zoom-slider" min="0.75" max="1.50" step="0.05" value="${dpiState.zoom}" />
          </div>
          <div class="ec-hardware-info" id="ec-hw-info">
            <strong>Hardware Status:</strong> 100% Unrestricted CPU/GPU<br>
            Sustained Performance Mode: Active
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('ec-dpi-close-btn').addEventListener('click', () => openDpiModal(false));
    modal.addEventListener('click', (e) => {
      if (e.target === modal) openDpiModal(false);
    });

    const wSlider = document.getElementById('ec-dpi-width-slider');
    wSlider.addEventListener('input', (e) => {
      applyDpi(parseInt(e.target.value, 10), dpiState.zoom);
    });

    const zSlider = document.getElementById('ec-dpi-zoom-slider');
    zSlider.addEventListener('input', (e) => {
      applyDpi(dpiState.minWidth, parseFloat(e.target.value));
    });

    modal.querySelectorAll('.ec-dpi-preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const w = parseInt(btn.getAttribute('data-width'), 10);
        applyDpi(w, dpiState.zoom);
      });
    });

    updateDpiModalUI();
  }

  function openDpiModal(show) {
    let modal = document.getElementById('ec-dpi-modal-overlay');
    if (!modal) {
      createDpiModalDOM();
      modal = document.getElementById('ec-dpi-modal-overlay');
    }
    dpiState.modalOpen = show;
    if (modal) {
      modal.classList.toggle('active', show);
      if (show) updateDpiModalUI();
    }
  }

  function updateDpiModalUI() {
    const wVal = document.getElementById('ec-dpi-width-val');
    const zVal = document.getElementById('ec-dpi-zoom-val');
    const wSlider = document.getElementById('ec-dpi-width-slider');
    const zSlider = document.getElementById('ec-dpi-zoom-slider');
    if (wVal) wVal.textContent = `${dpiState.minWidth}px`;
    if (zVal) zVal.textContent = `${Math.round(dpiState.zoom * 100)}%`;
    if (wSlider) wSlider.value = dpiState.minWidth;
    if (zSlider) zSlider.value = dpiState.zoom;

    document.querySelectorAll('.ec-dpi-preset-btn').forEach(btn => {
      const w = parseInt(btn.getAttribute('data-width'), 10);
      btn.classList.toggle('active', w === dpiState.minWidth);
    });

    const hwInfo = document.getElementById('ec-hw-info');
    if (hwInfo && window.AndroidBridge) {
      const cores = window.AndroidBridge.getCpuCores ? window.AndroidBridge.getCpuCores() : (navigator.hardwareConcurrency || 8);
      const ram = window.AndroidBridge.getTotalRamMb ? window.AndroidBridge.getTotalRamMb() : 4096;
      hwInfo.innerHTML = `<strong>Hardware Status:</strong> 100% Unrestricted CPU & GPU<br>CPU Cores: ${cores} | Heap RAM: ${ram} MB | Screen: ${window.screen.width}×${window.screen.height}`;
    }
  }

  // ------------------------------------------------------------------ Extensions & Plug-ins Manager

  const extModalState = {
    modalOpen: false,
    activeTab: 'installed',
    items: []
  };

  const EXT_TEMPLATES = {
    nudge: {
      name: 'NudgeLayers.jsx',
      code: `// NudgeLayers.jsx - Dockable ScriptUI Panel for EffectCraft
(function (thisObj) {
  var ui = thisObj instanceof Panel ? thisObj : new Window("palette", "Nudge Layers", undefined, { resizeable: true });
  ui.orientation = "column";
  ui.alignChildren = ["fill", "top"];
  ui.spacing = 6;
  ui.margins = 8;

  ui.add("statictext", undefined, "Nudge Position (±10px):");
  var row = ui.add("group");
  row.orientation = "row";
  row.alignChildren = ["center", "center"];
  row.spacing = 6;

  var btnL = row.add("button", undefined, "◀ Left");
  var btnU = row.add("button", undefined, "▲ Up");
  var btnD = row.add("button", undefined, "▼ Down");
  var btnR = row.add("button", undefined, "▶ Right");

  var status = ui.add("statictext", undefined, "Select layers & tap direction.");

  function nudge(dx, dy) {
    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) {
      status.text = "Open a composition first.";
      return;
    }
    var sel = comp.selectedLayers;
    if (!sel || sel.length === 0) {
      status.text = "No layers selected.";
      return;
    }
    app.beginUndoGroup("Nudge Layers");
    for (var i = 0; i < sel.length; i++) {
      var p = sel[i].transform.position;
      var v = p.value;
      if (p.numKeys === 0) {
        p.setValue([v[0] + dx, v[1] + dy]);
      }
    }
    app.endUndoGroup();
    status.text = "Nudged " + sel.length + " layer(s).";
  }

  btnL.onClick = function () { nudge(-10, 0); };
  btnR.onClick = function () { nudge(10, 0); };
  btnU.onClick = function () { nudge(0, -10); };
  btnD.onClick = function () { nudge(0, 10); };

  if (ui instanceof Window) ui.show(); else ui.layout.layout(true);
})(this);`
    },
    colorizer: {
      name: 'LayerColorizer.jsx',
      code: `// LayerColorizer.jsx - Dockable ScriptUI Panel
(function (thisObj) {
  var ui = thisObj instanceof Panel ? thisObj : new Window("palette", "Layer Labels", undefined, { resizeable: true });
  ui.orientation = "column";
  ui.alignChildren = ["fill", "top"];
  ui.spacing = 6;
  ui.margins = 8;

  ui.add("statictext", undefined, "Assign Layer Highlight Color:");
  var grp = ui.add("group");
  grp.orientation = "row";
  grp.spacing = 4;

  var colors = [
    { name: "Red", idx: 1 },
    { name: "Yellow", idx: 2 },
    { name: "Aqua", idx: 4 },
    { name: "Pink", idx: 5 },
    { name: "Peach", idx: 7 }
  ];

  for (var i = 0; i < colors.length; i++) {
    (function (c) {
      var b = grp.add("button", undefined, c.name);
      b.onClick = function () {
        var comp = app.project.activeItem;
        if (!(comp instanceof CompItem)) return;
        var sel = comp.selectedLayers;
        if (!sel || sel.length === 0) return;
        app.beginUndoGroup("Set Layer Color");
        for (var j = 0; j < sel.length; j++) {
          sel[j].label = c.idx;
        }
        app.endUndoGroup();
      };
    })(colors[i]);
  }

  if (ui instanceof Window) ui.show(); else ui.layout.layout(true);
})(this);`
    },
    renamer: {
      name: 'BatchRenamer.jsx',
      code: `// BatchRenamer.jsx - Dockable ScriptUI Panel
(function (thisObj) {
  var ui = thisObj instanceof Panel ? thisObj : new Window("palette", "Batch Renamer", undefined, { resizeable: true });
  ui.orientation = "column";
  ui.alignChildren = ["fill", "top"];
  ui.spacing = 6;
  ui.margins = 8;

  ui.add("statictext", undefined, "Base Name / Prefix:");
  var txt = ui.add("edittext", undefined, "Element_");
  var btn = ui.add("button", undefined, "Rename Selected Layers");
  var status = ui.add("statictext", undefined, "Select layers to number.");

  btn.onClick = function () {
    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) return;
    var sel = comp.selectedLayers;
    if (!sel || sel.length === 0) return;
    var prefix = txt.text || "Element_";
    app.beginUndoGroup("Batch Rename");
    for (var i = 0; i < sel.length; i++) {
      sel[i].name = prefix + (i + 1);
    }
    app.endUndoGroup();
    status.text = "Renamed " + sel.length + " layer(s).";
  };

  if (ui instanceof Window) ui.show(); else ui.layout.layout(true);
})(this);`
    },
    ease: {
      name: 'SmoothEase.jsx',
      code: `// SmoothEase.jsx - Quick Smooth Keyframe Ease Script
(function () {
  var comp = app.project.activeItem;
  if (!(comp instanceof CompItem)) return;
  app.beginUndoGroup("Quick Smooth Ease");
  var easeIn = new KeyframeEase(0, 75);
  var easeOut = new KeyframeEase(0, 75);
  var props = comp.selectedProperties;
  var count = 0;
  for (var i = 0; i < props.length; i++) {
    var prop = props[i];
    if (prop.selectedKeys) {
      for (var k = 0; k < prop.selectedKeys.length; k++) {
        var keyIndex = prop.selectedKeys[k];
        prop.setTemporalEaseAtKey(keyIndex, [easeIn], [easeOut]);
        count++;
      }
    }
  }
  app.endUndoGroup();
})();`
    }
  };

  function saveToConfigIdb(key, bytes) {
    return new Promise((resolve, reject) => {
      if (!self.indexedDB) return resolve(false);
      const open = indexedDB.open('effectcraft', 1);
      open.onupgradeneeded = () => {
        try { open.result.createObjectStore('entries', { keyPath: 'key' }); } catch (_) {}
      };
      open.onsuccess = () => {
        try {
          const db = open.result;
          const tx = db.transaction('entries', 'readwrite');
          const store = tx.objectStore('entries');
          const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
          store.put({ key: key, data: buf, modified: Date.now() });
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => reject(tx.error);
        } catch (e) {
          reject(e);
        }
      };
      open.onerror = () => reject(open.error);
    });
  }

  function deleteFromConfigIdb(key) {
    return new Promise((resolve) => {
      if (!self.indexedDB) return resolve(false);
      const open = indexedDB.open('effectcraft', 1);
      open.onsuccess = () => {
        try {
          const db = open.result;
          const tx = db.transaction('entries', 'readwrite');
          tx.objectStore('entries').delete(key);
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
        } catch (_) {
          resolve(false);
        }
      };
      open.onerror = () => resolve(false);
    });
  }

  async function saveToConfigOpfs(key, bytes) {
    try {
      if (!navigator.storage?.getDirectory) return false;
      const root = await navigator.storage.getDirectory();
      const dir = await root.getDirectoryHandle('effectcraft', { create: true });
      const h = await dir.getFileHandle(encodeURIComponent(key), { create: true });
      const w = await h.createWritable();
      await w.write(bytes);
      await w.close();
      return true;
    } catch (_) {
      return false;
    }
  }

  async function deleteFromConfigOpfs(key) {
    try {
      if (!navigator.storage?.getDirectory) return false;
      const root = await navigator.storage.getDirectory();
      const dir = await root.getDirectoryHandle('effectcraft', { create: true });
      await dir.removeEntry(encodeURIComponent(key));
      return true;
    } catch (_) {
      return false;
    }
  }

  function detectExtensionType(filename, content) {
    const name = filename || 'unnamed.jsx';
    const lower = name.toLowerCase();

    // 1. WebAssembly effect plugins
    if (lower.endsWith('.wasm') || lower.endsWith('.wat')) {
      return {
        type: 'plugin',
        typeName: 'WebAssembly Effect Plug-in',
        folder: 'Plug-ins',
        destPath: 'Plug-ins/' + name,
        badgeClass: 'ec-badge-plugin',
        badgeText: 'Plugin',
        targetMenu: 'Effect menu',
        isPanel: false,
        isPlugin: true
      };
    }

    // 2. Decode text for JSX / JS analysis
    let text = '';
    if (typeof content === 'string') {
      text = content;
    } else if (content instanceof Uint8Array) {
      try { text = new TextDecoder().decode(content); } catch (_) { text = ''; }
    }

    // ScriptUI patterns
    const isPanel =
      /thisObj\s*instanceof\s*Panel/i.test(text) ||
      /new\s+Window\s*\(\s*["']palette["']/i.test(text) ||
      /new\s+Window\s*\(\s*["']dialog["']/i.test(text) ||
      /\b(ui|this|win|w|panel)\.add\s*\(/i.test(text) ||
      /\b(ui|this|win|w|panel)\.orientation\s*=/i.test(text) ||
      /__uiDockPanel/i.test(text) ||
      /ScriptUIGraphics/i.test(text) ||
      lower.includes('panel') ||
      lower.includes('palette');

    if (isPanel) {
      return {
        type: 'panel',
        typeName: 'ScriptUI Dockable Panel',
        folder: 'Scripts/ScriptUI Panels',
        destPath: 'Scripts/ScriptUI Panels/' + name,
        badgeClass: 'ec-badge-panel',
        badgeText: 'UI Panel',
        targetMenu: 'Window menu',
        isPanel: true,
        isPlugin: false
      };
    }

    // Automation script
    return {
      type: 'script',
      typeName: 'ExtendScript Automation',
      folder: 'Scripts',
      destPath: 'Scripts/' + name,
      badgeClass: 'ec-badge-script',
      badgeText: 'Script',
      targetMenu: 'File ▸ Scripts menu',
      isPanel: false,
      isPlugin: false
    };
  }

  async function installExtensionOrPlugin(filename, data, explicitType) {
    let bytes;
    let text = '';
    if (typeof data === 'string') {
      text = data;
      bytes = new TextEncoder().encode(data);
    } else if (data instanceof ArrayBuffer) {
      bytes = new Uint8Array(data);
      try { text = new TextDecoder().decode(bytes); } catch (_) {}
    } else if (data instanceof Uint8Array) {
      bytes = data;
      try { text = new TextDecoder().decode(bytes); } catch (_) {}
    } else {
      throw new Error('Unsupported file format');
    }

    const detected = detectExtensionType(filename, text || bytes);
    const type = explicitType || detected.type;
    const folder = type === 'plugin' ? 'Plug-ins' : (type === 'panel' ? 'Scripts/ScriptUI Panels' : 'Scripts');
    const configKey = `config/${folder}/${filename}`;

    // 1. Dual persistent storage
    await saveToConfigIdb(configKey, bytes).catch(console.warn);
    await saveToConfigOpfs(configKey, bytes).catch(console.warn);

    // 2. Register with running engine
    let engineResult = null;
    if (window.effectcraft) {
      try {
        if (window.effectcraft.addFile) {
          await window.effectcraft.addFile(new Blob([bytes], { type: 'application/octet-stream' }), filename);
        }
        if (type === 'panel') {
          engineResult = await window.effectcraft.execute('file.installScriptUIPanel', { path: '/' + filename });
        } else if (type === 'script') {
          engineResult = await window.effectcraft.execute('file.installScript', { path: '/' + filename });
        } else if (type === 'plugin') {
          engineResult = await window.effectcraft.execute('effect.plugins.install', { path: '/' + filename });
        }
      } catch (err) {
        console.warn('Engine install notification:', err);
      }
    }

    return {
      success: true,
      detected,
      folder,
      configKey,
      filename,
      engineResult
    };
  }

  async function uninstallExtension(name, isPanel, isPlugin) {
    const folder = isPlugin ? 'Plug-ins' : (isPanel ? 'Scripts/ScriptUI Panels' : 'Scripts');
    const configKey = `config/${folder}/${name}`;

    await deleteFromConfigIdb(configKey);
    await deleteFromConfigOpfs(configKey);

    if (window.effectcraft) {
      if (window.effectcraft.execute) {
        try {
          await window.effectcraft.execute('file.uninstallScript', { name });
        } catch (_) {}
      }
      if (window.effectcraft.removeStored) {
        try {
          await window.effectcraft.removeStored(configKey);
        } catch (_) {}
      }
    }
  }

  async function runExtensionItem(name, isPanel, isPlugin) {
    if (!window.effectcraft || !window.effectcraft.execute) {
      alert('EffectCraft engine is initializing. Please wait a moment and try again.');
      return;
    }
    try {
      if (isPanel) {
        await window.effectcraft.execute('window.scriptPanel', { name });
        openExtensionsModal(false);
      } else if (isPlugin) {
        alert(`Plug-in "${name}" is installed in the Effect menu. Apply it from Effect ▸ [Category].`);
      } else {
        await window.effectcraft.execute('file.runScript', { name });
        alert(`Script "${name}" executed successfully.`);
      }
    } catch (err) {
      alert('Execution error: ' + (err.message || err));
    }
  }

  function createExtensionsModalDOM() {
    if (document.getElementById('ec-ext-modal-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'ec-ext-modal-overlay';

    overlay.innerHTML = `
      <div class="ec-ext-modal-card">
        <div class="ec-ext-modal-header">
          <div class="ec-ext-modal-title">
            <span>🧩</span>
            <span>Extensions & Plug-ins Manager</span>
          </div>
          <button class="ec-kb-tool-btn" id="ec-ext-close-btn" title="Close">✕</button>
        </div>

        <div class="ec-ext-tabs">
          <button class="ec-ext-tab-btn active" data-tab="installed">📦 Installed</button>
          <button class="ec-ext-tab-btn" data-tab="upload">⬆️ Upload & Auto-Detect</button>
          <button class="ec-ext-tab-btn" data-tab="creator">✏️ Code Creator</button>
          <button class="ec-ext-tab-btn" data-tab="guide">📖 AI Prompting Guide</button>
        </div>

        <!-- Tab 1: Installed -->
        <div class="ec-ext-tab-pane active" id="ec-ext-pane-installed">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <span style="font-size: 11px; color: #8f929d; font-weight: 500;">INSTALLED EXTENSIONS & PANELS</span>
            <button id="ec-ext-refresh-btn" class="ec-ext-action-btn" style="font-size: 10px;">🔄 Refresh</button>
          </div>
          <div class="ec-ext-list" id="ec-ext-items-list">
            <div style="color: #8f929d; font-size: 11px; text-align: center; padding: 20px;">Scanning extensions...</div>
          </div>
        </div>

        <!-- Tab 2: Upload & Auto-Detect -->
        <div class="ec-ext-tab-pane" id="ec-ext-pane-upload">
          <div class="ec-placement-banner">
            <strong>🤖 Smart Auto-Placement Active:</strong><br>
            Upload any <code>.jsx</code>, <code>.js</code>, <code>.wasm</code>, or <code>.wat</code> file. The app inspects its structure and automatically places it into:
            <div style="margin-top: 4px; font-family: monospace; font-size: 10px;">
              • <strong>Scripts/ScriptUI Panels/</strong> (Dockable UI panels)<br>
              • <strong>Scripts/</strong> (Automation scripts)<br>
              • <strong>Plug-ins/</strong> (Native WebAssembly effects)
            </div>
            No laptop or manual folder management required!
          </div>

          <div class="ec-upload-zone" id="ec-ext-dropzone">
            <div class="ec-upload-icon">📂</div>
            <div class="ec-upload-text">Tap or Drop File to Upload</div>
            <div class="ec-upload-subtext">Tap to select from your phone files or storage.<br>Auto-routes and installs instantly.</div>
            <input type="file" id="ec-ext-file-input" accept=".jsx,.js,.wasm,.wat,.ts" style="display:none">
          </div>

          <div id="ec-ext-upload-status" style="display: none;"></div>
        </div>

        <!-- Tab 3: Code Creator -->
        <div class="ec-ext-tab-pane" id="ec-ext-pane-creator">
          <div class="ec-creator-form">
            <div style="font-size: 11px; color: #8f929d;">File Name:</div>
            <input type="text" id="ec-creator-name" class="ec-input-text" placeholder="MyExtension.jsx" value="MyTool.jsx">

            <div style="font-size: 11px; color: #8f929d;">Quick Starters / Templates:</div>
            <div class="ec-preset-chips">
              <button class="ec-chip" data-template="nudge">Nudge Layers (Panel)</button>
              <button class="ec-chip" data-template="colorizer">Color Labels (Panel)</button>
              <button class="ec-chip" data-template="renamer">Batch Renamer (Panel)</button>
              <button class="ec-chip" data-template="ease">Smooth Ease (Script)</button>
              <button class="ec-chip" data-template="clear">Clear Code</button>
            </div>

            <div style="font-size: 11px; color: #8f929d;">ExtendScript / ScriptUI Code:</div>
            <textarea id="ec-creator-code" class="ec-code-area" spellcheck="false" placeholder="// Paste or write your ExtendScript code here..."></textarea>

            <button id="ec-creator-install-btn" class="ec-ext-action-btn primary" style="padding: 10px; font-size: 12px; font-weight: 600;">✨ Auto-Detect & Install to Folder</button>
            <div id="ec-creator-status" style="display: none;"></div>
          </div>
        </div>

        <!-- Tab 4: Guide & AI Prompts -->
        <div class="ec-ext-tab-pane" id="ec-ext-pane-guide">
          <div class="ec-guide-body">
            <h4>🧠 How Extensions Work in EffectCraft</h4>
            <div>
              EffectCraft provides full After Effects scripting parity. You can run automated scripts, dock custom UI panels, and run native WebAssembly effects.
            </div>

            <h4>📂 Extension Folders Overview</h4>
            <div style="font-size: 11px; line-height: 1.45;">
              <strong>1. Scripts/ScriptUI Panels/</strong>: Dockable panels listed in the <em>Window</em> menu. They run with <code>this</code> as a dockable <code>Panel</code>.<br>
              <strong>2. Scripts/</strong>: Standalone automation tools listed in <em>File ▸ Scripts</em>.<br>
              <strong>3. Plug-ins/</strong>: Native WebAssembly effect plug-ins listed in the <em>Effect</em> menu.
            </div>

            <h4>🤖 Generating Extensions with AI</h4>
            <div>
              Copy the Master AI Prompt below and paste it into ChatGPT, Claude, or Gemini. The prompt enforces EffectCraft's exact API constraints and dockable patterns.
            </div>

            <div class="ec-prompt-box" id="ec-ai-prompt-box">
You are an expert After Effects and EffectCraft ExtendScript developer.
Create a mobile-friendly dockable ScriptUI Panel for EffectCraft.

Core Architecture:
1. Wrap all code in a self-executing dockable container:
(function(thisObj) {
  var ui = thisObj instanceof Panel ? thisObj : new Window("palette", "Tool Title", undefined, {resizeable: true});
  ui.orientation = "column";
  ui.alignChildren = ["fill", "top"];
  ui.spacing = 6;
  ui.margins = 8;
  
  // UI Controls (buttons, edittext, statictext, sliders, dropdowns)
  // ...

  // Event handlers with undo grouping:
  // app.beginUndoGroup("Action Name");
  // ... edits on app.project.activeItem / comp.selectedLayers ...
  // app.endUndoGroup();

  if (ui instanceof Window) ui.show(); else ui.layout.layout(true);
})(this);

2. Use standard After Effects DOM:
- app.project.activeItem (check instanceof CompItem)
- comp.selectedLayers (iterate and modify transform.position, opacity, rotation, scale)
- comp.selectedProperties (inspect and set keyframe values and temporal ease)
- app.beginUndoGroup(name) and app.endUndoGroup()

3. Mobile Touch Optimization:
- Keep controls finger-friendly and layouts compact.
- Avoid wide fixed-width components so it docks nicely in portrait and landscape.

Task: [Describe the tool you want here]
            </div>

            <button id="ec-copy-prompt-btn" class="ec-ext-action-btn primary" style="padding: 9px; font-weight: 600;">📋 Copy AI Generator Prompt</button>
            <div id="ec-copy-status" style="display: none; color: #7ee787; font-size: 11px; text-align: center;">✅ Prompt copied to clipboard! Paste into Claude/ChatGPT.</div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Close button
    document.getElementById('ec-ext-close-btn').addEventListener('click', () => {
      openExtensionsModal(false);
    });

    // Close on overlay backdrop tap
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) openExtensionsModal(false);
    });

    // Tab switching
    overlay.querySelectorAll('.ec-ext-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        switchExtTab(tab);
      });
    });

    // Refresh list button
    document.getElementById('ec-ext-refresh-btn').addEventListener('click', () => {
      refreshExtensionsList();
    });

    // Upload dropzone & input
    const dropzone = document.getElementById('ec-ext-dropzone');
    const fileInput = document.getElementById('ec-ext-file-input');

    dropzone.addEventListener('click', () => {
      fileInput.click();
    });

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('dragover');
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleUploadedFile(e.dataTransfer.files[0]);
      }
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleUploadedFile(e.target.files[0]);
      }
    });

    // Creator Preset Chips
    overlay.querySelectorAll('.ec-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const key = chip.getAttribute('data-template');
        const nameInput = document.getElementById('ec-creator-name');
        const codeArea = document.getElementById('ec-creator-code');
        if (key === 'clear') {
          codeArea.value = '';
          return;
        }
        const tpl = EXT_TEMPLATES[key];
        if (tpl) {
          nameInput.value = tpl.name;
          codeArea.value = tpl.code;
        }
      });
    });

    // Creator Install Button
    document.getElementById('ec-creator-install-btn').addEventListener('click', async () => {
      const nameInput = document.getElementById('ec-creator-name');
      const codeArea = document.getElementById('ec-creator-code');
      const statusEl = document.getElementById('ec-creator-status');

      const name = (nameInput.value || '').trim();
      const code = codeArea.value;

      if (!name) {
        alert('Please specify a filename.');
        return;
      }
      if (!code.trim()) {
        alert('Please enter or paste ExtendScript code.');
        return;
      }

      statusEl.style.display = 'block';
      statusEl.innerHTML = '<div style="color: #55a6f8; font-size: 11px;">⏳ Analyzing code & installing...</div>';

      try {
        const res = await installExtensionOrPlugin(name, code);
        const isPanel = res.detected.type === 'panel';
        statusEl.innerHTML = `
          <div style="background: #193822; border: 1px solid #238636; border-radius: 6px; padding: 10px; color: #7ee787; font-size: 11.5px; margin-top: 8px;">
            <strong>🎉 Successfully Installed!</strong><br>
            File: <strong>${name}</strong><br>
            Detected: <strong>${res.detected.typeName}</strong><br>
            Saved in: <code>${res.folder}/</code><br>
            <div style="margin-top: 8px; display: flex; gap: 8px;">
              ${isPanel ? `<button id="ec-creator-open-now" class="ec-ext-action-btn primary">▶ Open Panel Now</button>` : ''}
              <button id="ec-creator-go-list" class="ec-ext-action-btn">View in Installed</button>
            </div>
          </div>
        `;
        if (document.getElementById('ec-creator-open-now')) {
          document.getElementById('ec-creator-open-now').addEventListener('click', () => {
            runExtensionItem(name, true, false);
          });
        }
        if (document.getElementById('ec-creator-go-list')) {
          document.getElementById('ec-creator-go-list').addEventListener('click', () => {
            switchExtTab('installed');
          });
        }
        refreshExtensionsList();
      } catch (err) {
        statusEl.innerHTML = `<div style="background: #3f191b; border: 1px solid #da3633; border-radius: 6px; padding: 10px; color: #f85149; font-size: 11.5px; margin-top: 8px;">❌ Install error: ${err.message || err}</div>`;
      }
    });

    // Copy Prompt Button
    document.getElementById('ec-copy-prompt-btn').addEventListener('click', () => {
      const promptBox = document.getElementById('ec-ai-prompt-box');
      const statusEl = document.getElementById('ec-copy-status');
      const text = promptBox.innerText || promptBox.textContent;

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text.trim()).then(() => {
          showCopySuccess(statusEl);
        }).catch(() => {
          fallbackCopyText(text.trim(), statusEl);
        });
      } else {
        fallbackCopyText(text.trim(), statusEl);
      }
    });

    // Pre-populate with first template
    const tpl = EXT_TEMPLATES.nudge;
    document.getElementById('ec-creator-name').value = tpl.name;
    document.getElementById('ec-creator-code').value = tpl.code;
  }

  function showCopySuccess(statusEl) {
    statusEl.style.display = 'block';
    setTimeout(() => { statusEl.style.display = 'none'; }, 3000);
  }

  function fallbackCopyText(text, statusEl) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      showCopySuccess(statusEl);
    } catch (_) {
      alert('Could not copy automatically. Please select the prompt text manually.');
    }
    document.body.removeChild(ta);
  }

  function switchExtTab(tabId) {
    extModalState.activeTab = tabId;
    const overlay = document.getElementById('ec-ext-modal-overlay');
    if (!overlay) return;

    overlay.querySelectorAll('.ec-ext-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
    });

    overlay.querySelectorAll('.ec-ext-tab-pane').forEach(pane => {
      pane.classList.toggle('active', pane.id === `ec-ext-pane-${tabId}`);
    });

    if (tabId === 'installed') {
      refreshExtensionsList();
    }
  }

  function handleUploadedFile(file) {
    const statusEl = document.getElementById('ec-ext-upload-status');
    statusEl.style.display = 'block';
    statusEl.innerHTML = `<div style="color: #55a6f8; font-size: 11px;">⏳ Analyzing & auto-placing <strong>${file.name}</strong>...</div>`;

    const isBinary = file.name.toLowerCase().endsWith('.wasm');
    const reader = new FileReader();

    reader.onload = async () => {
      try {
        const data = isBinary ? new Uint8Array(reader.result) : reader.result;
        const res = await installExtensionOrPlugin(file.name, data);
        const isPanel = res.detected.type === 'panel';

        statusEl.innerHTML = `
          <div style="background: #193822; border: 1px solid #238636; border-radius: 6px; padding: 10px; color: #7ee787; font-size: 11.5px; line-height: 1.45;">
            <strong>🎉 Successfully Installed!</strong><br>
            File: <strong>${file.name}</strong><br>
            Auto-Detected: <strong>${res.detected.typeName}</strong><br>
            Folder: <code>${res.folder}/</code><br>
            Access in: <strong>${res.detected.targetMenu}</strong>
            <div style="margin-top: 8px; display: flex; gap: 8px;">
              ${isPanel ? `<button id="ec-upload-open-now" class="ec-ext-action-btn primary">▶ Open Panel Now</button>` : ''}
              <button id="ec-upload-go-list" class="ec-ext-action-btn">View in Installed</button>
            </div>
          </div>
        `;

        if (document.getElementById('ec-upload-open-now')) {
          document.getElementById('ec-upload-open-now').addEventListener('click', () => {
            runExtensionItem(file.name, true, false);
          });
        }
        if (document.getElementById('ec-upload-go-list')) {
          document.getElementById('ec-upload-go-list').addEventListener('click', () => {
            switchExtTab('installed');
          });
        }
        refreshExtensionsList();
      } catch (err) {
        statusEl.innerHTML = `<div style="background: #3f191b; border: 1px solid #da3633; border-radius: 6px; padding: 10px; color: #f85149; font-size: 11.5px;">❌ Failed to install: ${err.message || err}</div>`;
      }
    };

    if (isBinary) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
  }

  async function refreshExtensionsList() {
    const listEl = document.getElementById('ec-ext-items-list');
    if (!listEl) return;

    listEl.innerHTML = '<div style="color: #8f929d; font-size: 11px; text-align: center; padding: 16px;">Scanning installed items...</div>';

    const itemsMap = new Map();

    // 1. Query running engine scripts
    if (window.effectcraft && window.effectcraft.execute) {
      try {
        const scriptsRes = await window.effectcraft.execute('file.scripts.list', {});
        if (Array.isArray(scriptsRes)) {
          scriptsRes.forEach(s => {
            const isPanel = !!s.panel;
            const folder = isPanel ? 'Scripts/ScriptUI Panels' : 'Scripts';
            itemsMap.set(`${folder}/${s.name}`, {
              name: s.name,
              isPanel: isPanel,
              isPlugin: false,
              folder: folder,
              source: s.source || 'installed',
              badgeClass: isPanel ? 'ec-badge-panel' : 'ec-badge-script',
              badgeText: isPanel ? 'UI Panel' : 'Script',
              canDelete: s.source === 'installed'
            });
          });
        }
      } catch (_) {}

      // Query plugins list
      try {
        const pluginsRes = await window.effectcraft.execute('effect.plugins.list', {});
        if (pluginsRes && Array.isArray(pluginsRes.plugins)) {
          pluginsRes.plugins.forEach(p => {
            const name = p.name || p.id;
            itemsMap.set(`Plug-ins/${name}`, {
              name: name,
              isPanel: false,
              isPlugin: true,
              folder: 'Plug-ins',
              source: p.source || 'installed',
              badgeClass: 'ec-badge-plugin',
              badgeText: 'Plugin',
              canDelete: p.source === 'installed'
            });
          });
        }
      } catch (_) {}
    }

    // 2. Query IndexedDB persistent entries
    try {
      if (self.indexedDB) {
        const open = indexedDB.open('effectcraft', 1);
        await new Promise((resolve) => {
          open.onsuccess = () => {
            try {
              const tx = open.result.transaction('entries', 'readonly');
              const req = tx.objectStore('entries').getAll();
              req.onsuccess = () => {
                const all = req.result || [];
                all.forEach(entry => {
                  const k = entry.key || '';
                  if (k.startsWith('config/Scripts/ScriptUI Panels/')) {
                    const name = k.replace('config/Scripts/ScriptUI Panels/', '');
                    itemsMap.set(`Scripts/ScriptUI Panels/${name}`, {
                      name: name,
                      isPanel: true,
                      isPlugin: false,
                      folder: 'Scripts/ScriptUI Panels',
                      source: 'user',
                      badgeClass: 'ec-badge-panel',
                      badgeText: 'UI Panel',
                      canDelete: true
                    });
                  } else if (k.startsWith('config/Scripts/')) {
                    const name = k.replace('config/Scripts/', '');
                    itemsMap.set(`Scripts/${name}`, {
                      name: name,
                      isPanel: false,
                      isPlugin: false,
                      folder: 'Scripts',
                      source: 'user',
                      badgeClass: 'ec-badge-script',
                      badgeText: 'Script',
                      canDelete: true
                    });
                  } else if (k.startsWith('config/Plug-ins/')) {
                    const name = k.replace('config/Plug-ins/', '');
                    itemsMap.set(`Plug-ins/${name}`, {
                      name: name,
                      isPanel: false,
                      isPlugin: true,
                      folder: 'Plug-ins',
                      source: 'user',
                      badgeClass: 'ec-badge-plugin',
                      badgeText: 'Plugin',
                      canDelete: true
                    });
                  }
                });
                resolve();
              };
              req.onerror = () => resolve();
            } catch (_) { resolve(); }
          };
          open.onerror = () => resolve();
        });
      }
    } catch (_) {}

    const items = Array.from(itemsMap.values());
    if (items.length === 0) {
      listEl.innerHTML = `
        <div style="color: #8f929d; font-size: 11px; text-align: center; padding: 24px; line-height: 1.5;">
          No extensions found yet.<br>
          Use the <strong>Upload</strong> or <strong>Code Creator</strong> tabs to add panels and tools!
        </div>
      `;
      return;
    }

    listEl.innerHTML = '';
    items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'ec-ext-item';

      card.innerHTML = `
        <div class="ec-ext-item-info">
          <div class="ec-ext-item-title">
            <span>${item.name}</span>
            <span class="ec-ext-item-badge ${item.badgeClass}">${item.badgeText}</span>
          </div>
          <div class="ec-ext-item-folder">📁 ${item.folder}/</div>
        </div>
        <div class="ec-ext-item-actions">
          <button class="ec-ext-action-btn primary ec-ext-run-btn">▶ Run</button>
          ${item.canDelete ? `<button class="ec-ext-action-btn danger ec-ext-del-btn" title="Delete">🗑️</button>` : ''}
        </div>
      `;

      card.querySelector('.ec-ext-run-btn').addEventListener('click', () => {
        runExtensionItem(item.name, item.isPanel, item.isPlugin);
      });

      const delBtn = card.querySelector('.ec-ext-del-btn');
      if (delBtn) {
        delBtn.addEventListener('click', async () => {
          if (confirm(`Delete extension "${item.name}" from ${item.folder}?`)) {
            await uninstallExtension(item.name, item.isPanel, item.isPlugin);
            refreshExtensionsList();
          }
        });
      }

      listEl.appendChild(card);
    });
  }

  function openExtensionsModal(show) {
    let modal = document.getElementById('ec-ext-modal-overlay');
    if (!modal) {
      createExtensionsModalDOM();
      modal = document.getElementById('ec-ext-modal-overlay');
    }
    extModalState.modalOpen = show;
    if (modal) {
      modal.classList.toggle('active', show);
      if (show) {
        switchExtTab(extModalState.activeTab);
      }
    }
  }

  // Expose to window for Android WebView bridge & interactive console
  window.toggleVirtualKeyboard = toggleVirtualKeyboard;
  window.showVirtualKeyboard = showVirtualKeyboard;
  window.hideVirtualKeyboard = hideVirtualKeyboard;
  window.sendVirtualKeyPress = sendKeyPress;
  window.openDpiModal = openDpiModal;
  window.openExtensionsModal = openExtensionsModal;
  window.installExtensionOrPlugin = installExtensionOrPlugin;
  window.triggerMobileFileImport = triggerMobileFileImport;

  // Initialize immediately if document.body is ready, or on DOMContentLoaded
  if (document.body) {
    createKeyboardDOM();
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createKeyboardDOM);
  } else {
    createKeyboardDOM();
  }
})();
