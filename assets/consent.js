/**
 * Cookie consent gate — shared across all 9 pages. Nothing that sets a cookie
 * (GA4, or the hidden booking pre-warm iframe on every page but /contact) loads
 * until the visitor accepts. Choice is remembered in localStorage so returning
 * visitors who already answered don't see the banner again.
 *
 * The visible booking widget on /contact itself is NOT gated — that one is
 * core functionality the visitor came to use, not a background nicety.
 */
(function () {
  var GA_ID = "G-5ZW5PGE2YG";
  var BOOKING_ORIGIN = "https://cstlfalcrum.vercel.app";

  // Meta (Instagram/Facebook) Pixel — lets Meta see which ad visitors go on to
  // book. Left empty = Meta never loads and the banner keeps its original
  // "not shared" wording. Paste the Pixel/Dataset ID from Meta Events Manager
  // here to switch it on.
  var META_PIXEL_ID = "2409128286280968";

  // With the pixel on, data IS shared with Meta, so earlier "Accept" answers
  // (given to a banner that said it wasn't) don't count — a new key makes
  // everyone see the updated banner once.
  var STORAGE_KEY = META_PIXEL_ID ? "cstl_consent_v2" : "cstl_consent";

  var stored = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch (e) {}

  function loadGA() {
    if (window.gtag) return; // already loaded (e.g. banner re-triggered)
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () {
      dataLayer.push(arguments);
    };
    gtag("js", new Date());
    gtag("config", GA_ID);
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + GA_ID;
    document.head.appendChild(s);
  }

  function loadMetaPixel() {
    if (!META_PIXEL_ID || window.fbq) return;
    // Meta's standard base snippet, unminified enough to read.
    var n = (window.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    });
    window._fbq = n;
    n.push = n;
    n.loaded = true;
    n.version = "2.0";
    n.queue = [];
    fbq("init", META_PIXEL_ID);
    fbq("track", "PageView");
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(s);
  }

  function loadPrewarm() {
    var here = location.pathname.replace(/\/$/, "") || "/";
    if (here === "/contact" || here === "/contact.html") return;
    if (document.querySelector("iframe[data-prewarm]")) return;

    // Runs the actual iframe insertion once the browser is idle (or after a
    // 3s cap), so booting the ~160KB booking app doesn't compete with the
    // visible page's own load — it's a background nicety, not something the
    // visitor is waiting on. requestIdleCallback isn't in Safari, hence the
    // setTimeout fallback.
    var insert = function () {
      if (document.querySelector("iframe[data-prewarm]")) return;
      var f = document.createElement("iframe");
      f.src = BOOKING_ORIGIN + "/book";
      f.style.cssText = "display:none;width:0;height:0;border:none;position:absolute;";
      f.title = "";
      f.setAttribute("aria-hidden", "true");
      f.tabIndex = -1;
      f.loading = "eager";
      f.setAttribute("data-prewarm", "");
      document.body.appendChild(f);
    };

    if ("requestIdleCallback" in window) {
      requestIdleCallback(insert, { timeout: 3000 });
    } else {
      setTimeout(insert, 2000);
    }
  }

  function grant() {
    try {
      localStorage.setItem(STORAGE_KEY, "granted");
    } catch (e) {}
    loadGA();
    loadMetaPixel();
    loadPrewarm();
  }

  function deny() {
    try {
      localStorage.setItem(STORAGE_KEY, "denied");
    } catch (e) {}
  }

  function showBanner() {
    var el = document.createElement("div");
    el.className = "consent-banner";
    el.setAttribute("role", "region");
    el.setAttribute("aria-label", "Cookie consent");
    var message = META_PIXEL_ID
      ? "This site uses cookies from Google Analytics and Meta (Instagram) to see how many people visit, which pages are useful, and whether Instagram ads are reaching the right people. Nothing is sold. Declining won’t affect anything else on the site."
      : "This site uses a couple of analytics cookies to see how many people visit and which pages are useful — nothing is sold or shared with anyone else. Declining won’t affect anything else on the site.";
    el.innerHTML =
      "<p>" + message + "</p>" +
      '<div class="consent-actions">' +
      '<button type="button" class="consent-decline">Decline</button>' +
      '<button type="button" class="consent-accept">Accept</button>' +
      "</div>";
    document.body.appendChild(el);

    el.querySelector(".consent-accept").addEventListener("click", function () {
      grant();
      el.remove();
    });
    el.querySelector(".consent-decline").addEventListener("click", function () {
      deny();
      el.remove();
    });
  }

  if (stored === "granted") {
    loadGA();
    loadMetaPixel();
    loadPrewarm();
  } else if (stored !== "denied") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", showBanner);
    } else {
      showBanner();
    }
  }
})();
