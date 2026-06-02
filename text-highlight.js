var HIGHLIGHT_STORAGE_KEY = 'ord-highlights';

function saveHighlights() {
  var items = [];
  document.querySelectorAll('.highlight-item').forEach(function(li) {
    var text  = li.dataset.hlText  || '';
    var color = li.dataset.hlColor || '';
    var on    = (li.dataset.hlOn !== 'false');
    if (text) {
      items.push({ text: text, color: color, on: on });
    }
  });
  try {
    localStorage.setItem(HIGHLIGHT_STORAGE_KEY, JSON.stringify(items));
  } catch (e) {}
}

function restoreHighlights() {
  var raw = null;
  try { raw = localStorage.getItem(HIGHLIGHT_STORAGE_KEY); } catch (e) { return; }
  if (!raw) { return; }
  var items = JSON.parse(raw);
  if (!items || !items.length) { return; }
  items.forEach(function(item) {
    if (item.text && item.color) {
      var on = (item.on !== false);
      highlightText(item.text, item.color, document.body, true, on);
    }
  });
}

// called by chunk loader after inserting a new chunk block
function reapplyHighlights(container) {
  var raw = null;
  try { raw = localStorage.getItem(HIGHLIGHT_STORAGE_KEY); } catch (e) { return; }
  if (!raw) { return; }
  var items = JSON.parse(raw);
  if (!items || !items.length) { return; }
  items.forEach(function(item) {
    if (item.text && item.color && item.on !== false) {
      // addPanelEntry=false — no duplicate list items
      highlightText(item.text, item.color, container, false, true);
    }
  });
}

// escape regex metacharacters in a literal search term
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// dataset key used on highlight spans -- always lowercased so on/off and remove
// selectors can find every span regardless of source casing
function highlightKey(textToFind) {
  return textToFind.toLowerCase();
}

function highlightTextNodes(root, textToFind, highlightColor) {
  if (!textToFind) { return; }
  var re      = new RegExp(escapeRegExp(textToFind), 'gi');
  var dataKey = highlightKey(textToFind);

  var walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function(node) {
        if (!node.nodeValue.trim()) { return NodeFilter.FILTER_REJECT; }
        if (!node.parentNode) { return NodeFilter.FILTER_REJECT; }
        if (node.parentNode.classList && node.parentNode.classList.contains('highlight')) {
          return NodeFilter.FILTER_REJECT;
        }
        re.lastIndex = 0;
        return re.test(node.nodeValue)
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT;
      }
    }
  );

  var textNodes = [];
  while (walker.nextNode()) {
    textNodes.push(walker.currentNode);
  }

  textNodes.forEach(function(node) {
    var text     = node.nodeValue;
    var fragment = document.createDocumentFragment();
    var lastIndex = 0;
    var match;

    re.lastIndex = 0;
    while ((match = re.exec(text)) !== null) {
      // gap before this match
      if (match.index > lastIndex) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
      }
      var span = document.createElement('span');
      span.className = 'highlight';
      span.dataset.highlightText = dataKey;
      span.style.backgroundColor = highlightColor;
      span.textContent = match[0];                // preserve original document casing
      fragment.appendChild(span);
      lastIndex = match.index + match[0].length;
      // safety: never busy-loop on a zero-length match
      if (match[0].length === 0) { re.lastIndex++; }
    }

    // nothing matched -- leave the node alone
    if (lastIndex === 0) { return; }

    // tail after last match
    if (lastIndex < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
    }

    if (node.parentNode) { node.parentNode.replaceChild(fragment, node); }
  });
}

function setHighlightOn(textToFind, highlightColor, on) {
  document.querySelectorAll(
    '.highlight[data-highlight-text="' + CSS.escape(highlightKey(textToFind)) + '"]'
  ).forEach(function(span) {
    if (on) {
      span.style.backgroundColor = highlightColor;
    } else {
      span.style.backgroundColor = 'transparent';
    }
  });
}

function highlightText(textToFind, highlightColor, root, addPanelEntry, startOn) {
  if (highlightColor === undefined) { highlightColor = 'yellow'; }
  if (!textToFind) { return; }
  if (root === undefined || root === null) { root = document.body; }
  if (addPanelEntry === undefined) { addPanelEntry = true; }
  if (startOn === undefined) { startOn = true; }

  if (startOn) {
    highlightTextNodes(root, textToFind, highlightColor);
  }

  if (!addPanelEntry) { return; }

  var list = document.getElementById('highlight-list');
  if (!list) { return; }

  var li = document.createElement('li');
  li.className = 'highlight-item';
  li.dataset.hlText  = textToFind;
  li.dataset.hlColor = highlightColor;
  li.dataset.hlOn    = startOn ? 'true' : 'false';

  // swatch box — acts as the on/off toggle
  var swatchBtn = document.createElement('button');
  swatchBtn.type = 'button';
  swatchBtn.className = 'hl-swatch' + (startOn ? ' on' : '');
  swatchBtn.style.setProperty('--hl-color', highlightColor);
  swatchBtn.title = 'Toggle highlight on/off';

  swatchBtn.onclick = function() {
    var isOn = (li.dataset.hlOn !== 'false');
    var nowOn = !isOn;
    li.dataset.hlOn = nowOn ? 'true' : 'false';
    swatchBtn.className = 'hl-swatch' + (nowOn ? ' on' : '');
    setHighlightOn(textToFind, highlightColor, nowOn);
    saveHighlights();
  };

  var textSpan = document.createElement('span');
  textSpan.className = 'hl-item-text';
  textSpan.textContent = textToFind;

  var removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'remove-highlight-btn';
  removeBtn.textContent = '×';

  removeBtn.onclick = function() {
    document.querySelectorAll(
      '.highlight[data-highlight-text="' + CSS.escape(highlightKey(textToFind)) + '"]'
    ).forEach(function(span) {
      span.replaceWith(document.createTextNode(span.textContent));
    });
    li.remove();
    saveHighlights();
  };

  li.appendChild(swatchBtn);
  li.appendChild(textSpan);
  li.appendChild(removeBtn);
  list.appendChild(li);

  saveHighlights();
}

function toggleHighlightVisibility(visible) {
  var style = document.getElementById('hl-visibility-style');
  if (!style) {
    style = document.createElement('style');
    style.id = 'hl-visibility-style';
    document.head.appendChild(style);
  }
  if (visible) {
    style.textContent = '';
  } else {
    style.textContent = '.highlight { background-color: transparent !important; }';
  }
}

// restore on load — called after DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', restoreHighlights);
} else {
  restoreHighlights();
}
