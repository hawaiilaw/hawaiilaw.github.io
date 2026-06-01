function hexToRgba(hex, alpha) {
  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) { return hex; }
  var r = parseInt(result[1], 16);
  var g = parseInt(result[2], 16);
  var b = parseInt(result[3], 16);
  return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + alpha + ')';
}

var HIGHLIGHT_SWATCHES = ['#ffff00', '#ffcc00', '#ffd580', '#ff6b6b', '#ff9999', '#6bcb77', '#b8f0b8', '#4d96ff', '#99ccff', '#f97316', '#a855f7', '#14b8a6'];
var hlSwatchIndex = 0;

function advanceHighlightColor() {
  hlSwatchIndex = (hlSwatchIndex + 1) % HIGHLIGHT_SWATCHES.length;
  var next = HIGHLIGHT_SWATCHES[hlSwatchIndex];
  var input = document.getElementById('highlightcolor');
  if (!input) { return; }
  input.value = next;
  // update the coloris field wrapper color so the swatch button shows the new color
  var field = input.closest('.clr-field');
  if (field) { field.style.color = next; }
  // tell coloris to sync — dispatch input event so it picks up the new value
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function applyHighlightAndAdvance() {
  var textEl  = document.getElementById('texthighlight');
  var colorEl = document.getElementById('highlightcolor');
  if (!textEl || !colorEl) { return; }
  var text  = textEl.value.trim();
  var color = colorEl.value;
  if (!text) { return; }
  highlightText(text, hexToRgba(color, 0.45));
  textEl.value = '';
  advanceHighlightColor();
}

(function() {
  function initColoris() {
    Coloris({
      el: '#highlightcolor',
      swatches: HIGHLIGHT_SWATCHES,
      swatchesOnly: false,
      alpha: false,
      wrap: true,
      theme: 'default',
      themeMode: 'light',
      format: 'hex',
      formatToggle: false,
      clearButton: false,
      closeButton: true,
      closeLabel: 'Done'
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initColoris);
  } else {
    initColoris();
  }
})();
