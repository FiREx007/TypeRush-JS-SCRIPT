// ==UserScript==
// @name         TypeRush Aether Auto-Typer
// @namespace    https://greasyfork.org/en/users/your-user-id
// @version      41.0
// @description  Advanced auto-typer for TypeRush featuring canvas scraping, dynamic speed control, and a high-end glassmorphism HUD.
// @author       YourName
// @match        *://*.typerush.com/*
// @run-at       document-start
// @grant        none
// @license      MIT
// ==/UserScript==

(function() {
  'use strict';

  const isIframe = window.self !== window.top;
  const STORAGE_DELAY = 'rig_delay_ms';
  const STORAGE_USE_CUSTOM = 'rig_use_custom';
  const DEFAULT_DELAY = 20;

  // ════════════════════════════════════════════════════════════════════════════
  // IFRAME CONTEXT (Game Engine)
  // ════════════════════════════════════════════════════════════════════════════
  if (isIframe) {
    let dummyInput = null;
    const initDummy = () => {
      if (document.getElementById('rig-dummy')) return;
      dummyInput = document.createElement('input');
      dummyInput.type = 'text';
      dummyInput.id = 'rig-dummy';
      dummyInput.style.cssText = 'position:absolute; left:-9999px; top:0; opacity:0;';
      document.body.appendChild(dummyInput);
      dummyInput.focus();
    };
    if (document.body) initDummy();
    else document.addEventListener('DOMContentLoaded', initDummy);

    let currentText = "";
    let running = false;
    let timer = null;
    let index = 0;
    let delay = DEFAULT_DELAY;
    let longestSentence = "";

    const origGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, opts) {
      const ctx = origGetContext.call(this, type, opts);
      if (ctx && type === '2d' && !ctx.__rig_hooked) {
        ctx.__rig_hooked = true;
        const origFillText = ctx.fillText;
        
        ctx.fillText = function(text, x, y) {
          const t = (text + '').trim();
          
          if (t.length > 60 && !/^\d+(:\d+)?$/.test(t)) {
            const clean = t.replace(/\[.*?\]/g, '').trim();
            if (clean.length > longestSentence.length && !clean.includes("Typo!")) {
              longestSentence = clean;
              currentText = clean;
              index = 0;
              window.parent.postMessage({ type: 'RIG_TEXT', text: currentText }, '*');
            }
          }
          return origFillText.apply(this, arguments);
        };
      }
      return ctx;
    };

    const CHAR_MAP = {
      ' ':'Space', '.':'Period', ',':'Comma', '?':'Slash', "'":'Quote', '/':'Slash', ';':'Semicolon', '\\':'Backslash', '-':'Minus', '=':'Equal', '[':'BracketLeft', ']':'BracketRight', '`':'Backquote',
      '!':'Digit1','@':'Digit2','#':'Digit3','$':'Digit4','%':'Digit5','^':'Digit6','&':'Digit7','*':'Digit8','(':'Digit9',')':'Digit0',
      '_':'Minus','+':'Equal','{':'BracketLeft','}':'BracketRight','|':'Backslash',':':'Semicolon','"':'Quote','<':'Comma','>':'Period','?':'Slash','~':'Backquote'
    };

    function getKeyInfo(char) {
      let code = 'Key' + char.toUpperCase();
      let keyCode = char.toUpperCase().charCodeAt(0);
      let needsShift = false;
      
      if (char === ' ') { code = 'Space'; keyCode = 32; }
      else if (CHAR_MAP[char]) { 
        code = CHAR_MAP[char]; 
        if ('~!@#$%^&*()_+{}|:"<>?'.includes(char)) needsShift = true;
      }
      else if (char >= '0' && char <= '9') { code = 'Digit' + char; keyCode = char.charCodeAt(0); }
      else if (char >= 'A' && char <= 'Z') needsShift = true;
      
      return { key: char, code: code, keyCode: keyCode, shift: needsShift };
    }

    function fireKey(type, info, shiftKey) {
      const opts = {
        key: info.key, code: info.code, keyCode: info.keyCode, which: info.keyCode,
        charCode: type === 'keypress' ? info.keyCode : 0,
        shiftKey: shiftKey, bubbles: true, cancelable: true
      };
      if (dummyInput) dummyInput.dispatchEvent(new KeyboardEvent(type, opts));
      window.dispatchEvent(new KeyboardEvent(type, opts));
    }

    function typeChar(char) {
      let info = getKeyInfo(char);
      let shiftInfo = { key: 'Shift', code: 'ShiftLeft', keyCode: 16 };
      
      if (info.shift) fireKey('keydown', shiftInfo, true);
      fireKey('keydown', info, info.shift);
      fireKey('keypress', info, info.shift);
      fireKey('keyup', info, info.shift);
      if (info.shift) fireKey('keyup', shiftInfo, false);
    }

    function tick() {
      if (!running) return;
      if (index < currentText.length) {
        typeChar(currentText[index]);
        index++;
        if (index % 5 === 0) {
           window.parent.postMessage({ type: 'RIG_PROGRESS', current: index, total: currentText.length }, '*');
        }
      }
      timer = setTimeout(tick, delay);
    }

    window.addEventListener('message', (e) => {
      if (e.data && e.data.type === 'RIG_START') {
        if (dummyInput) dummyInput.focus();
        if (index >= currentText.length) index = 0;
        running = true;
        tick();
      }
      if (e.data && e.data.type === 'RIG_STOP') {
        running = false;
        clearTimeout(timer);
      }
      if (e.data && e.data.type === 'RIG_SPEED') {
        delay = e.data.ms;
      }
    });

  } 
  // ════════════════════════════════════════════════════════════════════════════
  // PARENT CONTEXT (User Interface)
  // ════════════════════════════════════════════════════════════════════════════
  else {
    document.addEventListener('DOMContentLoaded', () => {
      let iframe = document.getElementById('game_iframe');
      if (!iframe) return;

      let savedDelay = parseInt(localStorage.getItem(STORAGE_DELAY), 10);
      if (isNaN(savedDelay)) savedDelay = DEFAULT_DELAY;
      let useCustomDelay = localStorage.getItem(STORAGE_USE_CUSTOM) === 'true';
      let activeDelay = useCustomDelay ? savedDelay : DEFAULT_DELAY;

      let host = document.createElement('div');
      host.style.cssText = 'position:fixed;top:20px;right:20px;z-index:2147483647; transition: opacity 0.2s;';
      document.body.appendChild(host);

      let shadow = host.attachShadow({ mode: 'open' });
      shadow.innerHTML = `
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
          
          .panel { 
            width: 300px; 
            background: rgba(12, 15, 23, 0.85);
            backdrop-filter: blur(24px) saturate(150%);
            -webkit-backdrop-filter: blur(24px) saturate(150%);
            border-radius: 16px;
            border: 1px solid rgba(255, 255, 255, 0.08);
            box-shadow: 
              0 20px 50px rgba(0, 0, 0, 0.7),
              inset 0 1px 0 rgba(255, 255, 255, 0.1),
              0 0 40px rgba(0, 120, 255, 0.1);
            color: #e2e8f0;
            position: relative;
            overflow: hidden;
          }

          /* Floating background orbs */
          .panel::before, .panel::after {
            content: '';
            position: absolute;
            border-radius: 50%;
            filter: blur(40px);
            z-index: 0;
            opacity: 0.6;
            animation: float 8s ease-in-out infinite;
          }
          .panel::before {
            width: 120px; height: 120px;
            background: #00f0ff;
            top: -40px; left: -40px;
          }
          .panel::after {
            width: 150px; height: 150px;
            background: #7000ff;
            bottom: -60px; right: -40px;
            animation-delay: -4s;
          }
          @keyframes float {
            0%, 100% { transform: translateY(0) scale(1); }
            50% { transform: translateY(-20px) scale(1.1); }
          }

          /* Scanline overlay */
          .scanlines {
            position: absolute; inset: 0; z-index: 1; pointer-events: none;
            background: linear-gradient(to bottom, rgba(255,255,255,0) 50%, rgba(0,0,0,0.1) 50%);
            background-size: 100% 4px;
            opacity: 0.3;
          }

          .head { 
            padding: 16px 20px; 
            display: flex; justify-content: space-between; align-items: center;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            position: relative; z-index: 2; cursor: grab;
          }
          .head:active { cursor: grabbing; }
          .title { 
            font-weight: 800; font-size: 15px; color: #fff; letter-spacing: 2px; text-transform: uppercase;
            text-shadow: 0 0 10px rgba(0, 240, 255, 0.6);
          }
          .status-dot { width: 10px; height: 10px; border-radius: 50%; background: #00f0ff; box-shadow: 0 0 12px #00f0ff, inset 0 0 4px #fff; }
          .status-dot.off { background: #334155; box-shadow: none; }
          
          .body { padding: 20px; display: flex; flex-direction: column; gap: 16px; position: relative; z-index: 2; }
          
          .text-box { 
            background: rgba(0, 0, 0, 0.5); border: 1px solid rgba(0, 240, 255, 0.15); border-radius: 8px; padding: 14px; 
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 13px; color: #bae6fd; min-height: 60px; max-height: 90px; overflow-y: auto; line-height: 1.5;
            box-shadow: inset 0 4px 15px rgba(0,0,0,0.5); text-shadow: 0 0 8px rgba(186, 230, 253, 0.5);
          }
          .text-box::-webkit-scrollbar { width: 3px; }
          .text-box::-webkit-scrollbar-thumb { background: rgba(0, 240, 255, 0.3); }
          
          .progress-wrap { 
            height: 6px; background: rgba(0,0,0,0.6); border-radius: 3px; overflow: hidden; 
            border: 1px solid rgba(255,255,255,0.05); box-shadow: inset 0 1px 3px rgba(0,0,0,0.8);
          }
          .progress-fill { 
            height: 100%; background: linear-gradient(90deg, #00f0ff, #7000ff); width: 0%; transition: width 0.1s; 
            box-shadow: 0 0 15px #00f0ff;
          }
          
          .controls { display: flex; gap: 12px; }
          button { 
            flex: 1; padding: 14px; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; font-weight: 700; font-size: 13px; 
            cursor: pointer; transition: all 0.2s; text-transform: uppercase; letter-spacing: 1px; color: #fff; 
            background: rgba(255,255,255,0.03); backdrop-filter: blur(10px); position: relative; overflow: hidden;
          }
          button::after {
            content: ''; position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(255,255,255,0.1), transparent); opacity: 0; transition: 0.2s;
          }
          button:hover::after { opacity: 1; }
          button:active { transform: scale(0.97); }
          
          #start { box-shadow: inset 0 0 20px rgba(0, 240, 255, 0.1); border-color: rgba(0, 240, 255, 0.3); color: #00f0ff; text-shadow: 0 0 8px rgba(0, 240, 255, 0.5); }
          #start.on { background: rgba(0, 240, 255, 0.15); box-shadow: inset 0 0 20px rgba(0, 240, 255, 0.3), 0 0 20px rgba(0, 240, 255, 0.2); border-color: #00f0ff; }
          
          #stop { box-shadow: inset 0 0 20px rgba(255, 50, 50, 0.05); border-color: rgba(255, 50, 50, 0.2); color: #ff4d4d; }
          #stop:hover { background: rgba(255, 50, 50, 0.15); border-color: #ff4d4d; box-shadow: 0 0 20px rgba(255, 50, 50, 0.2); }
          
          .delay-section { display: flex; flex-direction: column; gap: 12px; background: rgba(0,0,0,0.2); padding: 14px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.03); }
          .toggle-row { display: flex; justify-content: space-between; align-items: center; }
          .toggle-label { font-size: 12px; color: #94a3b8; text-transform: uppercase; font-weight: 600; letter-spacing: 1px; }
          
          .switch { position: relative; width: 40px; height: 22px; }
          .switch input { opacity: 0; width: 0; height: 0; }
          .slider { position: absolute; inset: 0; background: rgba(255,255,255,0.05); border-radius: 22px; transition: .3s; cursor: pointer; border: 1px solid rgba(255,255,255,0.1); }
          .slider:before { content: ""; position: absolute; height: 16px; width: 16px; left: 2px; bottom: 2px; background: #64748b; border-radius: 50%; transition: .3s; }
          input:checked + .slider { background: rgba(0, 240, 255, 0.2); border-color: #00f0ff; }
          input:checked + .slider:before { transform: translateX(18px); background: #00f0ff; box-shadow: 0 0 10px #00f0ff; }
          
          .slider-row { display: flex; align-items: center; gap: 12px; transition: 0.3s; }
          .slider-row.disabled { opacity: 0.3; pointer-events: none; filter: grayscale(100%); }
          label { font-size: 12px; color: #00f0ff; text-transform: uppercase; font-weight: 600; width: 45px; }
          
          input[type=range] { flex: 1; -webkit-appearance: none; height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; outline: none; }
          input[type=range]::-webkit-slider-thumb { 
            -webkit-appearance: none; width: 16px; height: 16px; border-radius: 50%; background: #fff; cursor: grab; 
            box-shadow: 0 0 10px #00f0ff, 0 0 20px #00f0ff; border: 2px solid #00f0ff; transition: 0.1s;
          }
          input[type=range]::-webkit-slider-thumb:active { transform: scale(1.2); cursor: grabbing; }
          
          .val { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 13px; color: #00f0ff; width: 45px; text-align: right; text-shadow: 0 0 8px rgba(0, 240, 255, 0.5); }
          .stat { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11px; text-align: center; color: #64748b; margin-top: 4px; letter-spacing: 1px; }
        </style>
        
        <div class="panel">
          <div class="scanlines"></div>
          <div class="head">
            <div class="title">Aether Core</div>
            <div class="status-dot off" id="ping"></div>
          </div>
          <div class="body">
            <div class="text-box" id="text-display">Initializing stream...</div>
            <div class="progress-wrap"><div class="progress-fill" id="p-fill"></div></div>
            <div class="controls">
              <button id="start">START [→]</button>
              <button id="stop">STOP [←]</button>
            </div>
            <div class="delay-section">
              <div class="toggle-row">
                <span class="toggle-label">Manual Override</span>
                <label class="switch"><input type="checkbox" id="use-custom"><span class="slider"></span></label>
              </div>
              <div class="slider-row disabled" id="slider-row">
                <label>Delay</label>
                <input type="range" id="d" min="10" max="100" step="5" value="20">
                <span class="val" id="dv">20ms</span>
              </div>
            </div>
            <div class="stat" id="stat">IDLE [Hide ↓]</div>
          </div>
        </div>
      `;

      let $ = s => shadow.querySelector(s);
      let startBtn = $('#start'), stopBtn = $('#stop'), dInput = $('#d'), dVal = $('#dv'), stat = $('#stat'), textDisp = $('#text-display'), pFill = $('#p-fill'), ping = $('#ping');
      let customCheckbox = $('#use-custom');
      let sliderRow = $('#slider-row');

      let isRunning = false;
      let isHidden = false;

      function send(msg) {
        if (iframe.contentWindow) iframe.contentWindow.postMessage(msg, '*');
      }

      send({ type: 'RIG_SPEED', ms: activeDelay });

      startBtn.onclick = () => {
        if (isRunning) return;
        isRunning = true;
        send({ type: 'RIG_START' });
        startBtn.classList.add('on');
        startBtn.textContent = 'RUNNING';
        stat.textContent = 'Typing...';
        stat.style.color = '#00f0ff';
        ping.classList.remove('off');
      };

      stopBtn.onclick = () => {
        if (!isRunning) return;
        isRunning = false;
        send({ type: 'RIG_STOP' });
        startBtn.classList.remove('on');
        startBtn.textContent = 'START [→]';
        stat.textContent = 'Halted [Hide ↓]';
        stat.style.color = '#ff4d4d';
        ping.classList.add('off');
      };

      customCheckbox.onchange = () => {
        useCustomDelay = customCheckbox.checked;
        localStorage.setItem(STORAGE_USE_CUSTOM, useCustomDelay);
        if (useCustomDelay) {
          sliderRow.classList.remove('disabled');
          activeDelay = savedDelay;
        } else {
          sliderRow.classList.add('disabled');
          activeDelay = DEFAULT_DELAY;
        }
        send({ type: 'RIG_SPEED', ms: activeDelay });
      };

      dInput.oninput = () => {
        savedDelay = +dInput.value;
        dVal.textContent = savedDelay + 'ms';
        localStorage.setItem(STORAGE_DELAY, savedDelay);
        if (useCustomDelay) {
          activeDelay = savedDelay;
          send({ type: 'RIG_SPEED', ms: activeDelay });
        }
      };

      let isDragging = false, startX, startY, startLeft, startTop;
      $('.head').onmousedown = (e) => {
        isDragging = true;
        let rect = host.getBoundingClientRect();
        host.style.right = 'auto';
        host.style.left = rect.left + 'px';
        host.style.top = rect.top + 'px';
        startX = e.clientX;
        startY = e.clientY;
        startLeft = rect.left;
        startTop = rect.top;
      };
      document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        host.style.left = (startLeft + e.clientX - startX) + 'px';
        host.style.top = (startTop + e.clientY - startY) + 'px';
      });
      document.addEventListener('mouseup', () => isDragging = false);

      window.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        if (e.key === 'ArrowRight') { e.preventDefault(); startBtn.click(); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); stopBtn.click(); }
        else if (e.key === 'ArrowDown') {
          e.preventDefault();
          isHidden = !isHidden;
          host.style.opacity = isHidden ? '0' : '1';
          host.style.pointerEvents = isHidden ? 'none' : 'auto';
        }
      }, true);
      
      if (window.frames[0]) {
        window.frames[0].addEventListener('keydown', (e) => {
          if (e.key === 'ArrowRight') { e.preventDefault(); startBtn.click(); }
          else if (e.key === 'ArrowLeft') { e.preventDefault(); stopBtn.click(); }
          else if (e.key === 'ArrowDown') {
            e.preventDefault();
            isHidden = !isHidden;
            host.style.opacity = isHidden ? '0' : '1';
            host.style.pointerEvents = isHidden ? 'none' : 'auto';
          }
        }, true);
      }

      window.addEventListener('message', (e) => {
        let d = e.data;
        if (!d) return;
        
        if (d.type === 'RIG_TEXT') {
          textDisp.textContent = d.text;
          ping.classList.remove('off');
        }
        if (d.type === 'RIG_PROGRESS') {
          let pct = (d.current / d.total) * 100;
          pFill.style.width = pct + '%';
        }
      });
    });
  }
})();