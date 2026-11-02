// 『設定』ボタンと、その画面(音 / 言語)。2026-10-27 ユーザー指示。ゲーム画面(index.html)は上のバー(モードバー)の右端、タイトル画面は右上に置く。
// ・『音』: js/sound.js が作る音の設定画面(BGM・SEの音量とON/OFF)を開く(window.SFX_UI.open())
// ・『言語』: 日本語 / English を選ぶ(js/i18n.js の window.I18N.set)。選んだ言語は保存される
// 画面の文字は日本語で書いておき、英語のときは js/i18n.js が js/i18n_en.js の辞書で置き換える
(function () {
  'use strict';
  var STYLE = '#setPanel{position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box}' +
    '#setPanel[hidden]{display:none}' +
    '#setPanel .set-box{width:min(340px,100%);background:#16202c;color:#dfe8f2;border:2px solid #4b6078;border-radius:10px;padding:18px 18px 16px;font-size:15px;box-sizing:border-box}' +
    '#setPanel h2{margin:0 0 14px;font-size:17px;text-align:center;font-weight:bold}' +
    '#setPanel .set-btn{display:block;width:100%;min-height:46px;margin-top:10px;font-size:16px;border-radius:8px;border:2px solid #4b6078;background:#243446;color:#dfe8f2;cursor:pointer}' +
    '#setPanel .set-btn.on{background:#1f5a48;border-color:#7dfcd0;color:#fff}' +
    '#setPanel .set-sub{margin:4px 0 0;font-size:12px;color:#9fb0c2;text-align:center}' +
    '#btnSettings.set-fab{position:fixed;top:max(8px,env(safe-area-inset-top));right:max(8px,env(safe-area-inset-right));z-index:50;min-height:36px;padding:0 12px;font-size:13px;border-radius:8px;border:2px solid #4b6078;background:rgba(22,32,44,.85);color:#dfe8f2;cursor:pointer}' +
    '#modeBar #btnSettings{min-height:32px;padding:0 10px;font-size:13px;border-radius:8px;border:2px solid #4b6078;background:rgba(22,32,44,.85);color:#dfe8f2;cursor:pointer}';
  // 描画の設定(2026-11-02 ユーザー指示: 画質を段階で選ぶ・FPS(1秒に描く回数)を任意に決める)。端末ごとに保存する。main.js が読む(window.GFX.get() → {dpr, fps})
  // 画質: 描く解像度(画素比)。数字が大きいほどきれい・重い。FPS: 上限(10〜60)。下げるほど、動きは粗くなるが軽くなる
  var GFX_LEVELS = [
    { dpr: 1, label: '軽め' },
    { dpr: 1.25, label: 'やや軽め' },
    { dpr: 1.5, label: '標準' },
    { dpr: 1.75, label: 'ややキレイ' },
    { dpr: 2, label: 'キレイ' }
  ];
  var GFX_DEFAULT_Q = 2, GFX_DEFAULT_FPS = 60, GFX_FPS_MIN = 10, GFX_FPS_MAX = 60;
  function gfxStored(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function gfxSave(k, v) { try { localStorage.setItem(k, String(v)); } catch (e) { } }
  function gfxQ() {
    var q = parseInt(gfxStored('gfxQ'), 10);
    if (!(q >= 0 && q < GFX_LEVELS.length)) {   // 以前の『軽量・標準・描画優先』の保存を移す
      var old = gfxStored('gfx'); q = old === 'low' ? 0 : old === 'high' ? 4 : GFX_DEFAULT_Q;
    }
    return q;
  }
  function gfxFps() {
    var f = parseInt(gfxStored('gfxFps'), 10);
    return f >= GFX_FPS_MIN && f <= GFX_FPS_MAX ? f : GFX_DEFAULT_FPS;
  }
  window.GFX = {
    levels: GFX_LEVELS, fpsMin: GFX_FPS_MIN, fpsMax: GFX_FPS_MAX,
    get: function () { return { dpr: GFX_LEVELS[gfxQ()].dpr, fps: gfxFps() }; },
    q: gfxQ, fps: gfxFps,
    setQ: function (q) { gfxSave('gfxQ', q); window.dispatchEvent(new Event('gfxchange')); },
    setFps: function (f) { gfxSave('gfxFps', f); }   // 描く回数の上限は、次の1コマ目から効く(再描画は要らない)
  };
  // 操作画面の形(2026-11-03 試作。スマホ縦だけ効く。js/ops_tabs.js と index.html の CSS)。端末ごとに保存する
  var OPS_STYLES = [
    { key: 'classic', label: '操作方法1', sub: '元の画面です。操作を縦に並べて、スクロールして使います(今までどおり)' },
    { key: 'tabs', label: '操作方法2', sub: '下に『スイッチ・輪止め・車』のタブを固定。選んだ操作が、タブの上に出ます' },
    { key: 'drawer', label: '操作方法3', sub: '下にボタンの列だけ出します。押すと操作が開き、もう一度押すと閉じて、絵を広く見られます' }
  ];
  function opsKey() { var k = 'classic'; try { k = localStorage.getItem('opsStyle') || 'classic'; } catch (e) { } return OPS_STYLES.some(function (o) { return o.key === k; }) ? k : 'classic'; }
  function opsApply() { document.documentElement.setAttribute('data-ops', opsKey()); }
  window.OPS_STYLE = {
    styles: OPS_STYLES,
    get: opsKey,
    set: function (k) { try { localStorage.setItem('opsStyle', k); } catch (e) { } opsApply(); window.dispatchEvent(new Event('opschange')); }
  };
  opsApply();
  var panel = null, body = null, btn = null;

  function langBtn(code, label) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'set-btn' + (window.I18N && window.I18N.lang === code ? ' on' : ''); b.textContent = label;
    b.addEventListener('click', function () { if (window.I18N) window.I18N.set(code); showMenu(); });
    return b;
  }
  function showMenu() {
    body.innerHTML = '';
    var h = document.createElement('h2'); h.textContent = '設定'; body.appendChild(h);
    var snd = document.createElement('button'); snd.type = 'button'; snd.className = 'set-btn'; snd.textContent = '音';
    snd.addEventListener('click', function () { close(); if (window.SFX_UI) window.SFX_UI.open(); });
    body.appendChild(snd);
    var op = document.createElement('button'); op.type = 'button'; op.className = 'set-btn'; op.textContent = '操作画面(スマホ縦の操作の見た目)';
    op.addEventListener('click', showOps);
    body.appendChild(op);
    var gf = document.createElement('button'); gf.type = 'button'; gf.className = 'set-btn'; gf.textContent = '画面(描画の速さ・きれいさ)';
    gf.addEventListener('click', showGfx);
    body.appendChild(gf);
    var lg = document.createElement('button'); lg.type = 'button'; lg.className = 'set-btn'; lg.textContent = '言語 / Language';
    lg.addEventListener('click', showLang);
    body.appendChild(lg);
    body.appendChild(closeBtn());
  }
  function showOps() {
    body.innerHTML = '';
    var h = document.createElement('h2'); h.textContent = '操作画面'; body.appendChild(h);
    var cur = window.OPS_STYLE.get();
    window.OPS_STYLE.styles.forEach(function (o) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'set-btn' + (cur === o.key ? ' on' : ''); b.textContent = o.label;
      b.addEventListener('click', function () { window.OPS_STYLE.set(o.key); showOps(); });
      body.appendChild(b);
      var p = document.createElement('p'); p.className = 'set-sub'; p.textContent = o.sub; body.appendChild(p);
    });
    var note = document.createElement('p'); note.className = 'set-sub'; note.style.marginTop = '12px'; note.textContent = 'スマホを縦にして遊ぶ時の見た目です。パソコンや横画面は変わりません。'; body.appendChild(note);
    var back = document.createElement('button'); back.type = 'button'; back.className = 'set-btn'; back.textContent = '戻る'; back.addEventListener('click', showMenu); body.appendChild(back);
  }
  function showGfx() {
    body.innerHTML = '';
    var h = document.createElement('h2'); h.textContent = '画面(描画)'; body.appendChild(h);
    var lab = document.createElement('p'); lab.className = 'set-sub'; lab.textContent = 'きれいさ(重さ・荒さのバランス)'; body.appendChild(lab);
    var cur = window.GFX.q();
    var row = document.createElement('div'); row.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:6px';
    GFX_LEVELS.forEach(function (lv, k) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'set-btn' + (cur === k ? ' on' : ''); b.textContent = lv.label;
      b.style.marginTop = '0';
      b.addEventListener('click', function () { window.GFX.setQ(k); showGfx(); });
      row.appendChild(b);
    });
    body.appendChild(row);
    var fl = document.createElement('p'); fl.className = 'set-sub'; fl.style.marginTop = '16px'; body.appendChild(fl);
    var out = document.createElement('span');
    var rng = document.createElement('input'); rng.type = 'range'; rng.min = GFX_FPS_MIN; rng.max = GFX_FPS_MAX; rng.step = 5; rng.value = window.GFX.fps(); rng.style.cssText = 'width:100%;margin-top:6px';
    function showFps() { out.textContent = rng.value + ' fps'; fl.textContent = 'なめらかさ(1秒に描く回数の上限): '; fl.appendChild(out); }
    rng.addEventListener('input', function () { window.GFX.setFps(+rng.value); showFps(); });
    showFps(); body.appendChild(rng);
    var note = document.createElement('p'); note.className = 'set-sub'; note.textContent = '少なくすると、動きがパラパラになりますが、スマホが楽になります。'; body.appendChild(note);
    var back = document.createElement('button'); back.type = 'button'; back.className = 'set-btn'; back.textContent = '戻る'; back.addEventListener('click', showMenu); body.appendChild(back);
  }
  function showLang() {
    body.innerHTML = '';
    var h = document.createElement('h2'); h.textContent = '言語 / Language'; body.appendChild(h);
    body.appendChild(langBtn('ja', '日本語'));
    body.appendChild(langBtn('en', 'English'));
    var p = document.createElement('p'); p.className = 'set-sub'; p.textContent = '英語は準備中の文があります(未訳の文は日本語のまま表示されます)'; body.appendChild(p);
    var back = document.createElement('button'); back.type = 'button'; back.className = 'set-btn'; back.textContent = '戻る'; back.addEventListener('click', showMenu); body.appendChild(back);
  }
  function closeBtn() {
    var c = document.createElement('button'); c.type = 'button'; c.className = 'set-btn'; c.textContent = '閉じる'; c.addEventListener('click', close); return c;
  }
  function open() { showMenu(); panel.hidden = false; }
  function close() { if (panel) panel.hidden = true; }
  function build() {
    if (panel || !document.body) return;
    var st = document.createElement('style'); st.textContent = STYLE; document.head.appendChild(st);
    panel = document.createElement('div'); panel.id = 'setPanel'; panel.hidden = true;
    panel.innerHTML = '<div class="set-box" role="dialog" aria-label="設定"></div>';
    body = panel.firstChild;
    // 画面の操作(ゲームのタップ)を、設定の中で止める
    panel.addEventListener('pointerdown', function (e) { if (window.SFX_UI) { /* 音の有効化は sound.js 側が最初のタップで行う */ } e.stopPropagation(); });
    panel.addEventListener('click', function (e) { e.stopPropagation(); if (e.target === panel) close(); });
    document.body.appendChild(panel);
    var bar = document.getElementById('modeBar'), floating = !bar;
    btn = document.createElement('button');
    btn.id = 'btnSettings'; btn.type = 'button'; btn.textContent = '設定'; btn.title = '設定(音・言語)';
    if (floating) { btn.className = 'set-fab'; document.body.appendChild(btn); } else bar.appendChild(btn);
    btn.addEventListener('click', function (e) { e.stopPropagation(); open(); });
  }
  window.SETTINGS_UI = { open: function () { build(); open(); }, close: close };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
})();
