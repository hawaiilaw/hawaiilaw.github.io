
// ─────────────────────────────────────────────────────────────────────────────
// section-export.js
// DOCX export for article and chapter containers.
// Requires docx.umd.js loaded before this file.
// ─────────────────────────────────────────────────────────────────────────────

// ── Supplement identifier ─────────────────────────────────────────────────────

// Returns a sanitized identifier string like "ROH 2021 Supp 10 12-2025"
// derived from index.json supplement + county fields embedded in the page.
function getDocumentIdentifier() {
  var id = "";

  if (window.indexData) {
    var idx = window.indexData;

    // County/code name
    var codeName = "ROH";
    if (idx.county && idx.county.name) {
      codeName = idx.county.name
        .replace(/[^\w\s\-]/g, "")
        .trim();
    }

    // Supplement string — strip characters that are bad in filenames
    var supp = "";
    if (idx.supplement) {
      supp = idx.supplement
        .replace(/[^\w\s,\-]/g, "")
        .replace(/,/g, "")
        .trim();
    }

    id = codeName;
    if (supp) { id = id + " Supp " + supp; }
  }

  return id || "Ordinance Export";
}

// ── DOM → docx paragraph conversion ──────────────────────────────────────────

function textRunsFromEl(el) {
  var docx = window.docx;
  var runs = [];

  function walk(node, bold, italic) {
    if (node.nodeType === Node.TEXT_NODE) {
      var text = node.textContent;
      if (text) {
        runs.push(new docx.TextRun({ text: text, bold: bold, italics: italic }));
      }
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) { return; }
    var tag = node.tagName.toLowerCase();
    var isBold   = bold   || tag === "b" || tag === "strong";
    var isItalic = italic || tag === "i" || tag === "em";
    Array.from(node.childNodes).forEach(function(child) {
      walk(child, isBold, isItalic);
    });
  }

  walk(el, false, false);
  return runs;
}

// Convert a DOM element to an array of docx Paragraph objects.
function elToParas(el, docxRef) {
  var docx = docxRef;
  var paras = [];
  var tag = el.tagName ? el.tagName.toLowerCase() : "";

  if (tag === "h1" || tag === "h2" || tag === "h3") {
    var runs = textRunsFromEl(el);
    if (runs.length) {
      paras.push(new docx.Paragraph({
        children: runs,
        heading: docx.HeadingLevel.HEADING_1,
        spacing: { before: 200, after: 100 }
      }));
    }
    return paras;
  }

  if (tag === "h4" || tag === "h5" || tag === "h6") {
    var runs = textRunsFromEl(el);
    if (runs.length) {
      paras.push(new docx.Paragraph({
        children: runs,
        heading: docx.HeadingLevel.HEADING_2,
        spacing: { before: 160, after: 80 }
      }));
    }
    return paras;
  }

  if (tag === "p" || tag === "div" || tag === "li") {
    var runs = textRunsFromEl(el);
    if (runs.length) {
      paras.push(new docx.Paragraph({
        children: runs,
        spacing: { before: 60, after: 60 }
      }));
    }
    // Also recurse into block children that are themselves block-level
    Array.from(el.children).forEach(function(child) {
      var ct = child.tagName.toLowerCase();
      if (ct === "p" || ct === "div" || ct === "ul" || ct === "ol" || ct === "table") {
        elToParas(child, docx).forEach(function(p) { paras.push(p); });
      }
    });
    return paras;
  }

  if (tag === "ul" || tag === "ol") {
    Array.from(el.children).forEach(function(li) {
      var runs = textRunsFromEl(li);
      if (runs.length) {
        paras.push(new docx.Paragraph({
          children: runs,
          bullet: { level: 0 },
          spacing: { before: 40, after: 40 }
        }));
      }
    });
    return paras;
  }

  // Generic: recurse into children
  Array.from(el.children).forEach(function(child) {
    elToParas(child, docx).forEach(function(p) { paras.push(p); });
  });

  return paras;
}

// ── Main export function ──────────────────────────────────────────────────────

async function exportAsDocx(container, baseFilename) {
  if (!window.docx) {
    alert("docx library not loaded — cannot export .docx");
    return;
  }

  var docxLib = window.docx;
  var identifier = getDocumentIdentifier();
  var filename = baseFilename + ".docx";

  // Collect paragraphs from container children
  var paragraphs = [];

  // Header paragraph with identifier
  if (identifier) {
    paragraphs.push(new docxLib.Paragraph({
      children: [new docxLib.TextRun({
        text: identifier,
        bold: true,
        color: "888888",
        size: 18
      })],
      spacing: { after: 200 }
    }));
  }

  Array.from(container.children).forEach(function(child) {
    elToParas(child, docxLib).forEach(function(p) { paragraphs.push(p); });
  });

  if (!paragraphs.length) {
    // Fallback: plain text
    paragraphs.push(new docxLib.Paragraph({
      children: [new docxLib.TextRun({ text: container.innerText })]
    }));
  }

  // Letter size: 8.5in x 11in = 12240 x 15840 twips (1in = 1440 twips)
  // 0.5in margins = 720 twips
  var doc = new docxLib.Document({
    sections: [{
      properties: {
        page: {
          size: {
            width:  12240,
            height: 15840
          },
          margin: {
            top:    720,
            bottom: 720,
            left:   720,
            right:  720
          }
        }
      },
      children: paragraphs
    }]
  });

  var blob = await docxLib.Packer.toBlob(doc);
  var url  = URL.createObjectURL(blob);
  var link = document.createElement("a");
  link.href     = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(function() { URL.revokeObjectURL(url); }, 5000);

  console.log("Exported DOCX:", filename);
}
