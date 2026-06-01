
// ─────────────────────────────────────────────────────────────────────────────
// download-section.js
// Attaches a small download icon to each section heading (h5).
// Click icon = PNG download (default).
// Hover icon = dropdown with PNG / Rich Text / Plain Text options.
// ─────────────────────────────────────────────────────────────────────────────

// ── PNG download ──────────────────────────────────────────────────────────────

async function downloadDivAsPng(elementOrSelector, filename) {
  if (filename === null || filename === undefined) { filename = "capture.png"; }

  var el;
  if (typeof elementOrSelector === "string") {
    el = document.querySelector(elementOrSelector);
  } else {
    el = elementOrSelector;
  }

  if (!el) {
    console.error("Element not found");
    return;
  }

  if (!window.html2canvas) {
    console.error("html2canvas not loaded");
    return;
  }

  var canvas = await html2canvas(el, {
    backgroundColor: "#ffffff",
    useCORS: true,
    scale: window.devicePixelRatio
  });

  var link = document.createElement("a");
  link.download = filename;
  link.href = canvas.toDataURL("image/png");

  document.body.appendChild(link);
  link.click();
  link.remove();

  console.log("Downloaded:", filename);
}

// ── Rich text (HTML) clipboard copy ───────────────────────────────────────────

async function copySectionAsRichText(container) {
  // Build a self-contained HTML blob with inline styles so Outlook renders it.
  var clone = container.cloneNode(true);

  // Inline a minimal stylesheet so styles survive clipboard paste.
  var styleTag = document.createElement("style");
  styleTag.textContent = [
    "body { font-family: Arial, sans-serif; font-size: 11pt; }",
    ".Section { font-family: Arial, sans-serif; font-weight: bold; font-size: 14pt; }",
    "p, div { font-family: Arial, sans-serif; font-size: 11pt; margin: 4px 0; }",
    "h5 { font-size: 13pt; font-weight: bold; margin-bottom: 6px; }"
  ].join(" ");

  var wrapper = document.createElement("div");
  wrapper.appendChild(styleTag);
  wrapper.appendChild(clone);

  var htmlBlob = new Blob([wrapper.outerHTML], { type: "text/html" });
  var textBlob = new Blob([container.innerText], { type: "text/plain" });

  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": htmlBlob,
        "text/plain": textBlob
      })
    ]);
    console.log("Copied as rich text");
  } catch (err) {
    console.error("Rich text copy failed:", err);
    alert("Rich text copy failed — browser may require a secure context (HTTPS) or clipboard permission.");
  }
}

// ── Plain text clipboard copy ─────────────────────────────────────────────────

async function copySectionAsPlainText(container) {
  var text = container.innerText;
  try {
    await navigator.clipboard.writeText(text);
    console.log("Copied as plain text");
  } catch (err) {
    console.error("Plain text copy failed:", err);
    alert("Plain text copy failed.");
  }
}

// ── Filename utility ──────────────────────────────────────────────────────────

function slugifyFilename(text) {
  return (
    text
      .normalize("NFKD")
      .replace(/[‐-―−]/g, "-")
      .replace(/§/g, "")
      .replace(/(\d)\.(\d)/g, "$1-$2")
      .replace(/[^\w.\s-]/g, "")
      .replace(/[\s.]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase()
  );
}

// ── Dropdown menu ─────────────────────────────────────────────────────────────

function closeAllDownloadMenus() {
  document.querySelectorAll(".dl-menu").forEach(function(menu) {
    menu.remove();
  });
}

function buildDownloadMenu(btn, container, filename, includeDocx) {
  // Remove any open menu first.
  closeAllDownloadMenus();

  var menu = document.createElement("div");
  menu.className = "dl-menu";
  menu.style.cssText = [
    "position: absolute",
    "z-index: 9999",
    "background: #ffffff",
    "border: 1px solid #cccccc",
    "border-radius: 4px",
    "box-shadow: 0 2px 8px rgba(0,0,0,0.18)",
    "padding: 4px 0",
    "min-width: 160px",
    "font-family: Arial, sans-serif",
    "font-size: 12px"
  ].join("; ");

  var items = [
    {
      action: "png",
      html: "Save as PNG \u{1f5bc}",
      font: "Arial, sans-serif",
      color: "#222222"
    },
    {
      action: "rich",
      html: "<span style=\"color:#2a7a2a;font-family:Georgia,serif\">rich</span>"
           + "<span style=\"font-style:italic;font-family:Georgia,serif;color:#222222\"> text</span>",
      prefix: "Copy ",
      font: "Arial, sans-serif",
      color: "#222222"
    },
    {
      action: "plain",
      html: "Copy plain text",
      font: "Consolas, 'Courier New', monospace",
      color: "#222222"
    }
  ];

  if (includeDocx) {
    items.push({
      action: "docx",
      html: "Save as Word (.docx) 📄",
      font: "Arial, sans-serif",
      color: "#222222"
    });
  }

  items.forEach(function(item) {
    var opt = document.createElement("div");
    if (item.prefix) {
      opt.innerHTML = item.prefix + item.html;
    } else {
      opt.innerHTML = item.html;
    }
    opt.style.cssText = [
      "padding: 6px 14px",
      "cursor: pointer",
      "white-space: nowrap",
      "color: " + item.color,
      "font-family: " + item.font
    ].join("; ");

    opt.addEventListener("mouseenter", function() {
      opt.style.background = "#e8f0fe";
    });
    opt.addEventListener("mouseleave", function() {
      opt.style.background = "";
    });

    opt.addEventListener("click", async function(e) {
      e.stopPropagation();
      closeAllDownloadMenus();

      if (item.action === "png") {
        await downloadDivAsPng(container, filename);
      } else if (item.action === "rich") {
        await copySectionAsRichText(container);
        flashBtn(btn);
      } else if (item.action === "plain") {
        await copySectionAsPlainText(container);
        flashBtn(btn);
      } else if (item.action === "docx") {
        await exportAsDocx(container, filename.replace(/\.png$/, ""));
        flashBtn(btn);
      }
    });

    menu.appendChild(opt);
  });

  // Position the menu below the button.
  document.body.appendChild(menu);

  var btnRect = btn.getBoundingClientRect();
  var menuTop  = btnRect.bottom + window.scrollY + 2;
  var menuLeft = btnRect.left   + window.scrollX;

  // Keep menu on screen horizontally.
  var menuWidth = 160;
  if (menuLeft + menuWidth > window.innerWidth - 8) {
    menuLeft = window.innerWidth - menuWidth - 8;
  }

  menu.style.top  = menuTop  + "px";
  menu.style.left = menuLeft + "px";

  return menu;
}

// Brief green flash on the button to confirm copy.
function flashBtn(btn) {
  btn.style.color = "#2a9d2a";
  setTimeout(function() { btn.style.color = "#cccccc"; }, 1000);
}

// ── Icon button ───────────────────────────────────────────────────────────────

function createDownloadBtn() {
  var btn = document.createElement("button");
  btn.className = "section-dl-btn";
  btn.setAttribute("aria-label", "Download section");

  // Simple down-arrow SVG icon.
  btn.innerHTML = [
    '<svg width="13" height="13" viewBox="0 0 13 13" fill="none"',
    '  xmlns="http://www.w3.org/2000/svg" style="display:block">',
    '  <path d="M6.5 1v7M3.5 5.5l3 3 3-3" stroke="currentColor"',
    '    stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
    '  <line x1="2" y1="11.5" x2="11" y2="11.5" stroke="currentColor"',
    '    stroke-width="1.5" stroke-linecap="round"/>',
    '</svg>'
  ].join("");

  btn.style.cssText = [
    "display: inline-flex",
    "align-items: center",
    "justify-content: center",
    "margin-left: 6px",
    "padding: 2px 3px",
    "border: 1px solid transparent",
    "border-radius: 3px",
    "background: transparent",
    "color: #cccccc",
    "cursor: pointer",
    "vertical-align: middle",
    "transition: color 0.15s, border-color 0.15s",
    "line-height: 1",
    "flex-shrink: 0"
  ].join("; ");

  return btn;
}

// ── Open dropdown + wire outside-click dismissal ─────────────────────────────

function openDropdown(btn, container, filename, includeDocx) {
  var menu = buildDownloadMenu(btn, container, filename, includeDocx);

  function onOutsideClick(ev) {
    if (!menu.contains(ev.target) && ev.target !== btn) {
      closeAllDownloadMenus();
      document.removeEventListener("click", onOutsideClick, true);
    }
  }
  setTimeout(function() {
    document.addEventListener("click", onOutsideClick, true);
  }, 0);
}

// ── Shared button wiring ──────────────────────────────────────────────────────

// Attach a download button to `headingEl`.
// containerFn(headingEl) must return the DOM node to capture.
// hoverColor is the accent color shown on hover.
// includeDocx adds a DOCX export option to the dropdown (for article/chapter level).
function bindDownloadBtn(headingEl, containerFn, hoverColor, includeDocx) {
  if (headingEl.dataset.downloadBound) { return; }
  headingEl.dataset.downloadBound = "true";
  headingEl.style.cursor = "";

  var btn = createDownloadBtn();
  headingEl.appendChild(btn);

  var hoverTimer = null;

  btn.addEventListener("mouseenter", function() {
    btn.style.color       = hoverColor;
    btn.style.borderColor = hoverColor;

    hoverTimer = setTimeout(function() {
      if (document.querySelector(".dl-menu")) { return; }
      var container = containerFn(headingEl);
      if (!container) { return; }
      var filename = slugifyFilename(headingEl.innerText) + ".png";
      openDropdown(btn, container, filename, includeDocx);
    }, 500);
  });

  btn.addEventListener("mouseleave", function() {
    clearTimeout(hoverTimer);
    btn.style.color       = "#cccccc";
    btn.style.borderColor = "transparent";
  });

  // Click = immediate PNG (default), no dropdown.
  btn.addEventListener("click", async function(e) {
    e.preventDefault();
    e.stopPropagation();
    clearTimeout(hoverTimer);
    closeAllDownloadMenus();
    var container = containerFn(headingEl);
    if (!container) { return; }
    var filename = slugifyFilename(headingEl.innerText) + ".png";
    await downloadDivAsPng(container, filename);
  });
}

// ── Article container helper ──────────────────────────────────────────────────

// For new chunks: article content is wrapped in div.article-body.
// For old chunks (not yet rebuilt): fall back to sibling-walk from .Article.
function getArticleContainer(headingEl) {
  var articleBody = headingEl.closest(".article-body");
  if (articleBody) { return articleBody; }

  // Legacy fallback: .Article heading + following siblings until next .Article.
  var articleDiv = headingEl.closest(".Article");
  if (!articleDiv) { return null; }

  var wrapper = document.createElement("div");
  wrapper.style.cssText = "background:#ffffff; padding:8px; position:absolute; left:-9999px; top:0;";

  var cur = articleDiv.parentElement;
  var collecting = false;
  var parent = cur ? cur.parentElement : null;
  if (!parent) { return articleDiv; }

  Array.from(parent.children).forEach(function(sibling) {
    if (sibling === cur) { collecting = true; }
    if (collecting) {
      if (sibling !== cur && sibling.querySelector && sibling.querySelector(".Article")) { return; }
      wrapper.appendChild(sibling.cloneNode(true));
    }
  });

  document.body.appendChild(wrapper);
  setTimeout(function() { wrapper.remove(); }, 4000);
  return wrapper;
}

// ── Wiring ────────────────────────────────────────────────────────────────────

function enableSectionDownloads(root) {
  var scope = root || document;

  // Sections — h5, capture nearest div containing .Section
  scope.querySelectorAll("h5").forEach(function(el) {
    bindDownloadBtn(el, function(h) {
      return h.closest("div:has(.Section)");
    }, "#1a73e8", false);
  });

  // Articles — h3 inside .Article, capture .article-body wrapper (new chunks)
  // or fall back to sibling-walk (old chunks not yet rebuilt).
  scope.querySelectorAll(".Article h3").forEach(function(el) {
    bindDownloadBtn(el, getArticleContainer, "#b05e00", true);
  });

  // Chapters/Titles — .rbox.Title inside chunk-block > div, capture chunk-block
  scope.querySelectorAll(".chunk-block > div > .rbox.Title").forEach(function(el) {
    bindDownloadBtn(el, function(h) {
      return h.closest(".chunk-block");
    }, "#6a1ab8", true);
  });

  // Close menus on scroll.
  if (!scope._dlScrollBound) {
    scope._dlScrollBound = true;
    window.addEventListener("scroll", closeAllDownloadMenus, { passive: true });
  }
}
