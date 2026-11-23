/* ==========================================================================
   NAV.JS
   ========================================================================== */

function watchBusinessConfig() {
  db.collection("businessConfig").doc("main").onSnapshot((doc) => {
    const name = doc.exists ? doc.data().companyName : "Misty Code";
    applyLogo(name || "Misty Code");
  });
}

document.addEventListener("DOMContentLoaded", () => {
  watchBusinessConfig();
});

(function () {
  const btn      = document.getElementById("mcMenuBtn");
  const panel    = document.getElementById("mcMenuPanel");
  const backdrop = document.getElementById("mcMenuBackdrop");
  if (!btn || !panel || !backdrop) return;

  function setOpen(open) {
    panel.classList.toggle("open", open);
    backdrop.classList.toggle("open", open);
    btn.classList.toggle("open", open);
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    btn.textContent = open ? "✕" : "☰";
  }

  btn.addEventListener("click", () => setOpen(!panel.classList.contains("open")));
  backdrop.addEventListener("click", () => setOpen(false));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") setOpen(false); });

  // Close after tapping any link
  panel.querySelectorAll("a").forEach((a) =>
    a.addEventListener("click", () => setOpen(false))
  );

  // Highlight the current page
  const here = location.pathname.split("/").pop();
  panel.querySelectorAll("a").forEach((a) => {
    if (a.getAttribute("href") === here) a.classList.add("active");
  });
})();
