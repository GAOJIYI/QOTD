/* 每日一个为什么 · 测验页逻辑（v2 单选 + 陷阱干扰项 + 逐项解析）
 * 数据来源：同目录 quiz.json
 * 玩法：选一个 → 当场亮对错 + 每个选项的解析自动展开 → 再来一题
 */
(function () {
  "use strict";

  var QUIZ_URL = "quiz.json";
  var STORE_KEY = "daily-why-quiz-progress";
  var items = [];
  var current = null;

  function esc(s) {
    return (s || "").replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function todayKey() {
    var d = new Date();
    return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  }
  function loadProgress() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || "{}"); } catch (e) { return {}; }
  }
  function saveProgress(p) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(p)); } catch (e) {}
  }
  function bumpStats(correct) {
    var p = loadProgress(), k = todayKey();
    if (!p[k]) p[k] = { done: 0, right: 0 };
    p[k].done = (p[k].done || 0) + 1;
    p[k].right = p[k].right || 0;
    if (correct) p[k].right += 1;
    saveProgress(p);
    paintStats();
  }
  function paintStats() {
    var p = loadProgress(), k = todayKey();
    var s = p[k] || { done: 0, right: 0 };
    s.done = s.done || 0; s.right = s.right || 0;
    var el = document.getElementById("today-count");
    if (el) el.textContent = "今日 " + s.done + " / " + items.length + " · 正确 " + s.right;
  }

  var DECK_KEY = "daily-why-quiz-deck";
  function getDeck() {
    var ids = items.map(function (it) { return it.id; });
    try {
      var raw = sessionStorage.getItem(DECK_KEY);
      var d = raw ? JSON.parse(raw) : null;
      if (Array.isArray(d) && d.length) {
        return d.filter(function (id) { return ids.indexOf(id) !== -1; });
      }
    } catch (e) {}
    return shuffle(ids);
  }
  function saveDeck(d) {
    try { sessionStorage.setItem(DECK_KEY, JSON.stringify(d)); } catch (e) {}
  }
  function pick() {
    var deck = getDeck();
    if (!deck.length) deck = shuffle(items.map(function (it) { return it.id; }));
    var id = deck.pop();
    saveDeck(deck);
    return items.filter(function (it) { return it.id === id; })[0];
  }

  function render() {
    current = pick();
    var opts = shuffle((current.options || []).slice());
    var optHtml = opts.map(function (o, i) {
      return '<button class="opt" data-i="' + i + '" data-correct="' + (o.correct ? "1" : "0") + '">' +
        '<span class="opt-text">' + esc(o.text) + "</span>" +
        '<span class="opt-why" hidden>' + esc(o.why) + "</span>" +
        "</button>";
    }).join("");

    document.getElementById("quiz-card").innerHTML =
      '<div class="qmeta">' +
        '<a class="qissue qissue-link" href="article.html?id=' + ("00" + (current.issue || "")).slice(-3) + '" target="_blank" rel="noopener">第 ' + (current.issue || "?") + " 期 · " + esc(current.issueTitle || "") + " ↗</a>" +
        '<span class="qtype">' + esc(current.type || "题") + "</span>" +
      "</div>" +
      '<p class="qtext">' + esc(current.question || "") + "</p>" +
      '<div class="opts">' + optHtml + "</div>" +
      '<div class="qactions" hidden>' +
        '<button id="next-btn" class="qbtn">再来一题</button>' +
        '<button id="chat-btn" class="qbtn accent">让 WorkBuddy 深聊这题 ↗</button>' +
      "</div>";

    var locked = false;
    [].forEach.call(document.querySelectorAll(".opt"), function (btn) {
      btn.onclick = function () {
        if (locked) return;
        locked = true;
        var chosen = btn.getAttribute("data-correct") === "1";
        // 锁定 + 标色 + 展开每个选项的解析
        [].forEach.call(document.querySelectorAll(".opt"), function (b) {
          var isCorrect = b.getAttribute("data-correct") === "1";
          b.classList.add(isCorrect ? "correct" : "wrong");
          b.classList.add("locked");
          if (b === btn && !isCorrect) b.classList.add("chosen-wrong");
          var why = b.querySelector(".opt-why");
          if (why) why.hidden = false;
        });
        var act = document.querySelector(".qactions");
        if (act) act.hidden = false;
        bumpStats(chosen);
      };
    });

    var nb = document.getElementById("next-btn");
    if (nb) nb.onclick = render;
    var cb = document.getElementById("chat-btn");
    if (cb) cb.onclick = sendToBuddy;
    window.scrollTo(0, 0);
  }

  function sendToBuddy() {
    var text =
      "【想深聊这题】第 " + current.issue + " 期 · " + current.type + "\n" +
      "题目：" + current.question + "\n\n" +
      "我想听听你结合这题展开讲讲，或换个角度再考我一题。";
    var msg = "已复制！回到 WorkBuddy 对话框粘贴发给我，我们就这题深聊。";
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { alert(msg); }, function () { fallbackCopy(text, msg); });
    } else { fallbackCopy(text, msg); }
  }
  function fallbackCopy(text, msg) {
    var ta = document.createElement("textarea");
    ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); alert(msg); } catch (e) { prompt("请手动复制：", text); }
    document.body.removeChild(ta);
  }

  fetch(QUIZ_URL, { cache: "no-cache" })
    .then(function (r) { if (!r.ok) throw new Error("无法加载 " + QUIZ_URL); return r.json(); })
    .then(function (data) {
      items = data.items || [];
      if (!items.length) { document.getElementById("quiz-card").innerHTML = '<div class="empty">暂无题目</div>'; return; }
      paintStats();
      render();
    })
    .catch(function (e) {
      document.getElementById("quiz-card").innerHTML = '<div class="empty">加载失败：' + esc(e.message) + "<br/>请通过本地服务器或静态托管访问。</div>";
    });
})();
