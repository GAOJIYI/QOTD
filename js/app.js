/* 每日一个为什么 · 前端逻辑
 * 单文件驱动首页(index.html)与详情页(article.html)
 * 数据来源：同目录 index.json + articles/*.md
 */
(function () {
  "use strict";

  var isArticle = location.pathname.indexOf("article.html") !== -1;

  // marked 配置：微信内打开时用默认即可，这里做基础优化
  if (window.marked) {
    marked.setOptions({ breaks: true, gfm: true });
  }

  function fetchJSON(url) {
    return fetch(url + "?t=" + Date.now(), { cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error("无法加载 " + url);
      return r.json();
    });
  }

  function fetchText(url) {
    return fetch(url + "?t=" + Date.now(), { cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error("无法加载 " + url);
      return r.text();
    });
  }

  function esc(s) {
    return (s || "").replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function stripFrontMatter(md) {
    // 去掉 markdown 顶部的 YAML frontmatter（--- ... ---）
    return (md || "").replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, "");
  }

  function postProcessArticle(box) {
    var ps = box.querySelectorAll("p");
    if (ps.length >= 1) { ps[0].className = "article-date"; }

    // 把【xxx】标签与正文拆成两段（LLM 有时不会在标签后空行，会导致正文被染成标题色）
    [].forEach.call(box.querySelectorAll("p"), function (p) {
      var html = p.innerHTML.trim();
      var m = html.match(/^【([^】]+)】\s*(?:<br\s*\/?>|\n)([\s\S]*)$/);
      if (m && m[2].trim()) {
        var tag = document.createElement("p");
        tag.className = "section-tag";
        tag.textContent = "【" + m[1] + "】";
        var content = document.createElement("p");
        content.innerHTML = m[2];
        p.parentNode.insertBefore(tag, p);
        p.parentNode.replaceChild(content, p);
      }
    });

    // 把【xxx】标签段落变成章节标题，并把运营/产品思考两个模块包成色块卡片
    [].forEach.call(box.querySelectorAll("p"), function (p) {
      var t = p.textContent.trim();
      if (/^【[^】]+】$/.test(t)) {
        p.className = "section-tag";
        // 每日一问标签后面那段就是文章标题
        var next = p.nextElementSibling;
        if (next && next.tagName === "P" && !next.className && t === "【每日一问】") {
          next.className = "article-title";
        }
        var sectionMap = {
          "【运营思考】": "ops",
          "【产品思考】": "pm"
        };
        var cardType = sectionMap[t];
        if (cardType && p.nextElementSibling && /^(UL|OL)$/.test(p.nextElementSibling.tagName)) {
          var card = document.createElement("div");
          card.className = "thinking-card " + cardType;
          var title = document.createElement("div");
          title.className = "thinking-title";
          title.textContent = t.replace(/[【】]/g, "");
          card.appendChild(title);
          card.appendChild(p.nextElementSibling);
          p.parentNode.replaceChild(card, p);
        }
      }
    });

    // 兜底：没有显式【每日一问】时，把第二段当主标题
    if (!box.querySelector(".article-title") && ps.length >= 2) {
      ps[1].className = "article-title";
    }
  }

  /* ---------------- 首页 ---------------- */
  function renderIndex(data) {
    var list = document.getElementById("list");
    var search = document.getElementById("search");
    var count = document.getElementById("count");
    var tagBar = document.getElementById("tag-bar");
    var items = data.items.slice().reverse(); // 最新在前
    var activeTag = null;

    // 标签栏（有标签才显示，预留扩展）
    if (data.meta && data.meta.tags && data.meta.tags.length) {
      tagBar.hidden = false;
      var all = document.createElement("span");
      all.className = "tag active";
      all.textContent = "全部";
      all.onclick = function () {
        activeTag = null;
        [].forEach.call(tagBar.children, function (c) { c.classList.remove("active"); });
        all.classList.add("active");
        paint("");
      };
      tagBar.appendChild(all);
      data.meta.tags.forEach(function (t) {
        var el = document.createElement("span");
        el.className = "tag";
        el.textContent = t;
        el.onclick = function () {
          activeTag = t;
          [].forEach.call(tagBar.children, function (c) { c.classList.remove("active"); });
          el.classList.add("active");
          paint("");
        };
        tagBar.appendChild(el);
      });
    }

    function paint(kw) {
      kw = (kw || "").trim().toLowerCase();
      var html = "";
      var shown = 0;
      items.forEach(function (it) {
        var hay = (it.question + " " + it.summary + " " + it.title + " " + (it.tags || []).join(" ")).toLowerCase();
        if (kw && hay.indexOf(kw) === -1) return;
        if (activeTag && (it.tags || []).indexOf(activeTag) === -1) return;
        shown++;
        html +=
          '<div class="card" data-id="' + esc(it.id) + '">' +
          '<span class="card-issue">第 ' + (it.issue || "?") + " 期</span>" +
          (it.date ? '<span class="card-date">' + esc(it.date) + "</span>" : "") +
          '<p class="card-q">' + esc(it.question || it.title) + "</p>" +
          (it.summary ? '<p class="card-sum">' + esc(it.summary) + "</p>" : "") +
          (it.tags && it.tags.length
            ? '<div class="card-tags">' + it.tags.map(function (t) { return '<span class="t">#' + esc(t) + "</span>"; }).join("") + "</div>"
            : "") +
          "</div>";
      });
      list.innerHTML = html || '<div class="empty">没有匹配的内容</div>';
      count.textContent = "共 " + data.items.length + " 期 · 当前显示 " + shown + " 条";
      [].forEach.call(list.querySelectorAll(".card"), function (c) {
        c.onclick = function () { location.href = "article.html?id=" + c.getAttribute("data-id"); };
      });
    }

    if (search) search.oninput = function () { paint(search.value); };
    paint("");
  }

  /* ---------------- 详情页 ---------------- */
  function renderArticle(data) {
    var id = new URLSearchParams(location.search).get("id");
    var item = data.items.filter(function (it) { return it.id === id; })[0];
    var box = document.getElementById("content");
    var meta = document.getElementById("article-meta");
    var pager = document.getElementById("pager");

    if (!item) {
      box.innerHTML = '<div class="empty">未找到该期内容</div>';
      document.title = "未找到 · 每日一个为什么";
      return;
    }

    document.title = "第 " + (item.issue || "?") + " 期 · " + (item.question || item.title);
    if (meta) meta.textContent = "第 " + (item.issue || "?") + " 期" + (item.date ? " · " + item.date : "");

    fetchText("articles/" + encodeURIComponent(item.file))
      .then(function (md) {
        if (window.marked) {
          box.innerHTML = marked.parse(stripFrontMatter(md));
          postProcessArticle(box);
        } else {
          box.innerHTML = '<pre style="white-space:pre-wrap;font-size:14px;color:var(--text-soft)">' + esc(stripFrontMatter(md)) + "</pre>";
        }
        // 滚动到顶部
        window.scrollTo(0, 0);
      })
      .catch(function (e) {
        box.innerHTML = '<div class="empty">文章加载失败：' + esc(e.message) + "</div>";
      });

    // 上下期
    function pagerBtn(label, targetId) {
      if (!targetId) return '<a class="disabled"><span class="lbl">' + label + "</span></a>";
      var t = data.items.filter(function (x) { return x.id === targetId; })[0];
      return '<a href="article.html?id=' + esc(targetId) + '"><span class="lbl">' + label + "</span>" + esc((t && (t.question || t.title)) || "") + "</a>";
    }
    pager.innerHTML =
      pagerBtn("上一期", item.prev) + pagerBtn("下一期", item.next);
  }

  /* ---------------- 启动 ---------------- */
  fetchJSON("index.json")
    .then(function (data) {
      if (isArticle) renderArticle(data);
      else renderIndex(data);
    })
    .catch(function (e) {
      var el = isArticle ? document.getElementById("content") : document.getElementById("list");
      if (el) el.innerHTML = '<div class="empty">加载失败：' + esc(e.message) + "<br/>请确认已通过本地服务器或静态托管访问。</div>";
    });
})();
