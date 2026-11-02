// 操作パネルの形(2026-11-03)。設定 →『操作画面』で選ぶ。ゲーム画面の見た目は index.html の CSS(縦の狭い画面だけ)。
//  classic(元の画面): 操作を縦に並べて、スクロールして使う(今までどおり)
//  tabs(案1): 下に『スイッチ・輪止め・車』のタブを固定。選んだものだけ、タブの上に出る
//  drawer(案2): 下にボタンの列だけ出す。押すと、その操作がせり上がって開く。もう一度押すか閉じると、絵が広く見える
// 切り替えは、window.OPS_TAB('floor' | 'chock' | 'car') で行う(自動の切り替えにも使う)。window.OPS_TAB_OF(要素) は、その要素がどのタブにあるかを返す。
(function () {
  var SECTIONS = { floor: 'floorPanel', chock: 'chockPanel', car: 'controls' };
  function opsEl() { return document.getElementById('opsPanel'); }
  function style() { return document.documentElement.getAttribute('data-ops') || 'classic'; }
  function paint(t) {
    var bs = document.querySelectorAll('#opsTabs [data-ops-tab]');
    for (var i = 0; i < bs.length; i++) bs[i].classList.toggle('on', bs[i].getAttribute('data-ops-tab') === t);
  }
  // t: 切り替える先。open: 開くか(案2で、同じ所を押したら閉じる)。案1・元の画面では、いつも開いた状態
  function sync(t, open) {
    var o = opsEl(); if (!o) return;
    o.setAttribute('data-tab', t);
    if (style() === 'drawer') o.setAttribute('data-open', open ? '1' : '0');
    else o.setAttribute('data-open', '1');
    paint(t);
  }
  window.OPS_TAB = function (t) { if (SECTIONS[t]) sync(t, true); };
  window.OPS_TAB_OF = function (el) {   // 要素が、どのタブの中にあるか(無ければ null)
    for (var k in SECTIONS) { var s = document.getElementById(SECTIONS[k]); if (s && el && s.contains(el)) return k; }
    return null;
  };
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('#opsTabs [data-ops-tab]') : null;
    if (!b) return;
    e.stopPropagation();
    var t = b.getAttribute('data-ops-tab'), o = opsEl();
    var isOpen = o && o.getAttribute('data-open') === '1', same = o && o.getAttribute('data-tab') === t;
    if (style() === 'drawer' && isOpen && same) sync(t, false);   // 案2: 開いている同じタブを押すと閉じる
    else sync(t, true);
  }, true);
})();
