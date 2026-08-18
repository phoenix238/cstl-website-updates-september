/**
 * Shared across all 8 pages. GA4 event tracking for the click paths that lead
 * to an enquiry or a booking, plus the newsletter form's submit handling and
 * the postMessage bridge that hears back from the booking widget iframe.
 *
 * Delegated at the document level (not per-link) so this one file covers
 * every page without each page needing to know which links exist. Reads
 * hrefs off the DOM rather than matching source text, because pages mix
 * quote styles (href='/contact' in navs, href="https://wa.me/…" in body copy).
 */
(function () {
  var BOOKING_ORIGIN = "https://cstlfalcrum.vercel.app";
  var SUBSCRIBE_ENDPOINT = BOOKING_ORIGIN + "/api/public/subscribe";

  function send(name, params) {
    if (typeof gtag === "function") gtag("event", name, params || {});
  }

  var here = location.pathname.replace(/\/$/, "") || "/";
  var onContactPage = here === "/contact" || here === "/contact.html";

  document.addEventListener(
    "click",
    function (ev) {
      var a = ev.target.closest && ev.target.closest("a");
      if (!a) return;
      var href = a.getAttribute("href") || "";

      if (a.classList.contains("wa-float")) {
        send("contact_whatsapp", { method: "whatsapp", placement: "float_button", page_path: here });
      } else if (href.indexOf("wa.me") !== -1) {
        send("contact_whatsapp", { method: "whatsapp", placement: "inline_link", page_path: here });
      } else if (href.indexOf("tel:") === 0) {
        send("contact_phone", { page_path: here });
      } else if (href.indexOf("mailto:") === 0) {
        send("contact_email", { page_path: here });
      } else if (href.indexOf("instagram.com") !== -1) {
        send("click_instagram", { page_path: here });
      } else if (!onContactPage && (href === "/contact" || href.indexOf("/contact") === 0 || href.indexOf("/contact.html") === 0)) {
        // Suppressed on the contact page itself — clicking "Contact / Book" while
        // already there isn't intent moving toward the page, it's already arrived.
        send("booking_intent_click", { placement: (a.textContent || "").trim().slice(0, 60), page_path: here });
      }
    },
    true,
  );

  // Booking widget: log when it scrolls into view, so drop-off before it's
  // visible is distinguishable from drop-off after.
  var bookFrame = document.querySelector(".book-frame");
  if (bookFrame && "IntersectionObserver" in window) {
    var seenWidget = false;
    new IntersectionObserver(
      function (entries, obs) {
        entries.forEach(function (e) {
          if (e.isIntersecting && !seenWidget) {
            seenWidget = true;
            send("booking_widget_view", { page_path: here });
            obs.disconnect();
          }
        });
      },
      { threshold: 0.4 },
    ).observe(bookFrame);
  }

  // Booking confirmation bridge. The booking app can't carry its own GA tag —
  // it's pre-warmed in a hidden iframe on every homepage visit (see the
  // comment at index.html's pre-warm iframe), so a pageview tag there would
  // fabricate a phantom /book view for every homepage visitor. Instead the
  // booking app posts a message on genuine confirmation and this page turns
  // that into the one GA event that matters. Both origin AND source are
  // checked — origin alone isn't enough to trust a postMessage.
  if (bookFrame) {
    window.addEventListener("message", function (e) {
      if (e.origin !== BOOKING_ORIGIN) return;
      if (e.source !== bookFrame.contentWindow) return;
      if (e.data && e.data.type === "cstl:booking_confirmed") {
        send("booking_confirmed", { clinic: e.data.clinic || "", page_path: here });
      }
    });
  }

  // Newsletter signup — lives in the footer on every page (see newsletter.css).
  // Posts the email to the booking app's /api/public/subscribe; the app adds
  // the person to its marketing (mail-merge) list.
  var nlForm = document.getElementById("newsletterForm");
  if (nlForm) {
    nlForm.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var st = document.getElementById("newsletterStatus");
      var btn = nlForm.querySelector('button[type="submit"]');

      if (nlForm.website.value) return; // honeypot

      var email = nlForm.email.value.trim();
      if (!email || email.indexOf("@") < 1 || email.indexOf(".") === -1) {
        st.textContent = "Please enter a valid email address.";
        st.className = "nl-status err";
        return;
      }

      btn.disabled = true;
      btn.textContent = "Subscribing…";
      st.textContent = "";
      st.className = "nl-status";

      fetch(SUBSCRIBE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email, website: nlForm.website.value, page: here }),
      })
        .then(function (res) {
          if (!res.ok) throw new Error("request failed");
          return res.json();
        })
        .then(function () {
          send("newsletter_signup", { page_path: here });
          nlForm.hidden = true;
          st.textContent = "You're subscribed — thank you. A few notes a year, nothing more.";
          st.className = "nl-status ok";
        })
        .catch(function () {
          st.textContent = "Something went wrong — please try again, or email phoenix@tanner.me and I'll add you.";
          st.className = "nl-status err";
          btn.disabled = false;
          btn.textContent = "Subscribe";
        });
    });
  }
})();
