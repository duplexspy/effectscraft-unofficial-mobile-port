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

    // 2. Keyboard overlay container
    const kb = document.createElement('div');
    kb.id = 'ec-keyboard-container';
    kb.className = 'ec-kb-hidden';

    kb.innerHTML = `
      <div class="ec-kb-header">
        <div class="ec-kb-header-left">
          <span class="ec-kb-title">Laptop Keyboard</span>
          <div class="ec-kb-quick-actions">
            <button class="ec-kb-action-btn" data-action="undo">Undo (Ctrl+Z)</button>
            <button class="ec-kb-action-btn" data-action="redo">Redo (Ctrl+Y)</button>
            <button class="ec-kb-action-btn" data-action="save">Save (Ctrl+S)</button>
            <button class="ec-kb-action-btn" data-action="space">Play/Pause</button>
            <button class="ec-kb-action-btn" data-action="fit">Fit View</button>
          </div>
        </div>
        <div class="ec-kb-header-right">
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

    if (navigator.userAgent.includes('EffectCraftApp')) {
      floatBtn.style.display = 'none';
    }
    document.body.appendChild(floatBtn);
    document.body.appendChild(kb);

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
        } else if (action === 'space') {
          sendKeyPress(' ', 'Space', 32, false);
        } else if (action === 'fit') {
          // Shift + /
          state.shift = true;
          sendKeyPress('/', 'Slash', 191, false);
          state.shift = false;
          updateModifierUI();
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

  // Expose to window for Android WebView bridge & interactive console
  window.toggleVirtualKeyboard = toggleVirtualKeyboard;
  window.showVirtualKeyboard = showVirtualKeyboard;
  window.hideVirtualKeyboard = hideVirtualKeyboard;
  window.sendVirtualKeyPress = sendKeyPress;

  // Initialize immediately if document.body is ready, or on DOMContentLoaded
  if (document.body) {
    createKeyboardDOM();
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createKeyboardDOM);
  } else {
    createKeyboardDOM();
  }
})();
