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
  var STORAGE_KEY = "cstl_consent";

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

  function loadPrewarm() {
    var here = location.pathname.replace(/\/$/, "") || "/";
    if (here === "/contact" || here === "/contact.html") return;
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
  }

  function grant() {
    try {
      localStorage.setItem(STORAGE_KEY, "granted");
    } catch (e) {}
    loadGA();
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
    el.innerHTML =
      '<p>This site uses a couple of analytics cookies to see how many people visit and which pages are useful — nothing is sold or shared with anyone else. Declining won’t affect anything else on the site.</p>' +
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
    loadPrewarm();
  } else if (stored !== "denied") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", showBanner);
    } else {
      showBanner();
    }
  }
})();
