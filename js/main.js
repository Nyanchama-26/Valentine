(function () {
  "use strict";

  /* Site root, derived from this script's own URL so asset paths resolve
     correctly from any page depth (homepage, /projects/*.html) and under a
     GitHub Pages subpath such as /Valentine/. */
  var scriptEl = document.currentScript || document.querySelector('script[src$="js/main.js"]');
  var ROOT = scriptEl ? scriptEl.src.replace(/js\/main\.js(\?.*)?$/, "") : "";

  /* ===================== DRAWING DATA ===================== */
  /* Real supplied structural drawing sheets. Titles are taken directly
     from each sheet's title block. */
  var DRAWING_SETS = {
    "baobab-block-a": {
      label: "Maridadi Block A, structural details",
      original: "assets/documents/baobab-maridadi-block-a.pdf",
      sheets: [
        { src: "baobab-block-a-01", title: "Roof and Gutter Slab Layout and Reinforcement Details" },
        { src: "baobab-block-a-02", title: "Beam Layout, Beam Section and Column Sections" },
        { src: "baobab-block-a-03", title: "Column Details Layout and Column Base Details" }
      ]
    },
    "baobab-restaurant": {
      label: "Maridadi Restaurant, structural details",
      original: "assets/documents/baobab-maridadi-restaurant.pdf",
      sheets: [
        { src: "baobab-restaurant-01", title: "Column Base and Column Layout" },
        { src: "baobab-restaurant-02", title: "Slab and Beam Layout of Maridadi Restaurant" },
        { src: "baobab-restaurant-03", title: "Slab, Gutter Layout and Section Reinforcement Details" },
        { src: "baobab-restaurant-04", title: "Beam Reinforcement Layout of Maridadi Restaurant" }
      ]
    },
    "baobab-amphitheater": {
      label: "Porini Amphitheater, foundation details",
      original: "assets/documents/baobab-porini-amphitheater.pdf",
      sheets: [
        { src: "baobab-amphitheater-01", title: "Foundation Level Layout and Column Reinforcement Details" },
        { src: "baobab-amphitheater-02", title: "Column Bases of Porini Amphitheater" }
      ]
    },
    "kileleshwa": {
      label: "Kileleshwa Residence, structural drawings",
      original: "assets/documents/kileleshwa-structural.pdf",
      sheets: [
        { src: "kileleshwa-01", title: "Foundation Layout, Column, Column Base and Strip Footing" },
        { src: "kileleshwa-02", title: "First Floor Beam and Reinforcement Layouts" },
        { src: "kileleshwa-03", title: "Attic Floor Reinforcement Details Layouts" },
        { src: "kileleshwa-04", title: "Beam and Staircase Reinforcement Details Layouts" },
        { src: "kileleshwa-05", title: "Beam Reinforcement Details Layouts" }
      ]
    },
    "jabe-jermalili": {
      label: "Townhouse structural drawings, Hai Kasire",
      original: "assets/documents/townhouse-jabe-jermalili.pdf",
      sheets: [
        { src: "jabe-jermalili-01", title: "Foundation Layout, Strip Footing and Column Bases" },
        { src: "jabe-jermalili-02", title: "Ground and First Floor Beam Layout and Slab Reinforcements" },
        { src: "jabe-jermalili-03", title: "Staircase Details" }
      ]
    }
  };

  Object.keys(DRAWING_SETS).forEach(function (key) {
    DRAWING_SETS[key].original = ROOT + DRAWING_SETS[key].original;
  });

  var THUMB_DIR = ROOT + "assets/drawings/thumb/";
  var FULL_DIR = ROOT + "assets/drawings/full/";

  /* ===================== RENDER GALLERIES ===================== */
  function renderGalleries() {
    var galleries = document.querySelectorAll("[data-drawing-gallery]");
    galleries.forEach(function (gallery) {
      var keys = gallery.getAttribute("data-drawing-gallery").split(",").map(function (s) { return s.trim(); });
      keys.forEach(function (key) {
        var set = DRAWING_SETS[key];
        if (!set) return;
        var wrap = document.createElement("div");
        wrap.className = "drawing-set";

        var label = document.createElement("div");
        label.className = "drawing-set__label";
        var span = document.createElement("span");
        span.textContent = set.label;
        var link = document.createElement("a");
        link.href = set.original;
        link.textContent = "Open original PDF";
        label.appendChild(span);
        label.appendChild(link);
        wrap.appendChild(label);

        var thumbs = document.createElement("div");
        thumbs.className = "drawing-set__thumbs";
        set.sheets.forEach(function (sheet, idx) {
          var btn = document.createElement("button");
          btn.type = "button";
          btn.className = "drawing-thumb";
          btn.setAttribute("data-set", key);
          btn.setAttribute("data-index", idx);
          btn.setAttribute("aria-label", "Open drawing: " + sheet.title + " (sheet " + (idx + 1) + " of " + set.sheets.length + ")");
          var img = document.createElement("img");
          img.src = THUMB_DIR + sheet.src + ".webp";
          img.alt = sheet.title + " (technical drawing)";
          img.loading = "lazy";
          img.decoding = "async";
          btn.appendChild(img);
          var idxTag = document.createElement("span");
          idxTag.className = "drawing-thumb__index";
          idxTag.textContent = (idx + 1) + "/" + set.sheets.length;
          btn.appendChild(idxTag);
          thumbs.appendChild(btn);
        });
        wrap.appendChild(thumbs);
        gallery.appendChild(wrap);
      });
    });
  }

  /* ===================== DRAWING VIEWER ===================== */
  var viewer = document.getElementById("drawing-viewer");
  var viewerStage = document.getElementById("viewer-stage");
  var viewerCanvas = document.getElementById("viewer-canvas");
  var viewerImg = document.getElementById("viewer-image");
  var viewerTitle = document.getElementById("viewer-title");
  var viewerCount = document.getElementById("viewer-count");
  var viewerCaption = document.getElementById("viewer-caption");
  var viewerOriginal = document.getElementById("viewer-original");
  var prevBtn = document.getElementById("viewer-prev");
  var nextBtn = document.getElementById("viewer-next");
  var closeBtn = document.getElementById("viewer-close");
  var zoomInBtn = document.getElementById("viewer-zoom-in");
  var zoomOutBtn = document.getElementById("viewer-zoom-out");

  var currentSet = null;
  var currentIndex = 0;
  var lastFocusedEl = null;

  /* ---- pan / zoom state ---- */
  var scale = 1, tx = 0, ty = 0;
  var MIN_SCALE = 1, MAX_SCALE = 5;
  var activePointers = new Map();
  var isPanning = false;
  var panStart = { x: 0, y: 0, tx: 0, ty: 0 };
  var pinchStartDist = 0, pinchStartScale = 1;

  function applyTransform() {
    viewerImg.style.transform = "translate(" + tx + "px, " + ty + "px) scale(" + scale + ")";
    viewerCanvas.classList.toggle("is-panning", isPanning);
  }

  function clampPan() {
    var w = viewerImg.offsetWidth, h = viewerImg.offsetHeight;
    var maxX = Math.max(0, (w * scale - w) / 2);
    var maxY = Math.max(0, (h * scale - h) / 2);
    tx = Math.min(maxX, Math.max(-maxX, tx));
    ty = Math.min(maxY, Math.max(-maxY, ty));
  }

  function setScale(next) {
    scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, next));
    if (scale === MIN_SCALE) { tx = 0; ty = 0; }
    clampPan();
    applyTransform();
  }

  function resetZoom() {
    scale = 1; tx = 0; ty = 0;
    applyTransform();
  }

  function openViewer(setKey, index) {
    var set = DRAWING_SETS[setKey];
    if (!set) return;
    currentSet = setKey;
    currentIndex = index;
    lastFocusedEl = document.activeElement;
    updateViewer();
    viewer.classList.add("is-open");
    viewer.setAttribute("aria-hidden", "false");
    document.body.classList.add("menu-open");
    closeBtn.focus();
    document.addEventListener("keydown", onViewerKeydown);
  }

  function closeViewer() {
    viewer.classList.remove("is-open");
    viewer.setAttribute("aria-hidden", "true");
    document.body.classList.remove("menu-open");
    document.removeEventListener("keydown", onViewerKeydown);
    if (lastFocusedEl && typeof lastFocusedEl.focus === "function") {
      lastFocusedEl.focus();
    }
  }

  function updateViewer() {
    var set = DRAWING_SETS[currentSet];
    var sheet = set.sheets[currentIndex];
    resetZoom();
    viewerImg.src = FULL_DIR + sheet.src + ".webp";
    viewerImg.alt = sheet.title + " (technical drawing)";
    viewerTitle.textContent = set.label;
    viewerCaption.textContent = sheet.title;
    viewerCount.textContent = (currentIndex + 1) + " / " + set.sheets.length;
    viewerOriginal.href = set.original;
    prevBtn.hidden = set.sheets.length <= 1;
    nextBtn.hidden = set.sheets.length <= 1;
  }

  function stepViewer(delta) {
    var set = DRAWING_SETS[currentSet];
    currentIndex = (currentIndex + delta + set.sheets.length) % set.sheets.length;
    updateViewer();
  }

  function onViewerKeydown(e) {
    if (e.key === "Escape") { closeViewer(); return; }
    if (scale === 1) {
      if (e.key === "ArrowRight") { stepViewer(1); return; }
      if (e.key === "ArrowLeft") { stepViewer(-1); return; }
    }
    if (e.key === "+" || e.key === "=") { setScale(scale + 0.5); return; }
    if (e.key === "-") { setScale(scale - 0.5); return; }
    if (e.key === "Tab") {
      var focusables = viewer.querySelectorAll("button:not([hidden]), a[href]");
      if (!focusables.length) return;
      var first = focusables[0], last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    }
  }

  document.addEventListener("click", function (e) {
    var thumb = e.target.closest(".drawing-thumb");
    if (thumb) {
      openViewer(thumb.getAttribute("data-set"), parseInt(thumb.getAttribute("data-index"), 10));
    }
  });

  closeBtn.addEventListener("click", closeViewer);
  prevBtn.addEventListener("click", function () { stepViewer(-1); });
  nextBtn.addEventListener("click", function () { stepViewer(1); });
  zoomInBtn.addEventListener("click", function () { setScale(scale + 0.6); });
  zoomOutBtn.addEventListener("click", function () { setScale(scale - 0.6); });
  viewer.addEventListener("click", function (e) {
    if (e.target === viewer || e.target === viewerStage) closeViewer();
  });

  /* ---- wheel zoom (desktop) ---- */
  viewerCanvas.addEventListener("wheel", function (e) {
    e.preventDefault();
    var delta = e.deltaY > 0 ? -0.4 : 0.4;
    setScale(scale + delta);
  }, { passive: false });

  /* ---- double-click / double-tap to toggle zoom ---- */
  viewerCanvas.addEventListener("dblclick", function () {
    setScale(scale > 1 ? 1 : 2.5);
  });

  /* ---- pointer-based pan + pinch zoom ---- */
  function pointerDistance() {
    var pts = Array.from(activePointers.values());
    var dx = pts[0].x - pts[1].x, dy = pts[0].y - pts[1].y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  viewerCanvas.addEventListener("pointerdown", function (e) {
    viewerCanvas.setPointerCapture(e.pointerId);
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (activePointers.size === 1 && scale > 1) {
      isPanning = true;
      panStart = { x: e.clientX, y: e.clientY, tx: tx, ty: ty };
      applyTransform();
    } else if (activePointers.size === 2) {
      isPanning = false;
      pinchStartDist = pointerDistance();
      pinchStartScale = scale;
    }
  });

  viewerCanvas.addEventListener("pointermove", function (e) {
    if (!activePointers.has(e.pointerId)) return;
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointers.size === 2) {
      var dist = pointerDistance();
      if (pinchStartDist > 0) {
        setScale(pinchStartScale * (dist / pinchStartDist));
      }
    } else if (isPanning && activePointers.size === 1) {
      tx = panStart.tx + (e.clientX - panStart.x);
      ty = panStart.ty + (e.clientY - panStart.y);
      clampPan();
      applyTransform();
    }
  });

  function endPointer(e) {
    activePointers.delete(e.pointerId);
    if (activePointers.size < 2) { pinchStartDist = 0; }
    if (activePointers.size === 0) { isPanning = false; applyTransform(); }
  }
  viewerCanvas.addEventListener("pointerup", endPointer);
  viewerCanvas.addEventListener("pointercancel", endPointer);
  viewerCanvas.addEventListener("pointerleave", function (e) {
    if (activePointers.size === 1) endPointer(e);
  });

  /* ===================== MOBILE MENU ===================== */
  var menuToggle = document.getElementById("menu-toggle");
  var mobileMenu = document.getElementById("mobile-menu");
  var menuClose = document.getElementById("menu-close");

  function openMenu() {
    mobileMenu.classList.add("is-open");
    document.body.classList.add("menu-open");
    menuToggle.setAttribute("aria-expanded", "true");
    menuClose.focus();
  }
  function closeMenu() {
    mobileMenu.classList.remove("is-open");
    document.body.classList.remove("menu-open");
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.focus();
  }
  menuToggle.addEventListener("click", openMenu);
  menuClose.addEventListener("click", closeMenu);
  mobileMenu.querySelectorAll("a").forEach(function (a) {
    a.addEventListener("click", closeMenu);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && mobileMenu.classList.contains("is-open")) closeMenu();
  });

  /* ===================== REVEAL ON SCROLL ===================== */
  function initReveal() {
    var items = document.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window) || !items.length) {
      items.forEach(function (el) { el.classList.add("is-visible"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    items.forEach(function (el) { io.observe(el); });
  }

  /* ===================== SCROLLSPY NAV ===================== */
  function initScrollspy() {
    var navLinks = Array.prototype.slice.call(document.querySelectorAll(".primary-nav a"));
    if (!navLinks.length || !("IntersectionObserver" in window)) return;
    var map = [];
    navLinks.forEach(function (link) {
      var href = link.getAttribute("href");
      if (!href || href.charAt(0) !== "#") return; // skip cross-page links (e.g. ../index.html#about)
      var target = document.querySelector(href);
      if (target) map.push({ link: link, section: target });
    });
    if (!map.length) return;

    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var entryMap = map.filter(function (m) { return m.section === entry.target; })[0];
        if (!entryMap || !entry.isIntersecting) return;
        map.forEach(function (m) {
          m.link.classList.remove("is-active");
          m.link.removeAttribute("aria-current");
        });
        entryMap.link.classList.add("is-active");
        entryMap.link.setAttribute("aria-current", "true");
      });
    }, { rootMargin: "-45% 0px -50% 0px", threshold: 0 });

    map.forEach(function (m) { spy.observe(m.section); });
  }

  /* ===================== BACK TO TOP ===================== */
  function initBackToTop() {
    var btn = document.getElementById("back-to-top");
    if (!btn) return;
    var ticking = false;
    function update() {
      btn.classList.toggle("is-visible", window.scrollY > 560);
      ticking = false;
    }
    window.addEventListener("scroll", function () {
      if (!ticking) { window.requestAnimationFrame(update); ticking = true; }
    }, { passive: true });
    btn.addEventListener("click", function () {
      var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    });
  }

  /* ===================== INIT ===================== */
  document.addEventListener("DOMContentLoaded", function () {
    renderGalleries();

    // mark section headings for reveal BEFORE observing them
    document.querySelectorAll("[data-reveal]").forEach(function (el) {
      el.classList.add("reveal");
    });

    initReveal();
    initScrollspy();
    initBackToTop();
  });

  // Update footer year
  var yearEl = document.getElementById("current-year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();
})();
