(function() {
  var sidebar   = document.getElementById('sidebar');
  var handle    = document.getElementById('sidebar-resize');
  var dragging  = false;
  var startX    = 0;
  var startW    = 0;

  handle.addEventListener('mousedown', function(e) {
    dragging = true;
    startX   = e.clientX;
    startW   = sidebar.offsetWidth;
    document.body.style.cursor    = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', function(e) {
    if (!dragging) { return; }
    var delta  = e.clientX - startX;
    var newW   = Math.max(160, Math.min(600, startW + delta));
    sidebar.style.width = newW + 'px';
  });

  document.addEventListener('mouseup', function() {
    if (!dragging) { return; }
    dragging = false;
    document.body.style.cursor     = '';
    document.body.style.userSelect = '';
    try { localStorage.setItem('ord-sidebar-width', sidebar.offsetWidth); } catch(e) {}
  });

  // restore saved width
  try {
    var saved = localStorage.getItem('ord-sidebar-width');
    if (saved) { sidebar.style.width = parseInt(saved) + 'px'; }
  } catch(e) {}
})();