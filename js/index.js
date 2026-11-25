/* ==========================================================================
   INDEX.JS — sign-in page logic + 3D ocean interactions
   --------------------------------------------------------------------------
   Original functionality (role choice, sign-in, forgot password, back links,
   redirect handling, logo, toasts) is preserved exactly.
   New additions:
     • 3D pointer tracking → sets --rx/--ry/--mx/--my on .login-shell
     • Bubble generator → injects <span>s into #oceanBubbles
     • Password show/hide → #togglePasswordBtn (eye) + #showPasswordCheck
       kept in sync, both drive #passwordInput.type
   ========================================================================== */

let selectedRole = null;

const roleChoiceEl      = document.getElementById("roleChoice");
const loginFormEl       = document.getElementById("loginForm");
const forgotConfirmEl   = document.getElementById("forgotConfirm");

const loginTitleEl      = document.getElementById("loginTitle");
const loginSubEl        = document.getElementById("loginSub");
const emailInputEl      = document.getElementById("emailInput");
const passwordInputEl   = document.getElementById("passwordInput");
const loginErrorEl      = document.getElementById("loginError");
const loginSubmitBtn    = document.getElementById("loginSubmitBtn");

const togglePasswordBtn = document.getElementById("togglePasswordBtn");
const showPasswordCheck = document.getElementById("showPasswordCheck");

/* ==========================================================================
   AUTH REDIRECT + REDIRECT ERROR TOAST  (unchanged)
   ========================================================================== */

auth.onAuthStateChanged((user) => {
  if (user) window.location.href = "pages/pos.html";
});

const loginErrorFromRedirect = sessionStorage.getItem("mc_login_error");
if (loginErrorFromRedirect) {
  sessionStorage.removeItem("mc_login_error");
  showToast(loginErrorFromRedirect, "danger");
}

loadAndApplyLogo();

/* ==========================================================================
   ROLE CHOICE  (unchanged behaviour)
   ========================================================================== */

document.querySelectorAll(".role-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    selectedRole = btn.dataset.role;
    const email = FIXED_EMAILS[selectedRole];
    loginTitleEl.textContent = selectedRole === "manager" ? "Manager sign in" : "Seller sign in";
    loginSubEl.textContent = "Enter your password to continue.";
    emailInputEl.value = email;
    roleChoiceEl.classList.add("hidden");
    loginFormEl.classList.remove("hidden");
    forgotConfirmEl.classList.add("hidden");
    loginErrorEl.classList.add("hidden");

    // Reset password visibility whenever we enter the form fresh
    passwordInputEl.value = "";
    setPasswordVisible(false);

    passwordInputEl.focus();
  });
});

document.getElementById("backToRoles").addEventListener("click", () => {
  loginFormEl.classList.add("hidden");
  roleChoiceEl.classList.remove("hidden");
});

/* ==========================================================================
   SIGN-IN SUBMIT  (unchanged)
   ========================================================================== */

loginFormEl.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginErrorEl.classList.add("hidden");
  loginSubmitBtn.disabled = true;
  loginSubmitBtn.textContent = "Signing in…";
  try {
    await auth.signInWithEmailAndPassword(emailInputEl.value, passwordInputEl.value);
  } catch (err) {
    let message = "Something went wrong. Please try again.";
    if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") message = "Incorrect password. Please try again.";
    else if (err.code === "auth/user-not-found") message = "No account found for this role yet. Ask the manager to set it up in Firebase.";
    else if (err.code === "auth/too-many-requests") message = "Too many attempts. Please wait a moment and try again.";
    else if (err.code === "auth/network-request-failed") message = "No connection. Check the internet and try again.";
    loginErrorEl.textContent = message;
    loginErrorEl.classList.remove("hidden");
    loginSubmitBtn.disabled = false;
    loginSubmitBtn.textContent = "Sign in";
  }
});

/* ==========================================================================
   FORGOT PASSWORD  (unchanged)
   ========================================================================== */

document.getElementById("forgotPasswordBtn").addEventListener("click", async () => {
  if (!selectedRole) return;
  const email = FIXED_EMAILS[selectedRole];
  try { await auth.sendPasswordResetEmail(email); } catch (err) { console.warn("Password reset error:", err); }
  document.getElementById("forgotEmailShown").textContent = email;
  loginFormEl.classList.add("hidden");
  forgotConfirmEl.classList.remove("hidden");
});

document.getElementById("forgotBackBtn").addEventListener("click", () => {
  forgotConfirmEl.classList.add("hidden");
  loginFormEl.classList.remove("hidden");
});

/* ==========================================================================
   PASSWORD SHOW / HIDE
   --------------------------------------------------------------------------
   Two controls, one source of truth: the checkbox (#showPasswordCheck).
   Clicking the eye toggles the checkbox; changing the checkbox flips the
   input type and updates the eye icon + ARIA state. They can never drift.
   ========================================================================== */

function setPasswordVisible(visible) {
  if (!passwordInputEl) return;

  passwordInputEl.type = visible ? "text" : "password";

  if (showPasswordCheck) showPasswordCheck.checked = visible;

  if (togglePasswordBtn) {
    togglePasswordBtn.classList.toggle("is-visible", visible);
    togglePasswordBtn.setAttribute("aria-pressed", visible ? "true" : "false");
    togglePasswordBtn.setAttribute("aria-label", visible ? "Hide password" : "Show password");
    togglePasswordBtn.setAttribute("title",      visible ? "Hide password" : "Show password");
  }
}

function isPasswordVisible() {
  return passwordInputEl && passwordInputEl.type === "text";
}

if (togglePasswordBtn) {
  togglePasswordBtn.addEventListener("click", () => {
    const nowVisible = !isPasswordVisible();
    setPasswordVisible(nowVisible);
    // Keep focus in the password field so typing can continue immediately
    if (passwordInputEl) passwordInputEl.focus();
  });
}

if (showPasswordCheck) {
  showPasswordCheck.addEventListener("change", () => {
    setPasswordVisible(showPasswordCheck.checked);
  });
}

// Initialise to the hidden state on load
setPasswordVisible(false);

/* ==========================================================================
   3D POINTER TRACKING — tilts the cube and parallax-shifts inner layers
   --------------------------------------------------------------------------
   Pointer position is normalised to -1…1 on each axis, then written to CSS
   variables on .login-shell:
     --rx : rotateX in degrees  (from vertical mouse position)
     --ry : rotateY in degrees  (from horizontal mouse position)
     --mx : parallax X offset in px
     --my : parallax Y offset in px
   An rAF loop eases the current values toward targets and stops itself
   when movement is negligible — no wasted frames.
   ========================================================================== */

(function initOceanTilt() {
  const shellEl = document.querySelector(".login-shell");
  if (!shellEl) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isTouch      = window.matchMedia("(hover: none)").matches;
  if (reduceMotion || isTouch) return;   // leave the static layout alone

  const MAX_TILT  = 5;     // degrees max rotation on each axis
  const MAX_SHIFT = 10;    // px max parallax travel
  const SMOOTH    = 0.12;  // easing factor per frame

  let targetX = 0, targetY = 0;   // tilt targets  (deg)
  let targetMx = 0, targetMy = 0; // parallax targets (px)
  let currentX = 0, currentY = 0;
  let currentMx = 0, currentMy = 0;
  let rafId = null;

  function tick() {
    currentX  += (targetX  - currentX)  * SMOOTH;
    currentY  += (targetY  - currentY)  * SMOOTH;
    currentMx += (targetMx - currentMx) * SMOOTH;
    currentMy += (targetMy - currentMy) * SMOOTH;

    shellEl.style.setProperty("--rx", currentX.toFixed(3));
    shellEl.style.setProperty("--ry", currentY.toFixed(3));
    shellEl.style.setProperty("--mx", currentMx.toFixed(2));
    shellEl.style.setProperty("--my", currentMy.toFixed(2));

    const settled =
      Math.abs(targetX  - currentX)  < 0.01 &&
      Math.abs(targetY  - currentY)  < 0.01 &&
      Math.abs(targetMx - currentMx) < 0.05 &&
      Math.abs(targetMy - currentMy) < 0.05;

    if (settled) {
      rafId = null;                      // stop; next move restarts us
    } else {
      rafId = requestAnimationFrame(tick);
    }
  }

  function kick() {
    if (rafId === null) rafId = requestAnimationFrame(tick);
  }

  window.addEventListener("mousemove", (e) => {
    const nx = (e.clientX / window.innerWidth)  * 2 - 1;  // -1 … 1
    const ny = (e.clientY / window.innerHeight) * 2 - 1;

    // Mouse right → rotateY negative (cube turns away naturally)
    targetY = -nx * MAX_TILT;
    // Mouse down  → rotateX positive (top of cube tips toward viewer)
    targetX =  ny * MAX_TILT;

    targetMx = -nx * MAX_SHIFT;
    targetMy = -ny * MAX_SHIFT;

    kick();
  });

  // Recentre gently when pointer leaves the window
  window.addEventListener("mouseleave", () => {
    targetX = 0; targetY = 0; targetMx = 0; targetMy = 0;
    kick();
  });
})();

/* ==========================================================================
   BUBBLE GENERATOR — fills #oceanBubbles with drifting <span>s
   --------------------------------------------------------------------------
   Purely decorative. Sizes, positions, durations and delays are randomised
   once at load; CSS handles the rise animation. Skipped entirely when the
   user prefers reduced motion.
   ========================================================================== */

(function initOceanBubbles() {
  const container = document.getElementById("oceanBubbles");
  if (!container) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) return;

  const BUBBLE_COUNT = 22;
  const frag = document.createDocumentFragment();

  for (let i = 0; i < BUBBLE_COUNT; i++) {
    const bubble = document.createElement("span");

    const size     = 6  + Math.random() * 26;          // px, 6–32
    const left     = Math.random() * 100;              // %
    const duration = 12 + Math.random() * 18;          // s, 12–30
    const delay    = -Math.random() * duration;        // s, negative = mid-animation
    const drift    = (Math.random() * 40 - 20).toFixed(1); // px, -20…20

    bubble.style.width  = size + "px";
    bubble.style.height = size + "px";
    bubble.style.left   = left + "%";
    bubble.style.animationDuration = duration.toFixed(2) + "s";
    bubble.style.animationDelay    = delay.toFixed(2) + "s";
    // Per-bubble horizontal drift via a CSS custom prop the keyframes read
    bubble.style.setProperty("--drift", drift + "px");
    // Vary opacity slightly so the field looks layered
    bubble.style.opacity = (0.35 + Math.random() * 0.5).toFixed(2);

    frag.appendChild(bubble);
  }

  container.appendChild(frag);
})();
