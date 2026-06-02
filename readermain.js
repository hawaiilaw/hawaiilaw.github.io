// CHUNKS_DIR is set by the tiny bootstrap <script> emitted by reader_template.make_reader;
// fall back to 'chunks/' for standalone testing when no bootstrap ran.
var CHUNKS_DIR = (typeof window !== 'undefined' && window.CHUNKS_DIR) || 'chunks/';

var OVERVIEW_URL        = 'https://codelibrary.amlegal.com/codes/honolulu/latest/overview';
var STORAGE_KEY         = 'ord-reader-loaded-articles';
var COLLAPSE_KEY        = 'ord-reader-collapsed-chapters';
var FAVORITES_KEY       = 'ord-reader-favorites';
var FAVORITES_ORDER_KEY = 'ord-reader-favorites-order';
var SUPPLEMENT_LABEL    = 'Supp.';

var indexData    = null;
var loadedChunks = {};

// flat list of every article (for the Quick Finder), built in renderSidebar
var finderIndex  = [];
// chapter-level entries for the finder: {chapterKey, chapterLabel, chapterNum, articleIds[]}
var finderChapterIndex = [];
// nickname-modal pending state
var nickPending  = null;

var isDragging      = false;
var dragTargetState = null;
var lastClickedId   = null;
var clickTimer      = null;

// when a chapter batch-load is in progress, scroll goes to this id only
var batchScrollTargetId = null;


// .-.-.   .-.-.   .-.-.   .-.-.   .-.-.   .-.-.   .-.-.   .-.-
// / / \ \ / / \ \ / / \ \ / / \ \ / / \ \ / / \ \ / / \ \ / / \
//`-'   `-`-'   `-`-'   `-`-'   `-`-'   `-`-'   `-`-'   `-`-'
// Sidebar rendering
// .-.-.   .-.-.   .-.-.   .-.-.   .-.-.   .-.-.   .-.-.   .-.-


function tocTitleCase(str) {
  var lowers = {a:1,an:1,the:1,and:1,but:1,or:1,for:1,nor:1,on:1,at:1,to:1,by:1,in:1,of:1,up:1,as:1,is:1};
  return str.replace(/\w\S*/g, function(word, offset) {
    var lower = word.toLowerCase();
    if (offset > 0 && lowers[lower]) { return lower; }
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  });
}


function renderSidebar() {
  var list    = document.getElementById('chapter-list');
  var favList = document.getElementById('favorites-list');
  list.innerHTML    = '';
  favList.innerHTML = '';

  var titles  = indexData.titles || [];
  finderIndex        = [];
  finderChapterIndex = [];

  for (var ti = 0; ti < titles.length; ti++) {
    var titleGroup = titles[ti];

    // title group header -- expanded by default
    var tHeader = document.createElement('div');
    tHeader.className = 'title-group-header';
    tHeader.dataset.titleIdx = String(ti);

    var tCaret = document.createElement('span');
    tCaret.className = 'fold-caret';
    tCaret.textContent = '▾';

    var tCb = document.createElement('input');
    tCb.type = 'checkbox';
    tCb.style.marginRight = '5px';
    tCb.style.cursor = 'pointer';
    tCb.style.flexShrink = '0';
    tCb.dataset.titleIdx = String(ti);
    tCb.addEventListener('change', onTitleCheckboxChange);
    tCb.addEventListener('mousedown', function(e) { e.stopPropagation(); });

    var tSpan = document.createElement('span');
    tSpan.style.flex = '1';
    tSpan.textContent = tocTitleCase(titleGroup.titleLabel);

    tHeader.appendChild(tCaret);
    tHeader.appendChild(tCb);
    tHeader.appendChild(tSpan);
    list.appendChild(tHeader);

    tHeader.addEventListener('mousedown', onTitleHeaderMouseDown);

    // title chapters container -- expanded by default
    var titleContainer = document.createElement('div');
    titleContainer.className = 'title-group-chapters';
    titleContainer.dataset.titleIdx = String(ti);
    list.appendChild(titleContainer);

    for (var ci = 0; ci < titleGroup.chapters.length; ci++) {
      var chapter = titleGroup.chapters[ci];
      var chKey   = ti + '-' + ci;

      finderChapterIndex.push({
        chapterKey:   chKey,
        chapterLabel: chapter.chapterLabel || '',
        articleIds:   chapter.articles.map(function(a) { return a.id; })
      });

      // chapter header -- collapsed by default
      var cHeader = document.createElement('div');
      cHeader.className = 'chapter-group-header collapsed';
      cHeader.dataset.chapterKey = chKey;

      var cCaret = document.createElement('span');
      cCaret.className = 'fold-caret';
      cCaret.textContent = '▾';

      var cCb = document.createElement('input');
      cCb.type = 'checkbox';
      cCb.style.marginRight = '5px';
      cCb.style.cursor = 'pointer';
      cCb.style.flexShrink = '0';
      cCb.dataset.chapterKey = chKey;
      cCb.addEventListener('change', onChapterCheckboxChange);
      cCb.addEventListener('mousedown', function(e) { e.stopPropagation(); });

      var cSpan = document.createElement('span');
      cSpan.style.flex = '1';
      cSpan.textContent = tocTitleCase(chapter.chapterLabel);

      var cStar = document.createElement('button');
      cStar.type = 'button';
      cStar.className = 'chapter-star';
      cStar.textContent = '☆';
      cStar.title = 'Favorite this chapter';
      cStar.dataset.chapterKey = chKey;
      cStar.addEventListener('mousedown', function(e) { e.stopPropagation(); });
      cStar.addEventListener('click', onChapterStarClick);

      cHeader.appendChild(cCaret);
      cHeader.appendChild(cCb);
      cHeader.appendChild(cSpan);
      cHeader.appendChild(cStar);
      titleContainer.appendChild(cHeader);

      cHeader.addEventListener('mousedown', onChapterHeaderMouseDown);

      // articles container
      var artContainer = document.createElement('div');
      artContainer.className = 'chapter-articles collapsed';
      artContainer.dataset.chapterKey = chKey;
      titleContainer.appendChild(artContainer);

      for (var ai = 0; ai < chapter.articles.length; ai++) {
        var art    = chapter.articles[ai];
        var isFav  = isArticleFavorited(art.id);

        finderIndex.push({
          id:         art.id,
          shortLabel: art.shortLabel || art.id,
          title:      art.title || '',
          chapterKey: chKey
        });

        var item = document.createElement('div');
        item.className = 'article-item';
        item.dataset.id         = art.id;
        item.dataset.chapterKey = chKey;
        item.dataset.titleIdx   = String(ti);

        var checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.tabIndex = -1;
        checkbox.addEventListener('click', function(e) { e.preventDefault(); });

        var idLabel = document.createElement('span');
        idLabel.className = 'article-id';
        idLabel.textContent = art.shortLabel || art.id;

        var titleSpan = document.createElement('span');
        titleSpan.className = 'article-title';
        titleSpan.textContent = art.title;

        var starBtn = document.createElement('button');
        starBtn.type = 'button';
        starBtn.className = 'star-btn' + (isFav ? ' starred' : '');
        starBtn.textContent = isFav ? '★' : '☆';
        starBtn.title = isFav ? 'Remove from favorites' : 'Add to favorites';
        starBtn.dataset.id = art.id;
        starBtn.addEventListener('mousedown', function(e) { e.stopPropagation(); });
        starBtn.addEventListener('click', onStarClick);

        item.appendChild(checkbox);
        item.appendChild(idLabel);
        item.appendChild(titleSpan);
        item.appendChild(starBtn);
        artContainer.appendChild(item);

        item.addEventListener('mousedown', onItemMouseDown);
        item.addEventListener('mouseenter', onItemMouseEnter);
      }
    }
  }

  document.getElementById('chapter-list').addEventListener('mouseup', onListMouseUp);
  restoreFromStorage();
  restoreCollapsed();
  updateAllCheckboxes();
  refreshFavoritesPanel();
  refreshAllStars();
}


// .-.-.   .-.-.   .-.-.   .-.-.   .-.-.   .-.-.   .-.-.   .-.-
// / / \ \ / / \ \ / / \ \ / / \ \ / / \ \ / / \ \ / / \ \ / / \
//`-'   `-`-'   `-`-'   `-`-'   `-`-'   `-`-'   `-`-'   `-`-'
// Fold / collapse
// .-.-.   .-.-.   .-.-.   .-.-.   .-.-.   .-.-.   .-.-.   .-.-


function onTitleHeaderMouseDown(e) {
  if (e.target.type === 'checkbox') { return; }
  e.preventDefault();
  var header = e.currentTarget;
  var ti     = header.dataset.titleIdx;

  if (e.detail === 2) {
    if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; }
    var items       = document.querySelectorAll('.article-item[data-title-idx="' + ti + '"]');
    var targetState = !header.querySelector('input').checked;
    for (var i = 0; i < items.length; i++) { setItemChecked(items[i], targetState); }
    setTitleCollapsed(ti, false);
    return;
  }
  if (clickTimer) { clearTimeout(clickTimer); }
  clickTimer = setTimeout(function() {
    clickTimer = null;
    setTitleCollapsed(ti, !header.classList.contains('collapsed'));
  }, 220);
}

function onChapterHeaderMouseDown(e) {
  if (e.target.type === 'checkbox') { return; }
  e.preventDefault();
  var header = e.currentTarget;
  var ck     = header.dataset.chapterKey;

  // caret click: toggle collapse only
  if (e.target.classList.contains('fold-caret')) {
    setChapterCollapsed(ck, !header.classList.contains('collapsed'));
    return;
  }

  // non-caret click: load all if unchecked, scroll to first loaded if checked
  var items = Array.from(document.querySelectorAll('.article-item[data-chapter-key="' + ck + '"]'));
  var cb    = header.querySelector('input');
  if (cb && cb.checked) {
    // chapter already loaded -- scroll to first loaded article
    var firstLoaded = null;
    for (var i = 0; i < items.length; i++) {
      if (items[i].classList.contains('loaded')) { firstLoaded = items[i].dataset.id; break; }
    }
    if (firstLoaded) { scrollToChunk(firstLoaded); }
    // expand so articles are visible
    setChapterCollapsed(ck, false);
  } else {
    // load all articles in chapter
    setChapterCollapsed(ck, false);
    if (items.length > 0) {
      batchScrollTargetId = items[0].dataset.id;
      for (var j = 0; j < items.length; j++) { setItemChecked(items[j], true); }
      setTimeout(function() { batchScrollTargetId = null; }, 500);
    }
  }
}

function setTitleCollapsed(ti, collapsed) {
  var header    = document.querySelector('.title-group-header[data-title-idx="' + ti + '"]');
  var container = document.querySelector('.title-group-chapters[data-title-idx="' + ti + '"]');
  if (!header || !container) { return; }
  if (collapsed) {
    header.classList.add('collapsed');
    container.classList.add('collapsed');
  } else {
    header.classList.remove('collapsed');
    container.classList.remove('collapsed');
  }
  saveCollapsed();
}

function setChapterCollapsed(ck, collapsed) {
  var header       = document.querySelector('.chapter-group-header[data-chapter-key="' + ck + '"]');
  var artContainer = document.querySelector('.chapter-articles[data-chapter-key="' + ck + '"]');
  if (!header || !artContainer) { return; }
  if (collapsed) {
    header.classList.add('collapsed');
    artContainer.classList.add('collapsed');
  } else {
    header.classList.remove('collapsed');
    artContainer.classList.remove('collapsed');
  }
  saveCollapsed();
}

function saveCollapsed() {
  var state = { titles: [], chapters: [] };
  document.querySelectorAll('.title-group-header.collapsed').forEach(function(h) {
    state.titles.push(h.dataset.titleIdx);
  });
  document.querySelectorAll('.chapter-group-header.collapsed').forEach(function(h) {
    state.chapters.push(h.dataset.chapterKey);
  });
  try { localStorage.setItem(COLLAPSE_KEY, JSON.stringify(state)); } catch(e) {}
}

function restoreCollapsed() {
  var saved = null;
  try {
    var raw = localStorage.getItem(COLLAPSE_KEY);
    if (raw) { saved = JSON.parse(raw); }
  } catch(e) {}

  // default: titles expanded, chapters collapsed (already set in renderSidebar)
  if (!saved) { return; }

  // expand everything first, then re-collapse per saved state
  document.querySelectorAll('.title-group-header').forEach(function(h) {
    setTitleCollapsed(h.dataset.titleIdx, false);
  });
  document.querySelectorAll('.chapter-group-header').forEach(function(h) {
    setChapterCollapsed(h.dataset.chapterKey, false);
  });

  if (saved.titles) {
    for (var i = 0; i < saved.titles.length; i++) { setTitleCollapsed(saved.titles[i], true); }
  }
  if (saved.chapters) {
    for (var j = 0; j < saved.chapters.length; j++) { setChapterCollapsed(saved.chapters[j], true); }
  }
}


// .-.-.   .-.-.   .-.-.   .-.-.   .-.-.   .-.-.   .-.-.   .-.-
// / / \ \ / / \ \ / / \ \ / / \ \ / / \ \ / / \ \ / / \ \ / / \
//`-'   `-`-'   `-`-'   `-`-'   `-`-'   `-`-'   `-`-'   `-`-'
// Checkboxes -- title, chapter, article
// .-.-.   .-.-.   .-.-.   .-.-.   .-.-.   .-.-.   .-.-.   .-.-


function onTitleCheckboxChange(e) {
  var ti      = e.target.dataset.titleIdx;
  var checked = e.target.checked;
  var items   = document.querySelectorAll('.article-item[data-title-idx="' + ti + '"]');

  if (checked && items.length > 0) {
    batchScrollTargetId = items[0].dataset.id;
  }

  for (var i = 0; i < items.length; i++) { setItemChecked(items[i], checked); }

  if (checked && items.length > 0) {
    scrollToChunk(batchScrollTargetId);
    setTimeout(function() { batchScrollTargetId = null; }, 500);
  }
}

function onChapterCheckboxChange(e) {
  var ck      = e.target.dataset.chapterKey;
  var checked = e.target.checked;
  var items   = document.querySelectorAll('.article-item[data-chapter-key="' + ck + '"]');

  if (checked && items.length > 0) {
    // lock scroll target to first article so async XHR completions don't hijack it
    batchScrollTargetId = items[0].dataset.id;
  }

  for (var i = 0; i < items.length; i++) { setItemChecked(items[i], checked); }

  if (checked && items.length > 0) {
    // first article may already be loaded -- scroll now; XHR callbacks will no-op
    scrollToChunk(batchScrollTargetId);
    // clear flag after a tick so single-article loads after this work normally
    setTimeout(function() { batchScrollTargetId = null; }, 500);
  }
}

function updateAllCheckboxes() {
  var titles = indexData.titles || [];
  for (var ti = 0; ti < titles.length; ti++) {
    for (var ci = 0; ci < titles[ti].chapters.length; ci++) {
      updateChapterCheckbox(ti + '-' + ci);
    }
    updateTitleCheckbox(String(ti));
  }
}

function updateChapterCheckbox(ck) {
  var hcb   = document.querySelector('.chapter-group-header[data-chapter-key="' + ck + '"] input[type="checkbox"]');
  if (!hcb) { return; }
  var items   = document.querySelectorAll('.article-item[data-chapter-key="' + ck + '"]');
  var total   = items.length;
  var checked = 0;
  for (var i = 0; i < items.length; i++) {
    if (items[i].querySelector('input').checked) { checked++; }
  }
  hcb.checked       = (checked === total && total > 0);
  hcb.indeterminate = (checked > 0 && checked < total);
}

function updateTitleCheckbox(ti) {
  var hcb   = document.querySelector('.title-group-header[data-title-idx="' + ti + '"] input[type="checkbox"]');
  if (!hcb) { return; }
  var items   = document.querySelectorAll('.article-item[data-title-idx="' + ti + '"]');
  var total   = items.length;
  var checked = 0;
  for (var i = 0; i < items.length; i++) {
    if (items[i].querySelector('input').checked) { checked++; }
  }
  hcb.checked       = (checked === total && total > 0);
  hcb.indeterminate = (checked > 0 && checked < total);
}


// .-.-.   .-.-.   .-.-.   .-.-.   .-.-.   .-.-.   .-.-.   .-.-
// / / \ \ / / \ \ / / \ \ / / \ \ / / \ \ / / \ \ / / \ \ / / \
//`-'   `-`-'   `-`-'   `-`-'   `-`-'   `-`-'   `-`-'   `-`-'
// Article selection: click, shift-click, drag
// .-.-.   .-.-.   .-.-.   .-.-.   .-.-.   .-.-.   .-.-.   .-.-


function onItemMouseDown(e) {
  var item = e.currentTarget;
  var id   = item.dataset.id;

  if (e.shiftKey && lastClickedId !== null) {
    selectRange(lastClickedId, id);
    lastClickedId = id;
    return;
  }

  var cb             = item.querySelector('input');
  var currentlyChecked = cb.checked;
  var clickedOnCheckbox = (e.target === cb);

  if (clickedOnCheckbox) {
    // checkbox clicked directly -- toggle normally, enable drag
    isDragging      = true;
    dragTargetState = !currentlyChecked;
    setItemChecked(item, dragTargetState);
    lastClickedId = id;
    // e.preventDefault();
    // removed to allow browser to show correct state
    return;
  }

  if (currentlyChecked) {
    // already checked: title click just scrolls, no uncheck
    scrollToChunk(id);
    lastClickedId = id;
    e.preventDefault();
    return;
  }

  // unchecked: title click checks and scrolls
  isDragging      = true;
  dragTargetState = true;
  setItemChecked(item, true);
  lastClickedId = id;
  e.preventDefault();
}

function onItemMouseEnter(e) {
  if (!isDragging) { return; }
  // drag only checks -- unchecking requires clicking the checkbox directly
  if (dragTargetState !== true) { return; }
  setItemChecked(e.currentTarget, dragTargetState);
}

function onListMouseUp() {
  isDragging      = false;
  dragTargetState = null;
}

function selectRange(fromId, toId) {
  var items   = document.querySelectorAll('.article-item');
  var fromIdx = -1;
  var toIdx   = -1;

  for (var i = 0; i < items.length; i++) {
    if (items[i].dataset.id === fromId) { fromIdx = i; }
    if (items[i].dataset.id === toId)   { toIdx   = i; }
  }

  if (fromIdx === -1 || toIdx === -1) { return; }

  var lo          = Math.min(fromIdx, toIdx);
  var hi          = Math.max(fromIdx, toIdx);
  var targetState = !items[toIdx].querySelector('input').checked;

  for (var j = lo; j <= hi; j++) {
    setItemChecked(items[j], targetState);
  }
}

function setItemChecked(item, checked) {
  var cb  = item.querySelector('input');
  var id  = item.dataset.id;
  var was = cb.checked;

  if (was === checked) { return; }

  cb.checked = checked;

  if (checked) {
    item.classList.add('selected');
    loadChunk(id);
  } else {
    item.classList.remove('selected');
    unloadChunk(id);
  }

  saveToStorage();
  updateChapterCheckbox(item.dataset.chapterKey);
  updateTitleCheckbox(item.dataset.titleIdx);

  // refresh favorites fake-checkboxes + chapter star (loaded state may have changed)
  if (typeof syncFavCheckboxes === 'function') { syncFavCheckboxes(); }
  if (typeof updateChapterStar === 'function') { updateChapterStar(item.dataset.chapterKey); }
}

function selectAll() {
  var items = document.querySelectorAll('.article-item');
  for (var i = 0; i < items.length; i++) { setItemChecked(items[i], true); }
}

function selectNone() {
  var items = document.querySelectorAll('.article-item');
  for (var i = 0; i < items.length; i++) { setItemChecked(items[i], false); }
}


// .-.-.   .-.-.   .-.-.   .-.-.   .-.-.   .-.-.   .-.-.   .-.-
// / / \ \ / / \ \ / / \ \ / / \ \ / / \ \ / / \ \ / / \ \ / / \
//`-'   `-`-'   `-`-'   `-`-'   `-`-'   `-`-'   `-`-'   `-`-'
// localStorage
// .-.-.   .-.-.   .-.-.   .-.-.   .-.-.   .-.-.   .-.-.   .-.-


function saveToStorage() {
  var checked = [];
  var items   = document.querySelectorAll('.article-item');
  for (var i = 0; i < items.length; i++) {
    if (items[i].querySelector('input').checked) {
      checked.push(items[i].dataset.id);
    }
  }
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(checked)); } catch (e) {}
}

function restoreFromStorage() {
  var saved = null;
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (raw) { saved = JSON.parse(raw); }
  } catch (e) { return; }

  if (!saved || saved.length === 0) { return; }

  var savedSet = {};
  for (var i = 0; i < saved.length; i++) { savedSet[saved[i]] = true; }

  var items = document.querySelectorAll('.article-item');
  for (var j = 0; j < items.length; j++) {
    if (savedSet[items[j].dataset.id]) { setItemChecked(items[j], true); }
  }
}


// .-.-.   .-.-.   .-.-.   .-.-.   .-.-.   .-.-.   .-.-.   .-.-
// / / \ \ / / \ \ / / \ \ / / \ \ / / \ \ / / \ \ / / \ \ / / \
//`-'   `-`-'   `-`-'   `-`-'   `-`-'   `-`-'   `-`-'   `-`-'
// Chunk loading / unloading
// .-.-.   .-.-.   .-.-.   .-.-.   .-.-.   .-.-.   .-.-.   .-.-


function findArticleById(id) {
  if (!indexData) { return null; }
  var titles = indexData.titles || [];
  for (var ti = 0; ti < titles.length; ti++) {
    for (var ci = 0; ci < titles[ti].chapters.length; ci++) {
      var arts = titles[ti].chapters[ci].articles;
      for (var ai = 0; ai < arts.length; ai++) {
        if (arts[ai].id === id) { return arts[ai]; }
      }
    }
  }
  return null;
}

function getArticleOrder(id) {
  var n = 0;
  var titles = indexData.titles || [];
  for (var ti = 0; ti < titles.length; ti++) {
    for (var ci = 0; ci < titles[ti].chapters.length; ci++) {
      var arts = titles[ti].chapters[ci].articles;
      for (var ai = 0; ai < arts.length; ai++) {
        if (arts[ai].id === id) { return n; }
        n++;
      }
    }
  }
  return -1;
}

function loadChunk(id) {
  if (loadedChunks[id]) {
    scrollToChunk(id);
    return;
  }

  var art = findArticleById(id);
  if (!art) { return; }

  var xhr = new XMLHttpRequest();
  xhr.open('GET', CHUNKS_DIR + art.filename, true);

  xhr.onload = function() {
    if (xhr.status !== 200) {
      console.error('Failed to load chunk:', art.filename, xhr.status);
      return;
    }

    var parser = new DOMParser();
    var doc    = parser.parseFromString(xhr.responseText, 'text/html');

    var block = document.createElement('div');
    block.className = 'chunk-block';
    block.id        = 'chunk-' + id;

    var body = doc.body;
    while (body.firstChild) {
      block.appendChild(document.adoptNode(body.firstChild));
    }

    insertBlockInOrder(id, block);
    loadedChunks[id] = true;

    var item = document.querySelector('.article-item[data-id="' + id + '"]');
    if (item) {
      item.classList.add('loaded');
      // loaded state changed -- refresh chapter/title checkboxes + fav UI + stars
      updateChapterCheckbox(item.dataset.chapterKey);
      updateTitleCheckbox(item.dataset.titleIdx);
      updateChapterStar(item.dataset.chapterKey);
    }
    if (typeof syncFavCheckboxes === 'function') { syncFavCheckboxes(); }

    var empty = document.getElementById('empty-msg');
    if (empty) { empty.style.display = 'none'; }

    updateStatus();

    // during a chapter batch-load, only scroll to the designated first article
    if (batchScrollTargetId === null || batchScrollTargetId === id) {
      scrollToChunk(id);
    }

    // lazy-load images in the newly loaded chunk
    initLazyImages(block);

    // re-apply any active highlights to the newly loaded content
    if (typeof reapplyHighlights === 'function') { reapplyHighlights(block); }

    if (typeof enableSectionDownloads === 'function') { enableSectionDownloads(block); }
  };

  xhr.onerror = function() {
    console.error('Network error loading chunk:', art.filename);
  };

  xhr.send();
}
/* old scrolltochunk 
function scrollToChunk(id) {
  var block = document.getElementById('chunk-' + id);
  var main  = document.getElementById('main');
  if (!block || !main) { return; }
  // scrollIntoView gets confused by overflow:hidden ancestors -- set scrollTop directly
  // use requestAnimationFrame to ensure layout is settled before measuring
  requestAnimationFrame(function() {
    var blockTop     = block.getBoundingClientRect().top;
    var mainTop      = main.getBoundingClientRect().top;
    var targetScroll = main.scrollTop + (blockTop - mainTop);
    main.scrollTo({top: targetScroll, behavior: 'smooth' });
  });
}
*/
// new scrollToChunk for anim
function scrollToChunk(id) {
  var block = document.getElementById('chunk-' + id);
  var main  = document.getElementById('main');
  if (!block || !main) { return; }

  requestAnimationFrame(function() {
    var blockTop     = block.getBoundingClientRect().top;
    var mainTop      = main.getBoundingClientRect().top;
    var targetScroll = main.scrollTop + (blockTop - mainTop);

    var startScroll  = main.scrollTop;
    var distance     = targetScroll - startScroll;
    var duration     = 400; // ms
    var startTime    = null;

    function easeInOut(t) {
      return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    }

    function step(timestamp) {
      if (!startTime) { startTime = timestamp; }
      var elapsed  = timestamp - startTime;
      var progress = Math.min(elapsed / duration, 1);
      main.scrollTop = startScroll + distance * easeInOut(progress);
      if (progress < 1) { requestAnimationFrame(step); }
    }

    requestAnimationFrame(step);
  });
}

function insertBlockInOrder(id, block) {
  var inner    = document.getElementById('main-inner');
  var existing = inner.querySelectorAll('.chunk-block');
  var myOrder  = getArticleOrder(id);

  var insertBefore = null;
  for (var i = 0; i < existing.length; i++) {
    var existingId    = existing[i].id.replace('chunk-', '');
    var existingOrder = getArticleOrder(existingId);
    if (existingOrder > myOrder) {
      insertBefore = existing[i];
      break;
    }
  }

  if (insertBefore) {
    inner.insertBefore(block, insertBefore);
  } else {
    inner.appendChild(block);
  }
}

function unloadChunk(id) {
  var block = document.getElementById('chunk-' + id);
  if (block) {
    // before removal: revoke any blob: object URLs to free image memory
    var imgs = block.querySelectorAll('img[src^="blob:"]');
    for (var i = 0; i < imgs.length; i++) {
      try { URL.revokeObjectURL(imgs[i].src); } catch(e) {}
      imgs[i].src = '';
    }
    block.parentNode.removeChild(block);
  }
  block = null;                 // drop reference
  delete loadedChunks[id];

  // non-standard GC hint -- harmless where unsupported
  if (window.gc) { try { window.gc(); } catch(e) {} }

  var item = document.querySelector('.article-item[data-id="' + id + '"]');
  if (item) {
    item.classList.remove('loaded');
    // loaded state changed -- refresh chapter/title checkboxes + fav UI + stars
    updateChapterCheckbox(item.dataset.chapterKey);
    updateTitleCheckbox(item.dataset.titleIdx);
    updateChapterStar(item.dataset.chapterKey);
  }
  if (typeof syncFavCheckboxes === 'function') { syncFavCheckboxes(); }

  var inner     = document.getElementById('main-inner');
  var remaining = inner.querySelectorAll('.chunk-block');
  if (remaining.length === 0) {
    var empty = document.getElementById('empty-msg');
    if (empty) { empty.style.display = ''; }
  }

  updateStatus();
}

function updateStatus() {
  var count = Object.keys(loadedChunks).length;
  document.getElementById('load-status').textContent =
    count + ' section' + (count !== 1 ? 's' : '') + ' loaded';
}


// .-.-.   .-.-.   .-.-.   .-.-.   .-.-.   .-.-.   .-.-.   .-.-
// / / \ \ / / \ \ / / \ \ / / \ \ / / \ \ / / \ \ / / \ \ / / \
//`-'   `-`-'   `-`-'   `-`-'   `-`-'   `-`-'   `-`-'   `-`-'
// Favorites
// .-.-.   .-.-.   .-.-.   .-.-.   .-.-.   .-.-.   .-.-.   .-.-


// -- storage: favorites are a map {favId: entry} + a separate order array --
function getFavorites() {
  try {
    var raw = localStorage.getItem(FAVORITES_KEY);
    if (raw) { return JSON.parse(raw) || {}; }
  } catch(e) {}
  return {};
}

function saveFavorites(favs) {
  try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(favs)); } catch(e) {}
}

function getFavoritesOrder() {
  try {
    var raw = localStorage.getItem(FAVORITES_ORDER_KEY);
    if (raw) { return JSON.parse(raw) || []; }
  } catch(e) {}
  return [];
}

function saveFavoritesOrder(order) {
  try { localStorage.setItem(FAVORITES_ORDER_KEY, JSON.stringify(order)); } catch(e) {}
}

// keep order array in sync with the favorites map (append new, drop missing)
function reconcileFavoritesOrder() {
  var favs  = getFavorites();
  var order = getFavoritesOrder();
  var seen  = {};
  var out   = [];
  for (var i = 0; i < order.length; i++) {
    if (favs[order[i]] && !seen[order[i]]) { out.push(order[i]); seen[order[i]] = true; }
  }
  for (var k in favs) {
    if (favs.hasOwnProperty(k) && !seen[k]) { out.push(k); seen[k] = true; }
  }
  saveFavoritesOrder(out);
  return out;
}

// MIGRATION: old format was {id: true}. Convert each to a type:"article" entry.
function migrateFavorites() {
  var favs = getFavorites();
  var keys = Object.keys(favs);
  if (keys.length === 0) { return; }
  // detect old format: any value === true (new entries are objects)
  var isOld = false;
  for (var i = 0; i < keys.length; i++) {
    if (favs[keys[i]] === true) { isOld = true; break; }
  }
  if (!isOld) { return; }

  var migrated = {};
  var order    = [];
  var stamp    = Date.now();
  for (var j = 0; j < keys.length; j++) {
    var oldId = keys[j];
    if (favs[oldId] !== true) {
      migrated[oldId] = favs[oldId];
      order.push(oldId);
      continue;
    }
    var meta  = deriveArticleMeta(oldId);
    var favId = 'fav-' + (stamp++);
    migrated[favId] = {
      type:         'article',
      nickname:     '',
      articleIds:   [oldId],
      chapterKey:   meta.chapterKey,
      shortLabel:   meta.shortLabel,
      officialName: meta.officialName,
      createdAt:    Date.now()
    };
    order.push(favId);
  }
  saveFavorites(migrated);
  saveFavoritesOrder(order);
}

// -- metadata derivation from indexData --
function deriveArticleMeta(id) {
  var titles = indexData ? (indexData.titles || []) : [];
  for (var ti = 0; ti < titles.length; ti++) {
    for (var ci = 0; ci < titles[ti].chapters.length; ci++) {
      var arts = titles[ti].chapters[ci].articles;
      for (var ai = 0; ai < arts.length; ai++) {
        if (arts[ai].id === id) {
          return {
            chapterKey:   ti + '-' + ci,
            shortLabel:   arts[ai].shortLabel || arts[ai].id,
            officialName: arts[ai].title || ''
          };
        }
      }
    }
  }
  return { chapterKey: '', shortLabel: id, officialName: '' };
}

function cleanChapterLabel(label) {
  // strip leading "CHAPTER N:" prefix -- official name
  var m = label.match(/^CHAPTER\s+\S+[:.]?\s*(.*)$/i);
  var name = (m && m[1]) ? m[1] : label;
  return tocTitleCase(name.trim());
}

function chapterNumFromLabel(label) {
  var m = label.match(/^CHAPTER\s+(\S+?)[:.]\s/i) || label.match(/^CHAPTER\s+(\S+)/i);
  return m ? m[1].replace(/[:.]$/, '') : '';
}

function getChapterByKey(chKey) {
  if (!indexData) { return null; }
  var parts = chKey.split('-');
  var ti = parseInt(parts[0], 10), ci = parseInt(parts[1], 10);
  var titles = indexData.titles || [];
  if (titles[ti] && titles[ti].chapters[ci]) { return titles[ti].chapters[ci]; }
  return null;
}

function getChapterArticleIds(chKey) {
  var ch = getChapterByKey(chKey);
  if (!ch) { return []; }
  return ch.articles.map(function(a) { return a.id; });
}

// -- loaded-state helpers (loaded = chunk in DOM / sidebar checkbox checked) --
function isLoaded(id) { return !!loadedChunks[id]; }

function loadedCount(ids) {
  var n = 0;
  for (var i = 0; i < ids.length; i++) { if (isLoaded(ids[i])) { n++; } }
  return n;
}

// does any favorite entry already include this article id?
function isArticleFavorited(id) {
  var favs = getFavorites();
  for (var k in favs) {
    if (!favs.hasOwnProperty(k)) { continue; }
    var ids = favs[k].articleIds || [];
    if (ids.indexOf(id) !== -1) { return true; }
  }
  return false;
}

// -- star clicks --
function onStarClick(e) {
  // article star: one click -- save single article, open nickname modal
  var id = e.currentTarget.dataset.id;

  // if already favorited somewhere, a click removes the matching article entry
  var favs = getFavorites();
  for (var k in favs) {
    if (favs.hasOwnProperty(k) && favs[k].type === 'article' &&
        (favs[k].articleIds || []).indexOf(id) !== -1) {
      removeFavorite(k);
      return;
    }
  }

  var meta = deriveArticleMeta(id);
  openNickModal(e.currentTarget, {
    type:         'article',
    articleIds:   [id],
    chapterKey:   meta.chapterKey,
    shortLabel:   meta.shortLabel,
    officialName: meta.officialName
  }, null);
}

function onChapterStarClick(e) {
  e.stopPropagation();
  var chKey   = e.currentTarget.dataset.chapterKey;
  var allIds  = getChapterArticleIds(chKey);
  var loaded  = allIds.filter(isLoaded);
  var ch      = getChapterByKey(chKey);
  var chNum   = ch ? chapterNumFromLabel(ch.chapterLabel) : '';
  var official= ch ? cleanChapterLabel(ch.chapterLabel) : '';

  var base = {
    type:         'chapter-set',
    chapterKey:   chKey,
    shortLabel:   chNum,
    officialName: official
  };

  if (loaded.length > 0 && loaded.length < allIds.length) {
    // partial -- offer current set, with "favorite entire chapter" option
    var partial = {};
    for (var p in base) { partial[p] = base[p]; }
    partial.articleIds = loaded.slice();
    var entire = {};
    for (var q in base) { entire[q] = base[q]; }
    entire.articleIds = allIds.slice();
    openNickModal(e.currentTarget, partial, entire);
  } else {
    // none or all loaded -- save entire chapter
    var full = {};
    for (var r in base) { full[r] = base[r]; }
    full.articleIds = allIds.slice();
    openNickModal(e.currentTarget, full, null);
  }
}

// -- nickname modal --
function openNickModal(anchorEl, pending, entireAlt) {
  nickPending = { pending: pending, entire: entireAlt };

  var modal   = document.getElementById('nick-modal');
  var saving  = document.getElementById('nick-saving');
  var entire  = document.getElementById('nick-entire');
  var input   = document.getElementById('nick-input');

  if (pending.type === 'chapter-set' && entireAlt) {
    var labels = pending.articleIds.map(shortLabelFor).join(', ');
    saving.textContent = 'Saving current set of ' + pending.articleIds.length +
                         ' section(s): ' + labels;
    entire.style.display = 'block';
    entire.textContent   = 'Favorite entire Chapter ' + (pending.shortLabel || '') + ' instead';
  } else if (pending.type === 'chapter-set') {
    saving.textContent = 'Saving entire Chapter ' + (pending.shortLabel || '') +
                         ' (' + pending.articleIds.length + ' sections)';
    entire.style.display = 'none';
  } else {
    saving.textContent = 'Saving section ' + (pending.shortLabel || '');
    entire.style.display = 'none';
  }

  input.value = '';
  modal.classList.add('open');

  // position near the clicked star, clamped to viewport
  var r  = anchorEl.getBoundingClientRect();
  modal.style.visibility = 'hidden';
  var mw = modal.offsetWidth, mh = modal.offsetHeight;
  var left = Math.min(r.left, window.innerWidth  - mw - 8);
  var top  = r.bottom + 6;
  if (top + mh > window.innerHeight - 8) { top = Math.max(8, r.top - mh - 6); }
  modal.style.left = Math.max(8, left) + 'px';
  modal.style.top  = top + 'px';
  modal.style.visibility = '';

  setTimeout(function() { input.focus(); }, 0);
}

function closeNickModal() {
  document.getElementById('nick-modal').classList.remove('open');
  nickPending = null;
}

function commitNickModal(useEntire) {
  if (!nickPending) { return; }
  var entry = useEntire ? nickPending.entire : nickPending.pending;
  var nick  = document.getElementById('nick-input').value.trim();
  saveFavoriteEntry(entry, nick);
  closeNickModal();
}

function shortLabelFor(id) {
  var m = deriveArticleMeta(id);
  return m.shortLabel;
}

function saveFavoriteEntry(entry, nickname) {
  var favs  = getFavorites();
  var favId = 'fav-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
  favs[favId] = {
    type:         entry.type,
    nickname:     nickname || '',
    articleIds:   entry.articleIds.slice(),
    chapterKey:   entry.chapterKey || '',
    shortLabel:   entry.shortLabel || '',
    officialName: entry.officialName || '',
    createdAt:    Date.now()
  };
  saveFavorites(favs);
  var order = getFavoritesOrder();
  order.push(favId);
  saveFavoritesOrder(order);
  refreshFavoritesPanel();
  refreshAllStars();
}

function removeFavorite(favId) {
  var favs = getFavorites();
  delete favs[favId];
  saveFavorites(favs);
  saveFavoritesOrder(getFavoritesOrder().filter(function(x) { return x !== favId; }));
  refreshFavoritesPanel();
  refreshAllStars();
}

function toggleFavoritesPanel() {
  var panel  = document.getElementById('favorites-panel');
  var btn    = document.getElementById('btn-favorites');
  if (panel.classList.contains('open')) {
    panel.classList.remove('open');
    btn.classList.remove('active');
  } else {
    panel.classList.add('open');
    btn.classList.add('active');
  }
}

// -- refresh star visuals (article stars + chapter stars) --
function refreshAllStars() {
  document.querySelectorAll('.star-btn[data-id]').forEach(function(btn) {
    var fav = isArticleFavorited(btn.dataset.id);
    if (fav) { btn.classList.add('starred'); btn.title = 'Remove from favorites'; }
    else     { btn.classList.remove('starred'); btn.title = 'Add to favorites'; }
  });
  document.querySelectorAll('.chapter-star[data-chapter-key]').forEach(function(btn) {
    updateChapterStar(btn.dataset.chapterKey);
  });
}

function updateChapterStar(chKey) {
  var btn = document.querySelector('.chapter-star[data-chapter-key="' + chKey + '"]');
  if (!btn) { return; }
  var faved = isChapterFavorited(chKey);
  if (faved) {
    btn.classList.add('starred');
    btn.textContent = '★';
    btn.title = 'Remove from favorites';
  } else {
    btn.classList.remove('starred');
    btn.textContent = '☆';
    btn.title = 'Favorite this chapter';
  }
}

function isChapterFavorited(chKey) {
  var favs = getFavorites();
  for (var k in favs) {
    if (!favs.hasOwnProperty(k)) { continue; }
    if (favs[k].type === 'chapter-set' && favs[k].chapterKey === chKey) { return true; }
  }
  return false;
}

// -- favorites panel --
function refreshFavoritesPanel() {
  var favs    = getFavorites();
  var order   = reconcileFavoritesOrder();
  var favList = document.getElementById('favorites-list');
  favList.innerHTML = '';

  if (order.length === 0) {
    var emptyEl = document.createElement('li');
    emptyEl.id = 'fav-empty';
    emptyEl.textContent = 'Star a section or chapter to save it here.';
    favList.appendChild(emptyEl);
    return;
  }

  for (var i = 0; i < order.length; i++) {
    var favId = order[i];
    if (!favs[favId]) { continue; }
    addFavItem(favList, favId, favs[favId]);
  }
  syncFavCheckboxes();
}

function addFavItem(favList, favId, entry) {
  var li = document.createElement('li');
  li.className     = 'fav-item';
  li.dataset.favId = favId;
  li.draggable     = true;

  // drag handle
  var handle = document.createElement('span');
  handle.className   = 'fav-drag';
  handle.textContent = '≡';
  handle.title       = 'Drag to reorder';

  // fake checkbox
  var fcb = document.createElement('div');
  fcb.className = 'fav-fakecb';
  fcb.title     = 'Load / unload these sections';
  fcb.addEventListener('click', function(ev) {
    ev.stopPropagation();
    toggleFavLoad(entry);
  });

  // main text block
  var main = document.createElement('div');
  main.className = 'fav-main';

  var row1 = document.createElement('div');
  row1.className = 'fav-row1';

  var idBadge = document.createElement('span');
  idBadge.className   = 'fav-id';
  idBadge.textContent = (entry.type === 'chapter-set' ? 'Ch ' : '') + (entry.shortLabel || '');

  var nick = document.createElement('span');
  nick.className   = 'fav-nick';
  nick.textContent = entry.nickname || entry.officialName || entry.shortLabel || favId;
  nick.title       = 'Double-click to rename';
  nick.addEventListener('dblclick', function(ev) {
    ev.stopPropagation();
    startInlineEdit(nick, favId);
  });

  row1.appendChild(idBadge);
  row1.appendChild(nick);

  var sub = document.createElement('span');
  sub.className   = 'fav-sub';
  sub.textContent = entry.officialName || '';
  main.appendChild(row1);
  main.appendChild(sub);

  // chapter-sets that are a subset -- show the member shortLabels
  if (entry.type === 'chapter-set') {
    var allIds = getChapterArticleIds(entry.chapterKey);
    if (entry.articleIds.length < allIds.length) {
      var subset = document.createElement('span');
      subset.className   = 'fav-subset';
      subset.textContent = entry.articleIds.map(shortLabelFor).join(', ');
      main.appendChild(subset);
    }
  }

  // click main -- toggle load
  main.addEventListener('click', function() { toggleFavLoad(entry); });

  // remove button (two-click confirm)
  var rm = document.createElement('button');
  rm.className   = 'fav-remove';
  rm.textContent = '✕';
  rm.title       = 'Remove favorite';
  var armed = false, armTimer = null;
  rm.addEventListener('click', function(ev) {
    ev.stopPropagation();
    if (!armed) {
      armed = true;
      rm.classList.add('confirm');
      armTimer = setTimeout(function() {
        armed = false; rm.classList.remove('confirm');
      }, 2000);
      return;
    }
    if (armTimer) { clearTimeout(armTimer); }
    removeFavorite(favId);
  });

  li.appendChild(handle);
  li.appendChild(fcb);
  li.appendChild(main);
  li.appendChild(rm);
  favList.appendChild(li);

  attachFavDrag(li);
}

// fake-checkbox click: any unloaded -- load all; all loaded -- unload all
function toggleFavLoad(entry) {
  var ids = entry.articleIds || [];
  if (ids.length === 0) { return; }
  var anyUnloaded = ids.some(function(id) { return !isLoaded(id); });
  if (anyUnloaded && ids.length > 0) { batchScrollTargetId = ids[0]; }
  for (var i = 0; i < ids.length; i++) {
    var item = document.querySelector('.article-item[data-id="' + ids[i] + '"]');
    if (item) { setItemChecked(item, anyUnloaded); }
  }
  if (anyUnloaded) {
    scrollToChunk(batchScrollTargetId);
    setTimeout(function() { batchScrollTargetId = null; }, 500);
  }
  syncFavCheckboxes();
}

// fake checkboxes mirror loaded state: all/some/none
function syncFavCheckboxes() {
  var favs = getFavorites();
  document.querySelectorAll('.fav-item').forEach(function(li) {
    var entry = favs[li.dataset.favId];
    if (!entry) { return; }
    var ids = entry.articleIds || [];
    var n   = loadedCount(ids);
    var fcb = li.querySelector('.fav-fakecb');
    fcb.classList.remove('checked', 'indeterminate');
    if (ids.length > 0 && n === ids.length)      { fcb.classList.add('checked'); }
    else if (n > 0)                              { fcb.classList.add('indeterminate'); }
  });
}

// double-click nickname -- contenteditable, blur saves
function startInlineEdit(span, favId) {
  span.contentEditable = 'true';
  span.focus();
  var range = document.createRange();
  range.selectNodeContents(span);
  var sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);

  function finish() {
    span.contentEditable = 'false';
    span.removeEventListener('blur', finish);
    span.removeEventListener('keydown', onKey);
    var favs = getFavorites();
    if (favs[favId]) {
      favs[favId].nickname = span.textContent.trim();
      saveFavorites(favs);
    }
  }
  function onKey(ev) {
    if (ev.key === 'Enter') { ev.preventDefault(); span.blur(); }
    if (ev.key === 'Escape') {
      var favs = getFavorites();
      span.textContent = (favs[favId] && favs[favId].nickname) ||
                         (favs[favId] && favs[favId].officialName) || '';
      span.blur();
    }
  }
  span.addEventListener('blur', finish);
  span.addEventListener('keydown', onKey);
}

// -- drag-to-reorder (desktop) --
var favDragSrc = null;

function attachFavDrag(li) {
  li.addEventListener('dragstart', function(e) {
    favDragSrc = li;
    li.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', li.dataset.favId); } catch(ex) {}
  });
  li.addEventListener('dragend', function() {
    li.classList.remove('dragging');
    document.querySelectorAll('.fav-item.drag-over').forEach(function(x) {
      x.classList.remove('drag-over');
    });
    favDragSrc = null;
  });
  li.addEventListener('dragover', function(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (li !== favDragSrc) { li.classList.add('drag-over'); }
  });
  li.addEventListener('dragleave', function() { li.classList.remove('drag-over'); });
  li.addEventListener('drop', function(e) {
    e.preventDefault();
    li.classList.remove('drag-over');
    if (!favDragSrc || favDragSrc === li) { return; }
    var list = li.parentNode;
    var rect = li.getBoundingClientRect();
    var after = (e.clientY - rect.top) > rect.height / 2;
    list.insertBefore(favDragSrc, after ? li.nextSibling : li);
    // persist new order
    var newOrder = [];
    list.querySelectorAll('.fav-item').forEach(function(x) { newOrder.push(x.dataset.favId); });
    saveFavoritesOrder(newOrder);
  });
}


// .-.-.   .-.-.   .-.-.   .-.-.   .-.-.   .-.-.   .-.-.   .-.-
// / / \ \ / / \ \ / / \ \ / / \ \ / / \ \ / / \ \ / / \ \ / / \
//`-'   `-`-'   `-`-'   `-`-'   `-`-'   `-`-'   `-`-'   `-`-'
// Supplement + ordinance range badge
// .-.-.   .-.-.   .-.-.   .-.-.   .-.-.   .-.-.   .-.-.   .-.-


function checkSupplement(localSupp) {
  var badge = document.getElementById('supplement-badge');
  if (!localSupp) {
    badge.textContent = 'Supplement: unknown';
    return;
  }
  badge.textContent = SUPPLEMENT_LABEL + ' ' + localSupp;

  // fetch overview page to get "through Ord XX-YY" range
  var xhr = new XMLHttpRequest();
  xhr.open('GET', OVERVIEW_URL, true);
  xhr.timeout = 8000;
  xhr.onload = function() {
    if (xhr.status !== 200) { return; }
    var m = xhr.responseText.match(/Supplement\s+[\d]+,\s*[\d]+-[\d]+\s+Ordinance No\.\s*[\d]+-[\d]+\s+through\s+Ordinance No\.\s*([\d]+-[\d]+)/i);
    if (!m) {
      // fallback: just grab the ordinance range text near supplement
      m = xhr.responseText.match(/Ordinance No\.\s*([\d]+-[\d]+)\s+through\s+Ordinance No\.\s*([\d]+-[\d]+)/i);
    }
    if (m) {
      var range = m[0].replace(/\s+/g, ' ').trim();
      badge.textContent = SUPPLEMENT_LABEL + ' ' + localSupp + ' | ' + range;
    }
  };
  xhr.onerror = function() {};
  xhr.ontimeout = function() {};
  xhr.send();
}

function checkLive() {
  window.open(OVERVIEW_URL, '_blank');
}


// .-.-.   .-.-.   .-.-.   .-.-.   .-.-.   .-.-.   .-.-.   .-.-
// / / \ \ / / \ \ / / \ \ / / \ \ / / \ \ / / \ \ / / \ \ / / \
//`-'   `-`-'   `-`-'   `-`-'   `-`-'   `-`-'   `-`-'   `-`-'
// Feature A: Quick Finder (combined finder + search)
// .-.-.   .-.-.   .-.-.   .-.-.   .-.-.   .-.-.   .-.-.   .-.-


var finderActiveIdx = -1;   // index of focused dropdown row
var finderMatches   = [];   // current matched articles

function initFinder() {
  var input = document.getElementById('finder-input');
  var dd    = document.getElementById('finder-dropdown');
  if (!input || !dd) { return; }

  input.addEventListener('input', function() {
    renderFinderDropdown(input.value);
  });

  input.addEventListener('keydown', function(e) {
    var open = dd.classList.contains('open');
    if (e.key === 'ArrowDown') {
      if (!open) { renderFinderDropdown(input.value); }
      e.preventDefault();
      moveFinderActive(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      moveFinderActive(-1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      finderEnter(input.value);
    } else if (e.key === 'Escape') {
      closeFinderDropdown();
    }
  });

  // click-outside closes the dropdown
  document.addEventListener('click', function(e) {
    if (!e.target.closest('#finder-search-wrap')) { closeFinderDropdown(); }
  });
}

function finderMatch(query) {
  var q = (query || '').trim().toLowerCase();
  if (!q) { return []; }
  var out = [];

  // chapter-level matches first
  for (var ci = 0; ci < finderChapterIndex.length; ci++) {
    var ch = finderChapterIndex[ci];
    if (ch.chapterLabel.toLowerCase().indexOf(q) !== -1) {
      out.push({ type: 'chapter', chapterKey: ch.chapterKey,
                 chapterLabel: ch.chapterLabel, articleIds: ch.articleIds });
      if (out.length >= 10) { break; }
    }
  }

  // article-level matches
  for (var i = 0; i < finderIndex.length; i++) {
    var a = finderIndex[i];
    if ((a.shortLabel + ' ' + a.title).toLowerCase().indexOf(q) !== -1) {
      out.push({ type: 'article', id: a.id, shortLabel: a.shortLabel,
                 title: a.title, chapterKey: a.chapterKey });
      if (out.length >= 60) { break; }
    }
  }
  return out;
}

function renderFinderDropdown(query) {
  var dd = document.getElementById('finder-dropdown');
  finderMatches   = finderMatch(query);
  finderActiveIdx = -1;
  dd.innerHTML = '';

  if (!query.trim()) { closeFinderDropdown(); return; }

  if (finderMatches.length === 0) {
    var hint = document.createElement('div');
    hint.className   = 'fr-hint';
    hint.textContent = 'No match -- press Enter to search on the web.';
    dd.appendChild(hint);
    dd.classList.add('open');
    return;
  }

  for (var i = 0; i < finderMatches.length; i++) {
    (function(a, idx) {
      var row = document.createElement('div');
      row.className = 'finder-row';
      row.dataset.idx = String(idx);

      var lab = document.createElement('span');
      lab.className = 'fr-label';

      var tit = document.createElement('span');
      tit.className = 'fr-title';

      if (a.type === 'chapter') {
        lab.textContent = 'Ch';
        lab.style.color = '#888';
        tit.textContent = tocTitleCase(a.chapterLabel);
        row.style.borderLeft = '3px solid #ccc';
      } else {
        lab.textContent = a.shortLabel;
        tit.textContent = a.title;
      }

      row.appendChild(lab);
      row.appendChild(tit);
      row.addEventListener('mousedown', function(e) {
        e.preventDefault();
        if (a.type === 'chapter') {
          selectFinderChapter(a.chapterKey, a.articleIds);
        } else {
          selectFinderArticle(a.id);
        }
      });
      row.addEventListener('mouseenter', function() { setFinderActive(idx); });
      dd.appendChild(row);
    })(finderMatches[i], i);
  }
  dd.classList.add('open');
}

function moveFinderActive(delta) {
  if (finderMatches.length === 0) { return; }
  var n = finderMatches.length;
  finderActiveIdx = (finderActiveIdx + delta + n) % n;
  setFinderActive(finderActiveIdx);
}

function setFinderActive(idx) {
  finderActiveIdx = idx;
  var rows = document.querySelectorAll('#finder-dropdown .finder-row');
  for (var i = 0; i < rows.length; i++) {
    if (i === idx) {
      rows[i].classList.add('active');
      rows[i].scrollIntoView({ block: 'nearest' });
    } else {
      rows[i].classList.remove('active');
    }
  }
}

function closeFinderDropdown() {
  var dd = document.getElementById('finder-dropdown');
  dd.classList.remove('open');
  dd.innerHTML = '';
  finderActiveIdx = -1;
  finderMatches   = [];
}

function selectFinderArticle(id) {
  var item = document.querySelector('.article-item[data-id="' + id + '"]');
  if (item) {
    setItemChecked(item, true);
    scrollToChunk(id);
  }
  closeFinderDropdown();
}

function selectFinderChapter(chapterKey, articleIds) {
  setChapterCollapsed(chapterKey, false);
  if (articleIds && articleIds.length > 0) {
    batchScrollTargetId = articleIds[0];
    for (var i = 0; i < articleIds.length; i++) {
      var item = document.querySelector('.article-item[data-id="' + articleIds[i] + '"]');
      if (item) { setItemChecked(item, true); }
    }
    scrollToChunk(batchScrollTargetId);
    setTimeout(function() { batchScrollTargetId = null; }, 500);
  }
  closeFinderDropdown();
}

function finderEnter(query) {
  // Enter on a focused row -- select it
  if (finderActiveIdx >= 0 && finderMatches[finderActiveIdx]) {
    var m = finderMatches[finderActiveIdx];
    if (m.type === 'chapter') {
      selectFinderChapter(m.chapterKey, m.articleIds);
    } else {
      selectFinderArticle(m.id);
    }
    return;
  }
  // exact shortLabel match -- select even without focus
  var q = (query || '').trim().toLowerCase();
  for (var i = 0; i < finderIndex.length; i++) {
    if (finderIndex[i].shortLabel.toLowerCase() === q) {
      selectFinderArticle(finderIndex[i].id);
      return;
    }
  }
  if (!q) { return; }
  // no selection and no exact match -- web search fallback
  // use county searchScopeUrl for site: scoping when available
  var county = indexData && indexData.county;
  var scope  = county && county.searchScopeUrl;
  var searchQ = scope
    ? 'site:' + scope + ' ' + query
    : query;
  window.open('https://www.google.com/search?q=' + encodeURIComponent(searchQ), '_blank');
  closeFinderDropdown();
}


// .-.-.   .-.-.   .-.-.   .-.-.   .-.-.   .-.-.   .-.-.   .-.-
// / / \ \ / / \ \ / / \ \ / / \ \ / / \ \ / / \ \ / / \ \ / / \
//`-'   `-`-'   `-`-'   `-`-'   `-`-'   `-`-'   `-`-'   `-`-'
// Nickname modal wiring
// .-.-.   .-.-.   .-.-.   .-.-.   .-.-.   .-.-.   .-.-.   .-.-


(function() {
  function wire() {
    var save   = document.getElementById('nick-save');
    var cancel = document.getElementById('nick-cancel');
    var entire = document.getElementById('nick-entire');
    var input  = document.getElementById('nick-input');
    var modal  = document.getElementById('nick-modal');
    if (!save) { return; }

    save.addEventListener('click', function() { commitNickModal(false); });
    cancel.addEventListener('click', function() { closeNickModal(); });
    entire.addEventListener('click', function() { commitNickModal(true); });

    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter')  { e.preventDefault(); commitNickModal(false); }
      if (e.key === 'Escape') { closeNickModal(); }
    });

    // click outside cancels (don't save)
    document.addEventListener('mousedown', function(e) {
      if (modal.classList.contains('open') &&
          !e.target.closest('#nick-modal') &&
          !e.target.closest('.star-btn') &&
          !e.target.closest('.chapter-star')) {
        closeNickModal();
      }
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }
})();


// .-.-.   .-.-.   .-.-.   .-.-.   .-.-.   .-.-.   .-.-.   .-.-
// / / \ \ / / \ \ / / \ \ / / \ \ / / \ \ / / \ \ / / \ \ / / \
//`-'   `-`-'   `-`-'   `-`-'   `-`-'   `-`-'   `-`-'   `-`-'
// Sidebar control wiring (replaces inline onclick attrs in template)
// .-.-.   .-.-.   .-.-.   .-.-.   .-.-.   .-.-.   .-.-.   .-.-


(function() {
  function wire() {
    var btnAll  = document.getElementById('btn-select-all');
    var btnNone = document.getElementById('btn-select-none');
    var btnFavs = document.getElementById('btn-favorites');
    var liveLink = document.getElementById('check-live-link');

    if (btnAll)   { btnAll.addEventListener('click',  function() { selectAll(); }); }
    if (btnNone)  { btnNone.addEventListener('click', function() { selectNone(); }); }
    if (btnFavs)  { btnFavs.addEventListener('click', function() { toggleFavoritesPanel(); }); }
    if (liveLink) {
      liveLink.addEventListener('click', function(e) {
        e.preventDefault();
        checkLive();
      });
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }
})();


// .-.-.   .-.-.   .-.-.   .-.-.   .-.-.   .-.-.   .-.-.   .-.-
// / / \ \ / / \ \ / / \ \ / / \ \ / / \ \ / / \ \ / / \ \ / / \
//`-'   `-`-'   `-`-'   `-`-'   `-`-'   `-`-'   `-`-'   `-`-'
// Startup
// .-.-.   .-.-.   .-.-.   .-.-.   .-.-.   .-.-.   .-.-.   .-.-


var indexXhr = new XMLHttpRequest();
indexXhr.open('GET', CHUNKS_DIR + 'index.json', true);

indexXhr.onload = function() {
  if (indexXhr.status !== 200) {
    document.getElementById('chapter-list').innerHTML =
      '<div style="padding:12px;color:red;font-size:12px;">Failed to load index.json (' +
      indexXhr.status + '). Run the pipeline script first, serve over HTTP.</div>';
    return;
  }
  indexData = JSON.parse(indexXhr.responseText);
  // Apply county theming if present
  if (indexData.county) {
    var c = indexData.county;
    var root = document.documentElement;
    if (c.accentColor) { root.style.setProperty('--accent', c.accentColor); }
    if (c.headerColor) {
      root.style.setProperty('--header-bg', c.headerColor);
      root.style.setProperty('--accent-dark', c.headerColor);
    }
    var sealEl = document.getElementById('top-bar-seal');
    if (sealEl && c.sealUrl) { sealEl.src = c.sealUrl; sealEl.style.display = ''; }
    // swap favicon to county-specific icon if faviconUrl is set in county config
    if (c.faviconUrl) {
      var faviconEl = document.getElementById('favicon');
      if (faviconEl) { faviconEl.href = c.faviconUrl; }
    }
    var titleEl = document.getElementById('top-bar-title');
    if (titleEl && c.name) { titleEl.textContent = c.name; }
    if (c.overviewUrl) { OVERVIEW_URL = c.overviewUrl; }

    // new legislation bar
    var newLegBar = document.getElementById('new-leg-bar');
    if (newLegBar) {
      if (c.newLegislationUrl) {
        var newLegLink  = newLegBar.querySelector('a');
        var newLegLabel = c.newLegislationLabel || 'New Legislation';
        if (newLegLink) { newLegLink.href = c.newLegislationUrl; newLegLink.textContent = newLegLabel; }
        newLegBar.style.display = '';
      } else {
        newLegBar.style.display = 'none';
      }
    }

    // sidebar header: "{shortName} Chapters & Articles" or generic
    var sidebarH2 = document.querySelector('#sidebar-header h2');
    if (sidebarH2) {
      sidebarH2.textContent = (c.shortName ? c.shortName + ' ' : '') + 'Chapters & Articles';
    }

    // supplement badge prefix from county config
    if (c.supplementLabel) { SUPPLEMENT_LABEL = c.supplementLabel; }
  }
  // support old index.json format (chapters flat) by wrapping
  if (!indexData.titles && indexData.chapters) {
    indexData.titles = [{ titleLabel: 'All Chapters', chapters: indexData.chapters }];
  }
  checkSupplement(indexData.supplement || '');
  migrateFavorites();   // convert any old {id:true} favorites to the new format
  renderSidebar();
  initFinder();
};

indexXhr.onerror = function() {
  document.getElementById('chapter-list').innerHTML =
    '<div style="padding:12px;color:red;font-size:12px;">' +
    'Cannot load index.json &mdash; serve over HTTP<br>' +
    '<code>python -m http.server 8000</code></div>';
};

indexXhr.send();


// .-.-.   .-.-.   .-.-.   .-.-.   .-.-.   .-.-.   .-.-.   .-.-
// / / \ \ / / \ \ / / \ \ / / \ \ / / \ \ / / \ \ / / \ \ / / \
//`-'   `-`-'   `-`-'   `-`-'   `-`-'   `-`-'   `-`-'   `-`-'
// Lazy image loading
// .-.-.   .-.-.   .-.-.   .-.-.   .-.-.   .-.-.   .-.-.   .-.-


var lazyObserver = null;

function initLazyImages(root) {
  if (!root) { root = document.getElementById('main') || document.body; }
  var imgs = root.querySelectorAll('img[data-lazy-src]');
  if (imgs.length === 0) { return; }

  if ('IntersectionObserver' in window) {
    if (!lazyObserver) {
      lazyObserver = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting) {
            var img = entry.target;
            img.src = img.dataset.lazySrc;
            delete img.dataset.lazySrc;
            lazyObserver.unobserve(img);
          }
        });
      }, { root: document.getElementById('main'), rootMargin: '300px' });
    }
    imgs.forEach(function(img) { lazyObserver.observe(img); });
  } else {
    imgs.forEach(function(img) { img.src = img.dataset.lazySrc; delete img.dataset.lazySrc; });
  }
}

