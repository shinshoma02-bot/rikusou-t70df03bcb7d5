// フロア機構の操作画面。トレーラーについている実物のスイッチ(素材)と同じものを、手元用に大きく表示する。
// トレーラー上のスイッチ(の周り)をタップすると、そのスイッチのグループの操作盤が出る(game.js → SWITCH_UI.open)。
// 操作中は、トレーラー上の同じスイッチも押した絵になり、ランプも連動する(main.jsのdrawSwitchesがfm.pressInfo()・ロック状態を見て描く)。
(function () {
  var fm = window.FLOOR_MECH;
  var statusEl = document.getElementById('floorStatus');
  var lastMsg = null, lastMsgTimer = null;

  window.FLOOR_MECH_NOTIFY = function (msg, kind) {
    if (window.SFX && kind !== 'guide') { if (kind === 'warn') window.SFX.warn(); else if (/^(PTO|エンジン|昇降メイン)/.test(msg || '') && window.SFX.switchPress) window.SFX.switchPress(); else window.SFX.click(); }   // 動力のスイッチ(PTO・エンジン・昇降メイン)は switchPress(A8)   // 効果音: できない=低いブザー、操作=カチッ
    lastMsg = msg;
    statusEl.textContent = msg;
    statusEl.style.color = kind === 'warn' ? '#ff8080' : (kind === 'guide' ? '#e8c46a' : '#9c9');
    clearTimeout(lastMsgTimer);
    lastMsgTimer = setTimeout(function () {
      lastMsg = null;
      refreshStatusLine();
    }, 1800);
  };

  function refreshStatusLine() {
    var msgs = [];
    if (!fm.atTravel('F1')) msgs.push('1番 調整中');
    if (!fm.atTravel('F2')) msgs.push('2番 調整中');
    if (!fm.atTravel('F3')) msgs.push('3番 調整中');
    if (fm.f1Connected() && fm.upperConnected()) msgs.push('1番↔2番つながり');
    if (fm.upperConnected()) msgs.push('3番↔下段(道板)つながり');
    if (!fm.MECH.ramp) msgs.push('道板 格納中(積み込み前に出す)');
    if (fm.MECH.bridge) msgs.push('4番扇動板 搬出(4番↔5番つながり)');
    if (!fm.MECH.slide) msgs.push('スライド板 格納(1番へは通れない)');
    if (fm.MECH.f2Flap) msgs.push('2番扇動板 開');
    if (fm.tireOffGround()) msgs.push('台車タイヤ浮いています');
    statusEl.textContent = msgs.length ? msgs.join(' / ') : '全て走行位置';
    statusEl.style.color = fm.upperConnected() ? '#8f8' : (msgs.length ? '#ffd080' : '#9c9');
  }

  // ---- 機構のボタン(道板・4番扇動板・ストッパー無し)は常に表示 ----
  var btnBridge = document.getElementById('btnBridge');
  btnBridge.addEventListener('click', function () { fm.toggleBridge(); renderMechButtons(); });
  var btnRamp = document.getElementById('btnRamp');
  btnRamp.addEventListener('click', function () { fm.toggleRamp(); renderMechButtons(); });
  var btnSlide = document.getElementById('btnSlide');
  btnSlide.addEventListener('click', function () { fm.toggleSlide(); renderMechButtons(); });
  var btnF2Flap = document.getElementById('btnF2Flap');
  btnF2Flap.addEventListener('click', function () { fm.toggleF2Flap(); renderMechButtons(); });
  // ---- 昇降ボタン自動切りかえ(任意でON/OFF。ブラウザに覚えさせる)----
  // 車を1台積む(固定する)と、次に動かすスイッチの操作盤へ自動で切り替わり、スイッチの真ん中へ寄る。その操作が終わると、さらに次のスイッチへ、を繰り返す。
  // 「次に動かすスイッチ」は、積んだ台数とフロア・5番・宙段フロア・タイヤの状態から決める(wantGroup)。チュートリアルでは使わない(ガイドが操作盤を切り替えるため)
  var btnAutoSw = document.getElementById('btnAutoSw');
  var autoSw = true;
  try { autoSw = localStorage.getItem('autoSwitchPanel') !== '0'; } catch (e) { }
  var isTutorial = /mode=tutorial/.test(location.hash);
  btnAutoSw.addEventListener('click', function () {
    autoSw = !autoSw;
    try { localStorage.setItem('autoSwitchPanel', autoSw ? '1' : '0'); } catch (e) { }
    renderMechButtons();
  });
  function raised(k) { return fm.ENDS[k].off <= (k === 'F3r' ? -20 : -2); }
  function wantGroup() {
    var gs = window.GAME_STATE, o = gs && gs.occupied; if (!o) return null;
    var M = fm.MECH;
    if (!(o[1] && o[2] && o[3])) {   // 上段(1・2・3番)を積んでいる間: 道板につなぐ(3番 後)→ 1番へ渡れるようにする(前側)
      if (!fm.upperConnected()) return 'rear';
      if (!o[1] && !fm.f1Connected()) return 'front';
      return null;
    }
    if (!['F1f', 'F1r', 'F2f'].every(raised)) return 'front';   // 下段へ入れるよう、フロアを上げてピンで固定
    if (!['MID', 'F3r'].every(raised)) return 'rear';
    if (!o[4]) return fm.f5Slope() ? null : 'front';   // 4番: 5番フロアをスロープに(2番 前のシリンダー)
    if (!o[5]) return fm.atTravel('F5') ? null : 'front';
    if (!o[6]) return null;
    if (!o[7] && M.hang < 1) return 'rear';   // 7台目: 宙段フロア
    return M.tireOut ? 'tire' : null;
  }
  var chain = false, lastCount = -1, lastSwitchAt = 0;
  setInterval(function () {
    if (!autoSw || isTutorial) return;
    var gs = window.GAME_STATE; if (!gs || !gs.occupied) return;
    var n = Object.keys(gs.occupied).filter(function (k) { return gs.occupied[k]; }).length;
    if (lastCount >= 0 && n > lastCount) chain = true;   // 1台積んだ(固定した)ので、次のスイッチへの切り替えを始める
    lastCount = n;
    if (!chain) return;
    var g = wantGroup();
    if (!g) { chain = false; return; }
    var pr = fm.pressInfo && fm.pressInfo();
    if (pr && (pr.hold || pr.hang || pr.jack)) return;   // 押している間は切り替えない
    if (g !== current && Date.now() - lastSwitchAt > 700) {
      lastSwitchAt = Date.now();
      open(g);
    }
  }, 500);
  // ---- 扇動板・スライド板・道板のアイコン(2026-10-31 ユーザー指示: 作った画像ではなく、ゲームの絵にする)----
  // 4番扇動板・2番扇動板・5番のピンは、ゲームの部品の絵(assets/semi-6/parts)をそのまま使う。スライド板・道板は、ゲームの中でコードで描いている板(main.js の drawSlidePlate・drawRampPlate)と同じ色・形で、小さな絵を描く(道板は長いので、一部を切り取った形)
  var PARTS = 'assets/semi-6/parts/';
  function drawnIcon(w, h, draw) {
    var c = document.createElement('canvas'); c.width = w * 2; c.height = h * 2;
    var g = c.getContext('2d'); g.scale(2, 2); draw(g, w, h);
    return c.toDataURL('image/png');
  }
  function slideIconSrc() {   // 緑の網の床・側面の枠・先端の赤い帯
    return drawnIcon(56, 22, function (g, w, h) {
      var x = 1.5, y = 5, len = w - 3, th = 13, mesh = 4;
      g.fillStyle = '#9fe9dc'; g.fillRect(x, y, len, mesh);
      g.strokeStyle = 'rgba(20,90,80,0.75)'; g.lineWidth = 1;
      g.save(); g.beginPath(); g.rect(x, y, len, mesh); g.clip(); g.beginPath();
      for (var d = -mesh; d < len; d += 5) { g.moveTo(x + d, y + mesh); g.lineTo(x + d + mesh, y); g.moveTo(x + d + mesh, y + mesh); g.lineTo(x + d, y); }
      g.stroke(); g.restore();
      var gr = g.createLinearGradient(0, y + mesh, 0, y + th); gr.addColorStop(0, '#5fe3cd'); gr.addColorStop(0.45, '#2cc9b0'); gr.addColorStop(1, '#138d7b');
      g.fillStyle = gr; g.fillRect(x, y + mesh, len, th - mesh);
      g.fillStyle = '#e2574c'; g.fillRect(x + len - 9, y, 9, th);
      g.strokeStyle = '#0d2b27'; g.lineWidth = 1.2; g.strokeRect(x, y, len, th);
    });
  }
  function rampIconSrc() {   // 銀色の道板(縞の滑り止め)。長いので、斜めに置いた板の一部を切り取った形
    return drawnIcon(48, 48, function (g, w, h) {
      g.save(); g.translate(-6, 14); g.rotate(16 * Math.PI / 180);
      var len = 80, th = 15, grad = g.createLinearGradient(0, 0, 0, th);
      grad.addColorStop(0, '#e3e8eb'); grad.addColorStop(0.35, '#b7c0c5'); grad.addColorStop(1, '#6d767c');
      g.fillStyle = grad; g.fillRect(0, 0, len, th);
      g.save(); g.beginPath(); g.rect(0, 0, len, th); g.clip();
      g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 1.5;
      for (var x = 6; x < len; x += 9) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, th); g.stroke(); }
      g.restore();
      g.strokeStyle = '#2c3135'; g.lineWidth = 1.4; g.strokeRect(0, 0, len, th);
      g.restore();
    });
  }
  (function () {   // 道板ボタンのアイコン(画面の「道板を出す」)も、ゲームの絵にする
    var st = document.createElement('style'); st.textContent = '#btnRamp::before { background-image: url(' + rampIconSrc() + ') !important; }';
    document.head.appendChild(st);
  })();
  // 扇動板・スライド板のカード(前側の操作盤の中。押すと動き、開いたまま操作できる)。「上段フロア」= スライド板・2番扇動板 / 「下段フロア」= 4番扇動板・5番のピン を、2個ずつ横に並べる(2026-10-31 ユーザー指示)
  var plateBtns = [];
  function plateCard() {
    var card = document.createElement('div');
    card.className = 'swCard plateCard';
    plateBtns = [
      { key: 'slide', group: 0, icon: function () { return '<img class="plateIcon" alt="" src="' + slideIconSrc() + '" style="width:56px;height:22px">'; }, label: function () { return fm.MECH.slide ? 'スライド板を格納' : 'スライド板を搬出'; }, on: function () { return fm.MECH.slide; }, run: fm.toggleSlide },
      { key: 'flap2', group: 0, icon: function () { return '<img class="plateIcon" alt="" src="' + PARTS + 'flap_f2_open.png?v=1" style="width:36px;height:35px">'; }, label: function () { return fm.MECH.f2Flap ? '2番扇動板を閉じる' : '2番扇動板を開く'; }, on: function () { return fm.MECH.f2Flap; }, run: fm.toggleF2Flap },
      { key: 'bridge', group: 1, icon: function () { return '<span class="plateIconRow"><img alt="" src="' + PARTS + 'flap_f4_base.png?v=1"><img alt="" src="' + PARTS + 'flap_f4_mid.png?v=1"><img alt="" src="' + PARTS + 'flap_f4_tip.png?v=1"></span>'; }, label: function () { return fm.MECH.bridge ? '4番扇動板を格納' : '4番扇動板を搬出'; }, on: function () { return fm.MECH.bridge; }, run: fm.toggleBridge },
      // 5番のスロープのピン(赤いレバー)。画面の赤いレバーは小さくて触りにくい、というレビューがあったので、ボタンでも操作できるようにした(2026-10-31)。「on」=ピンが出ている(掛かっている)。絵はゲームのレバー(掛かっている時は下、外れている時は上)
      { key: 'stopper', group: 1, iconSrc: function () { return PARTS + 'slope_latch_bar' + (fm.MECH.stopper ? '' : '_up') + '.png?v=1'; }, icon: function () { return '<img class="plateIcon" alt="" src="' + this.iconSrc() + '" style="width:66px;height:40px">'; }, label: function () { return fm.MECH.stopper ? '5番のピンを外す' : '5番のピンを戻す'; }, on: function () { return fm.MECH.stopper; }, run: fm.toggleStopper }
    ];
    ['上段フロア', '下段フロア'].forEach(function (name, gi) {
      var grp = document.createElement('div'); grp.className = 'plateGroup';
      var lab = document.createElement('div'); lab.className = 'swLabel'; lab.textContent = name; grp.appendChild(lab);
      var row = document.createElement('div'); row.className = 'plateRow'; grp.appendChild(row);
      plateBtns.filter(function (it) { return it.group === gi; }).forEach(function (it) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'plateBtn'; b.setAttribute('data-plate', it.key);   // data-plate: チュートリアルのガイドが指す目印
        b.innerHTML = '<span class="plateIconBox">' + it.icon() + '</span><span class="plateText"></span>';
        b.addEventListener('click', function () { it.run(); renderMechButtons(); });
        row.appendChild(b);
        it.el = b;
      });
      card.appendChild(grp);
    });
    renderPlate();
    return card;
  }
  function renderPlate() {
    plateBtns.forEach(function (it) {
      if (!it.el) return;
      it.el.querySelector('.plateText').textContent = it.label();
      if (it.iconSrc) { var im = it.el.querySelector('img'), src = it.iconSrc(); if (im && im.getAttribute('src') !== src) im.setAttribute('src', src); }
      it.el.classList.toggle('on', !!it.on());
    });
  }
  setInterval(renderPlate, 500);
  function renderMechButtons() {
    btnAutoSw.textContent = '昇降ボタン自動切りかえ ' + (autoSw ? 'ON' : 'OFF');
    btnAutoSw.classList.toggle('on', autoSw);
    btnBridge.textContent = fm.MECH.bridge ? '4番扇動板を格納' : '4番扇動板を搬出';
    btnBridge.classList.toggle('on', fm.MECH.bridge);
    btnRamp.textContent = fm.MECH.ramp ? '道板をしまう' : '道板を出す';
    btnRamp.classList.toggle('on', fm.MECH.ramp);
    btnSlide.textContent = fm.MECH.slide ? 'スライド板を格納' : 'スライド板を搬出';
    btnSlide.classList.toggle('on', fm.MECH.slide);
    btnF2Flap.textContent = fm.MECH.f2Flap ? '2番扇動板を閉じる' : '2番扇動板を開く';
    btnF2Flap.classList.toggle('on', fm.MECH.f2Flap);
    // 扇動板・スライド板は、全てのモードで、前側のスイッチ(1番・2番前)を開いた操作盤の中から操作する(常駐ボタンは出さない。2026-10-27 チュートリアルも同じ)
    [btnBridge, btnSlide, btnF2Flap].forEach(function (b) { b.style.display = 'none'; });
    renderPlate();
  }

  // ---- 動力(D43): エンジン・PTO・昇降メインスイッチ。ノーマル・ハードだけ操作が必要(イージー・シミュレーションでは、常に ON として扱い、行ごと隠す)----
  var btnEngine = document.getElementById('btnEngine'), btnPto = document.getElementById('btnPto'), btnMain = document.getElementById('btnMain'), powerRow = document.getElementById('powerRow');
  var PWD = 'assets/common/switches/';
  function pwIcon(name) { return '<img src="' + PWD + name + '.png?v=1" alt="" style="height:22px;vertical-align:middle;margin-right:6px;pointer-events:none">'; }
  function renderPower() {
    if (!fm.powerState || !powerRow) return;
    var s = fm.powerState();
    powerRow.style.display = s.required ? '' : 'none';
    if (!s.required) return;
    btnEngine.innerHTML = pwIcon(s.engine ? 'lamp_amber' : 'lamp_amber_off') + (s.engine ? 'エンジン 停止' : 'エンジン 始動');
    btnPto.innerHTML = pwIcon(s.pto ? 'sw_toggle_pto_on' : 'sw_toggle_pto_off') + 'PTO ' + (s.pto ? 'ON' : 'OFF');
    btnMain.innerHTML = pwIcon(s.main ? 'sw_toggle_main_on' : 'sw_toggle_main_off') + '昇降メイン ' + (s.main ? 'ON' : 'OFF');
    btnEngine.classList.toggle('on', s.engine); btnPto.classList.toggle('on', s.pto); btnMain.classList.toggle('on', s.main);
  }
  if (btnEngine) {
    btnEngine.addEventListener('click', function () { fm.setPower('engine', !fm.powerState().engine); renderPower(); });
    btnPto.addEventListener('click', function () { fm.setPower('pto', !fm.powerState().pto); renderPower(); });
    btnMain.addEventListener('click', function () { fm.setPower('main', !fm.powerState().main); renderPower(); });
    setInterval(renderPower, 400);
  }

  // ---- スイッチ操作盤 ----
  var SWD = 'assets/common/switches/', V = '?v=3';
  // グループ(トレーラー上のスイッチの固まり)ごとに、載せるスイッチ。end=フロアの端 / jack=ジャッキ / tire=6ボタンとランプ盤
  var GROUPS = {
    front: { title: '前側のスイッチ(1番・2番)', items: [{ label: '1番 前', end: 'F1f' }, { label: '1番 後', end: 'F1r' }, { label: '2番 前', end: 'F2f' }] },
    rear: { title: '後ろ側のスイッチ(3番・宙段フロア)', items: [{ label: '3番 前(継ぎ目)', end: 'MID' }, { label: '3番 後', end: 'F3r' }, { label: '宙段フロア', end: 'F7' }, { label: '宙段フロア 後ろの柱', rearPin: true }] },
    // ジャッキとスライド車軸の伸ばし(6ボタン・ランプ盤)は、一緒に操作する(タイヤを張り出す・戻す時にジャッキも使うため)
    tire: { title: 'ジャッキとタイヤ操作盤', tire: true, items: [{ label: 'ジャッキ', jack: true }] }
  };
  var swPanel = document.getElementById('swPanel'), floorTitle = document.getElementById('floorTitle'), swHint = document.getElementById('swHint');
  var current = null, tireLamps = null;
  var PEND2 = 1.5, SIX = 1.25;  // 手元用の拡大率(素材は等倍で表示すると小さいので、拡大して見やすく)

  function box(w, h, sc) { var d = document.createElement('div'); d.style.cssText = 'position:relative;width:' + w * sc + 'px;height:' + h * sc + 'px;flex:none;'; return d; }
  function img(name, cx, cy, w, h, piv, sc) {
    var i = document.createElement('img');
    i.src = SWD + name + '.png' + V; i.draggable = false;
    var retry = 0; i.onerror = function () { if (retry < 4) { retry++; setTimeout(function () { i.src = SWD + name + '.png' + V + '&r=' + retry; }, 400 * retry); } };
    i.style.cssText = 'position:absolute;width:' + w * sc + 'px;height:' + h * sc + 'px;left:' + (cx - piv[0]) * sc + 'px;top:' + (cy - piv[1]) * sc + 'px;user-select:none;-webkit-user-drag:none;image-rendering:auto;';
    return i;
  }
  // 押している間だけ押した絵にして、押した瞬間にdown()・離したらup()を呼ぶキャップ
  function pressable(el, name, down, up) {
    el.style.cursor = 'pointer';
    var on = false;
    function d(e) { e.preventDefault(); if (on) return; on = true; el.src = SWD + name + '_pressed.png' + V; down(); }
    function u() { if (!on) return; on = false; el.src = SWD + name + '.png' + V; up(); }
    el.addEventListener('mousedown', d); el.addEventListener('touchstart', d, { passive: false });
    ['mouseup', 'mouseleave', 'touchend', 'touchcancel'].forEach(function (ev) { el.addEventListener(ev, u); });
  }

  // 2ボタン押ボタン(上・下)。押している間、そのフロア(ジャッキ・宙段フロア)が動く
  // 後ろの柱(宙段フロア): シリンダーのように、押している間だけ連続で伸び縮みする(2026-10-08 ユーザー指示。以前は内側パイプの穴にピンを差す6段階)
  function rearPinCard(item) {
    var card = document.createElement('div'); card.className = 'swCard';
    var lab = document.createElement('div'); lab.className = 'swLabel'; lab.textContent = item.label; card.appendChild(lab);
    var row = document.createElement('div'); row.className = 'pinRow';
    var m = document.createElement('button'); m.className = 'pinStep'; m.textContent = '縮';
    var p = document.createElement('button'); p.className = 'pinBtn on'; p.id = 'rearPinLabel';
    var pl = document.createElement('button'); pl.className = 'pinStep'; pl.textContent = '伸';
    function hold(btn, dir) {
      var iv = null, last = 0;
      function stop() { if (iv) { clearInterval(iv); iv = null; } renderRearPin(); }
      btn.addEventListener('pointerdown', function (e) {
        e.preventDefault(); if (iv) return; last = performance.now();
        iv = setInterval(function () { var n = performance.now(); var ok = fm.rearLenStep(dir, Math.min(0.1, (n - last) / 1000)); last = n; renderRearPin(); if (!ok) stop(); }, 40);
      });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { btn.addEventListener(ev, stop); });
    }
    hold(m, -1); hold(pl, +1);
    row.appendChild(m); row.appendChild(p); row.appendChild(pl); card.appendChild(row);
    var note = document.createElement('div'); note.style.cssText = 'font-size:12px;color:#aab;line-height:1.5;margin-top:6px;max-width:150px;';
    note.textContent = '押している間、後ろの柱が伸び縮み(縮=スロープが急に・伸=ゆるやかに)。宙段フロアが格納〜スロープの位置の時だけ'; card.appendChild(note);
    setTimeout(renderRearPin, 0);
    return card;
  }
  function renderRearPin() {
    var b = document.getElementById('rearPinLabel'), r = fm.rearLenRange ? fm.rearLenRange() : [0, 1];
    if (b) b.textContent = '柱 ' + Math.round(fm.rearPinLen() / window.TRAILER_CONFIG.pxPerMeter * 100) + 'cm';
  }
  // フレーム側の固定ピン(赤い板): 位置を前後5段階で変える・抜き差し。刺してあると、上げた宙段フロアのフロアがピンに当たって止まる
  function stopPinCard(item) {
    var card = document.createElement('div'); card.className = 'swCard';
    var lab = document.createElement('div'); lab.className = 'swLabel'; lab.textContent = item.label; card.appendChild(lab);
    var row = document.createElement('div'); row.className = 'pinRow';
    var m = document.createElement('button'); m.className = 'pinStep'; m.textContent = '−';
    var p = document.createElement('button'); p.className = 'pinBtn'; p.id = 'stopPinLabel';
    var pl = document.createElement('button'); pl.className = 'pinStep'; pl.textContent = '＋';
    m.addEventListener('click', function () { fm.setStopPinHole(fm.stopPin.hole - 1); renderStopPin(); });
    pl.addEventListener('click', function () { fm.setStopPinHole(fm.stopPin.hole + 1); renderStopPin(); });
    p.addEventListener('click', function () { fm.toggleStopPin(); renderStopPin(); });
    row.appendChild(m); row.appendChild(p); row.appendChild(pl); card.appendChild(row);
    var note = document.createElement('div'); note.style.cssText = 'font-size:12px;color:#aab;line-height:1.5;margin-top:6px;max-width:150px;';
    note.textContent = '−/＋で位置(前→後ろ)。ピンの位置で宙段フロアの止まる高さが変わる。中央のボタンで抜く/刺す(位置の変更はスロープより下げてから)'; card.appendChild(note);
    return card;
  }
  function renderStopPin() {
    var b = document.getElementById('stopPinLabel');
    if (!b) return;
    b.textContent = (fm.stopPin.inserted ? '抜く' : '刺す') + '(' + fm.stopPin.hole + '/' + fm.stopPinHoles + ')';
    b.classList.toggle('on', fm.stopPin.inserted);
  }
  function pendant2Card(item) {
    if (item.rearPin) return rearPinCard(item);
    if (item.stopPin) return stopPinCard(item);
    var card = document.createElement('div');
    card.className = 'swCard';
    var lab = document.createElement('div'); lab.className = 'swLabel'; lab.textContent = item.label; card.appendChild(lab);
    var b = box(44, 105, PEND2); b.appendChild(img('sw_pendant2', 0, 0, 44, 105, [0, 0], PEND2));
    function startHold(dir) { if (window.SFX && window.SFX.switchPress) window.SFX.switchPress(); if (item.jack) fm.jackHoldStart(dir); else fm.holdStart(item.end, dir); }   // 昇降スイッチを押した音(A8)
    function stopHold() { if (item.jack) fm.jackHoldStop(); else fm.holdStop(); }
    // 上=▲(-1。フロアは上がる)/ 下=▼(+1)。ジャッキは 上=ジャッキを上げる(脚が伸びる=+1)・下=縮める(-1)
    var up = img('btn_cap_ue_big', 22, 26, 18, 18, [9, 9], PEND2), down = img('btn_cap_shita_big', 22, 44, 18, 18, [9, 9], PEND2);
    // ジャッキは、▲=ジャッキを上げる(脚が伸びる=+1)・▼=下げる(脚が縮む=-1)(2026-10-20 ユーザー指示。以前は逆だった)
    up.dataset.sw = 'up'; down.dataset.sw = 'down';   // data-sw: チュートリアルのガイドが、押すボタンを指す目印(up/down/pin/minus/plus、タイヤ操作盤は caps の名前)
    pressable(up, 'btn_cap_ue_big', function () { startHold(item.jack ? 1 : -1); }, stopHold);
    pressable(down, 'btn_cap_shita_big', function () { startHold(item.jack ? -1 : 1); }, stopHold);
    b.appendChild(up); b.appendChild(down);
    card.appendChild(b);
    if (item.end === 'F7') {   // 宙段フロア: セットピンは廃止。真ん中のボタンはフレーム側の固定ピン(赤い板)の抜き差し、−/＋はその位置(前→後ろ5段階)
      var row7 = document.createElement('div'); row7.className = 'pinRow';
      var m7 = document.createElement('button'); m7.className = 'pinStep'; m7.textContent = '−';
      var p7 = document.createElement('button'); p7.className = 'pinBtn'; p7.id = 'stopPinLabel'; p7.dataset.sw = 'pin'; m7.dataset.sw = 'minus';
      var pl7 = document.createElement('button'); pl7.className = 'pinStep'; pl7.textContent = '＋'; pl7.dataset.sw = 'plus';
      m7.addEventListener('click', function () { fm.setStopPinHole(fm.stopPin.hole - 1); renderStopPin(); });
      pl7.addEventListener('click', function () { fm.setStopPinHole(fm.stopPin.hole + 1); renderStopPin(); });
      p7.addEventListener('click', function () { fm.toggleStopPin(); renderStopPin(); });
      row7.appendChild(m7); row7.appendChild(p7); row7.appendChild(pl7);
      card.appendChild(row7);
    } else if (item.end) {
      var row = document.createElement('div'); row.className = 'pinRow';
      var m = document.createElement('button'); m.className = 'pinStep'; m.dataset.pin = item.end; m.dataset.d = '-1'; m.dataset.sw = 'minus'; m.textContent = '−';
      var p = document.createElement('button'); p.className = 'pinBtn'; p.dataset.pin = item.end; p.dataset.sw = 'pin'; p.textContent = 'ピン';
      var pl = document.createElement('button'); pl.className = 'pinStep'; pl.dataset.pin = item.end; pl.dataset.d = '1'; pl.dataset.sw = 'plus'; pl.textContent = '＋';
      m.addEventListener('click', function () { fm.stepPinTarget(item.end, -1); renderPinButtons(); });
      pl.addEventListener('click', function () { fm.stepPinTarget(item.end, 1); renderPinButtons(); });
      p.addEventListener('click', function () { fm.togglePin(item.end); renderPinButtons(); });
      row.appendChild(m); row.appendChild(p); row.appendChild(pl);
      card.appendChild(row);
    }
    return card;
  }

  // タイヤ操作盤: 表示ランプ盤(作業/右ロック/左ロック)+6ボタン(伸/縮/右押/右引/左押/左引)
  function tireCard() {
    var wrap = document.createElement('div');
    wrap.className = 'swCard tire';
    var lampBox = box(38, 108, SIX); lampBox.appendChild(img('lamp_panel_lock', 0, 0, 38, 108, [0, 0], SIX));
    tireLamps = [['lamp_red', 16, 16], ['lamp_green', 16, 48], ['lamp_green', 16, 80]].map(function (l) {
      var i = img(l[0] + '_off', l[1], l[2], 18, 18, [9, 9], SIX); i.dataset.on = l[0]; lampBox.appendChild(i); return i;
    });
    var pend = box(54, 211, SIX); pend.appendChild(img('sw_pendant6', 0, 0, 54, 211, [0, 0], SIX));
    var caps = [['nobi', function () { fm.moveTire('out'); }], ['chiji', function () { fm.moveTire('in'); }], ['migi_oshi', function () { fm.setLock('R', true); }], ['migi_hiki', function () { fm.setLock('R', false); }], ['hidari_oshi', function () { fm.setLock('L', true); }], ['hidari_hiki', function () { fm.setLock('L', false); }]];
    caps.forEach(function (c, k) {
      var el = img('btn_cap6_' + c[0] + '_big', 27, 28 + 24 * k, 22, 22, [11, 11], SIX);
      el.dataset.sw = c[0];
      pressable(el, 'btn_cap6_' + c[0] + '_big', function () { fm.MECH.press6 = k; c[1](); }, function () { fm.MECH.press6 = -1; });
      pend.appendChild(el);
    });
    var row = document.createElement('div'); row.style.cssText = 'display:flex;gap:16px;align-items:flex-start;';
    row.appendChild(lampBox); row.appendChild(pend);
    var cap = document.createElement('div');
    cap.style.cssText = 'font-size:12px;color:#aab;line-height:1.7;max-width:240px;';
    cap.innerHTML = '<b>スライド車軸の操作(伸・縮)</b><br>① ジャッキを伸ばす(ジャッキ)<br>② 右引・左引でロック解除<br>③ 伸/縮<br>④ 右押・左押でロック<br>⑤ ジャッキを縮める<br><br>ランプ: 作業=解除済みでタイヤが浮いている / 右・左ロック=ロック中';
    cap.style.maxWidth = 'none'; cap.style.margin = '8px 0 0';
    wrap.help = cap;   // 説明文は、ジャッキと横に並べるため、カードの外(パネルの下)に出す
    wrap.appendChild(row);
    return wrap;
  }

  function open(id) {
    var g = GROUPS[id];
    if (!g) return;
    current = id;
    swPanel.innerHTML = '';
    tireLamps = null;
    floorTitle.textContent = g.title;
    swHint.style.display = 'none';
    var cards = document.createElement('div'); cards.className = 'swCards';
    g.items.forEach(function (it) { cards.appendChild(pendant2Card(it)); });
    var tc = null;
    if (g.tire) { tc = tireCard(); cards.appendChild(tc); }
    swPanel.appendChild(cards);
    if (tc && tc.help) swPanel.appendChild(tc.help);
    if (id === 'front') cards.appendChild(plateCard());   // 1番・2番前のスイッチの横に、扇動板・スライド板のボタン(2026-10-21)
    renderPinButtons(); renderRearPin(); renderStopPin();
    // (以前は、操作盤へ画面を自動でスクロールしていたが、ストレスになるのでやめた。ユーザー指示 2026-10-15)
  }
  function close() {
    current = null; tireLamps = null;
    swPanel.innerHTML = '';
    floorTitle.textContent = 'スイッチ操作';
    swHint.style.display = '';
  }
  document.getElementById('btnSwClose').addEventListener('click', function () { chain = false; close(); if (window.VIEW && window.VIEW.restoreView) window.VIEW.restoreView(); });
  // 画面から(スイッチをタップして)自分で開いた時は、自動切りかえを止める(次の車を積むまで、元のスイッチへ戻さない)。自動で次に開くはずのスイッチを自分で開いた時だけ、続ける
  function userOpen(id) { if (!(chain && id === wantGroup())) chain = false; open(id); }
  window.SWITCH_UI = { open: userOpen, close: close, get current() { return current; } };

  function renderPinButtons() {
    document.querySelectorAll('#swPanel .pinBtn[data-pin]').forEach(function (btn) {
      var k = btn.dataset.pin;
      var on = fm.PINS[k] !== null;
      btn.textContent = on ? ('抜く(' + fm.holeNo(k, fm.PINS[k]) + ')') : ('ピン' + fm.pinTarget(k));
      btn.classList.toggle('on', on);
      var floating = on && !fm.rested(k);   // ピンは差してあるが、フロアがまだピンに載っていない(▼で載せる)
      btn.classList.toggle('float', floating);
      btn.title = floating ? 'ピンは差してあります。フロアがまだピンに載っていません(▼で、フロアをピンに載せてください)' : '';
    });
  }
  function updateTirePanel() {
    if (!tireLamps) return;
    var on = [fm.workReady(), fm.MECH.lockR, fm.MECH.lockL];
    tireLamps.forEach(function (el, i) {
      var name = el.dataset.on + (on[i] ? '' : '_off');
      if (el.dataset.cur !== name) { el.dataset.cur = name; el.src = SWD + name + '.png' + V; }
    });
  }

  function tick() {
    if (current) { renderPinButtons(); updateTirePanel(); renderStopPin(); }
    renderMechButtons();
    if (!lastMsg) refreshStatusLine();
    requestAnimationFrame(tick);
  }
  renderMechButtons();
  refreshStatusLine();
  requestAnimationFrame(tick);
})();
