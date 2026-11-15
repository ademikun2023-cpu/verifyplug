// ================= FIREBASE =================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  increment,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ================= CONFIG =================
const firebaseConfig = {
  apiKey: "AIzaSyAFkCQI646z0NTyKZB1ZL7D5EYZuxGTSlY",
  authDomain: "verifyplug-a28d6.firebaseapp.com",
  projectId: "verifyplug-a28d6",
  storageBucket: "verifyplug-a28d6.firebasestorage.app",
  messagingSenderId: "244761045495",
  appId: "1:244761045495:web:4c2f0091a7a46a7272e6f2"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ===== Cloudinary (free image hosting — no server, no card) =====
const CLOUDINARY_CLOUD  = "gotgehnt";
const CLOUDINARY_PRESET = "verifyplug_unsigned";

// shrink the image in the browser first (saves the vendor's data + your quota)
function resizeImage(file, maxDim = 600, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const img = new Image();
    reader.onload = e => { img.src = e.target.result; };
    reader.onerror = reject;
    img.onload = () => {
      let { width, height } = img;
      if (width > height && width > maxDim) { height = height * maxDim / width; width = maxDim; }
      else if (height > maxDim) { width = width * maxDim / height; height = maxDim; }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      canvas.toBlob(b => b ? resolve(b) : reject(new Error("resize failed")), "image/jpeg", quality);
    };
    img.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// upload to Cloudinary (unsigned), returns the hosted image URL
async function uploadVendorPhoto(file) {
  const blob = await resizeImage(file);
  const form = new FormData();
  form.append("file", blob);
  form.append("upload_preset", CLOUDINARY_PRESET);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, {
    method: "POST", body: form
  });
  if (!res.ok) throw new Error("upload failed");
  const data = await res.json();
  return data.secure_url;
}

const protectedPage = /(?:vendor|customer|admin)\.html$/.test(location.pathname);
let dashboardRequest = 0;
function deadline(promise, ms = 15000) {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("Connection timed out")), ms);
  })]).finally(() => clearTimeout(timer));
}
function pageState(state, message) {
  document.body.dataset.state = state;
  const loading = document.getElementById("pageLoading");
  const error = document.getElementById("pageError");
  const content = document.getElementById("mainContainer");
  if (loading) loading.hidden = state !== "loading";
  if (error) error.hidden = state !== "error";
  if (content) { content.hidden = !["ready", "new"].includes(state); content.setAttribute("aria-busy", String(state === "loading")); }
  if (message && document.getElementById("pageErrorMessage")) document.getElementById("pageErrorMessage").textContent = message;
  const form = document.getElementById("vendorForm");
  const dashboard = document.getElementById("vendorDashboard");
  if (form) form.hidden = state !== "new";
  if (dashboard) dashboard.hidden = state !== "ready";
}
function normalizedPhone(value) {
  const compact = String(value).replace(/[\s()-]/g, "");
  return /^(?:\+?234)[789]\d{9}$/.test(compact) ? "0" + compact.replace(/^\+?234/, "") : compact;
}
function phoneVariants(value) {
  const phone = normalizedPhone(value);
  return /^0[789]\d{9}$/.test(phone) ? [phone, "234" + phone.slice(1), "+234" + phone.slice(1)] : [phone];
}
function scoreOf(value) {
  const number = value == null ? 50 : Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : 50;
}
function inlineCall(name, ...args) {
  return escapeHtml(`${name}(${args.map(a => JSON.stringify(a ?? "")).join(",")})`);
}
window.logout = async () => { await signOut(auth); location.replace("auth.html"); };
window.retryPage = () => initializePage(auth.currentUser);

let vendorCache = null;
let vendorCacheTime = 0;

const CACHE_DURATION = 60 * 1000; // 1 minute
async function getVendorsCached() {

  const now = Date.now();

  if (vendorCache && (now - vendorCacheTime < CACHE_DURATION)) {
    return vendorCache;
  }

  const snap = await getDocs(collection(db, "vendors"));

  const vendors = [];

  snap.forEach(doc => {
    vendors.push({ id: doc.id, ...doc.data() });
  });

  vendorCache = vendors;
  vendorCacheTime = now;

  return vendors;
}

// ============================
// SECURITY HELPER — escape anything user/vendor supplied before putting it in innerHTML
// ============================
function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ============================
// VALIDATION HELPERS
// ============================
function validatePassword(password) {

  const lengthCheck = password.length >= 8;
  const capsCheck = /[A-Z]/.test(password);
  const symbolCheck = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  if (!lengthCheck) return "Password must be at least 8 characters";
  if (!capsCheck) return "Password must contain at least 1 uppercase letter";
  if (!symbolCheck) return "Password must contain at least 1 special symbol";

  return null;
}

function getDeviceId() {

  let deviceId = localStorage.getItem("deviceId");

  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem("deviceId", deviceId);
  }

  return deviceId;
}

function getVendorStatus(trustScore) {

  if (trustScore >= 90) {
    return { label: "Highly recommended", className: "status-recommended" };
  }
  if (trustScore >= 70) {
    return { label: "Trusted vendor", className: "status-trusted" };
  }
  if (trustScore >= 50) {
    return { label: "Normal Vendor", className: "status-normal" };
  }
  if (trustScore >= 21) {
    return { label: "Use caution", className: "status-weak" };
  }
  return { label: "Restricted vendor", className: "status-banned" };
}

function getVerifiedBadge(vendor) {
  if (vendor.verifiedPurchase === true && (vendor.trustScore ?? 50) >= 50) {
    return "Purchase-code verified";
  }
  return "";
}

function filterVendors(vendors) {
  return vendors.filter(v => {
    const score = v.trustScore ?? 50;
    if (v.banned === true) return false;
    if (score <= 20) return false;
    return true;
  });
}

function sortVendors(vendors) {
  return vendors.sort((a, b) => {
    const scoreA = a.trustScore ?? 50;
    const scoreB = b.trustScore ?? 50;
    return scoreB - scoreA; // highest trust first
  });
}

function renderEmptyState(container) {
  container.innerHTML = `
    <div style="text-align:center;opacity:0.6;padding:20px;font-size:14px;">
      No vendors available yet.
    </div>
  `;
}

// ============================
// TOAST SYSTEM (hardened)
// ============================
window.showToast = function (message, type = "success") {

  let toast = document.getElementById("toast");

  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast";
    document.body.appendChild(toast);
  }

  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");
  toast.textContent = message;

  // base id styling lives in CSS; classes drive colour + visibility
  toast.className = "";
  toast.classList.add(type, "show");

  clearTimeout(window.toastTimer);

  window.toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 3200);
};

// copy-to-clipboard helper (used by purchase codes)
window.copyCode = function (code) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(code)
      .then(() => showToast("Code copied ✔", "success"))
      .catch(() => showToast(code, "success"));
  } else {
    showToast(code, "success");
  }
};

// show the chosen file name inside a styled .file-upload label
window.showFileName = function (input) {
  const label = input.closest(".file-upload");
  const span = label ? label.querySelector(".file-name") : null;
  if (span) span.textContent = input.files?.[0]?.name || "";
};

// ================= ROUTING =================
window.goCustomer = () => location.href = "customer.html";
window.goVendor = () => location.href = "vendor.html";

// ================= AUTH =================
window.signup = async () => {

  const email = document.getElementById("emailInput").value.trim();
  const password = document.getElementById("passwordInput").value;
  const role = document.getElementById("roleInput").value;

  try {

    if (!email || !password || !role) {
      showToast("All fields are required", "error");
      return;
    }

    const passwordRegex =
      /^(?=.*[A-Z])(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;

    if (!passwordRegex.test(password)) {
      showToast(
        "Password must be 8+ chars, include 1 uppercase & 1 special symbol",
        "error"
      );
      return;
    }

    const userCred =
      await createUserWithEmailAndPassword(auth, email, password);

    const user = userCred.user;

    await setDoc(
      doc(db, "users", user.uid),
      { email, role, verified: false, createdAt: Date.now() }
    );

    try {
      await sendEmailVerification(user);
      showToast("Account created. Check your inbox for the verification email, then sign in.", "success");
    } catch (error) {
      showToast("Account created, but the verification email could not be sent. You can sign in with your saved details.", "warning");
    } finally { await signOut(auth); }

  } catch (e) {

    console.error(e);

    let msg = e.message;
    if (msg.includes("email-already-in-use")) msg = "Email already in use";
    if (msg.includes("invalid-email")) msg = "Invalid email address";

    showToast(msg, "error");
  }
};

window.login = async () => {

  const email = document.getElementById("emailInput").value.trim();
  const password = document.getElementById("passwordInput").value;

  try {

    if (!email || !password) {
      showToast("Enter email and password", "error");
      return;
    }

    const userCred =
      await signInWithEmailAndPassword(auth, email, password);

    const user = userCred.user;

    // ADMIN BYPASS
    if (user.email === "ademikun2023@gmail.com") {
      showToast("Admin login successful ✔", "success");
      window.location.replace("admin.html");
      return;
    }

    const userSnap = await getDoc(doc(db, "users", user.uid));

    if (!userSnap.exists()) {
      showToast("User profile missing", "error");
      await signOut(auth);
      return;
    }

    const role = userSnap.data().role;

    showToast("Login successful ✔", "success");

    window.location.replace(role === "vendor" ? "vendor.html" : "customer.html");

  } catch (err) {

    console.error(err);

    let msg = err.message;
    if (msg.includes("user-not-found")) msg = "Account not found";
    if (msg.includes("wrong-password") || msg.includes("invalid-credential")) msg = "Email or password is incorrect";
    if (msg.includes("invalid-email")) msg = "Invalid email format";

    showToast(msg, "error");
  }
};

window.addVendor = async function () {

  const user = auth.currentUser;

  if (!user) {
    showToast("Login required", "error");
    return;
  }

  const vendorName = document.getElementById("vendorName").value.trim();
  const vendorPhone = document.getElementById("vendorPhone").value.trim();
  const vendorLocation = document.getElementById("vendorLocation").value.trim();
  const vendorCategory = document.getElementById("vendorCategory").value;

  // optional socials (handles / WhatsApp number)
  const socials = {
    whatsapp:  document.getElementById("vendorWhatsapp")?.value.trim()  || "",
    instagram: document.getElementById("vendorInstagram")?.value.trim() || "",
    tiktok:    document.getElementById("vendorTiktok")?.value.trim()    || "",
    x:         document.getElementById("vendorX")?.value.trim()         || ""
  };

  if (!vendorName || !vendorPhone || !vendorLocation || !vendorCategory) {
    showToast("Please fill all fields", "warning");
    return;
  }

  const cleanPhone = normalizedPhone(vendorPhone);
  if (!/^\+?\d{7,15}$/.test(cleanPhone)) { showToast("Enter a valid phone number", "warning"); return; }
  const own = await getDocs(query(collection(db, "vendors"), where("createdBy", "==", user.email)));
  if (!own.empty) { await loadVendorDashboard(); return; }

  const q = query(
    collection(db, "vendors"),
    where("phone", "in", phoneVariants(cleanPhone))
  );

  const existing = await getDocs(q);

  if (!existing.empty) {
    showToast("Vendor already exists", "error");
    return;
  }

  // optional business photo / logo
  let photoURL = "";
  const photoFile = document.getElementById("vendorPhoto")?.files?.[0];
  if (photoFile) {
    try {
      showToast("Uploading photo…", "success");
      photoURL = await uploadVendorPhoto(photoFile);
    } catch (e) {
      console.error(e);
      showToast("Photo upload failed — saving without it", "warning");
    }
  }

  await addDoc(
    collection(db, "vendors"),
    {
      name: vendorName,
      phone: cleanPhone,
      location: vendorLocation,
      category: vendorCategory,
      verified: false,
      banned: false,
      trustScore: 50,
      averageRating: 0,
      searchCount: 0,
      purchaseCodes: [],
      socials,
      photoURL,
      createdBy: user.email,
      createdAt: Date.now()
    }
  );

  showToast("Business added successfully ✔", "success");

  document.getElementById("vendorName").value = "";
  document.getElementById("vendorPhone").value = "";
  document.getElementById("vendorLocation").value = "";

  await loadVendorDashboard();
};

// ================= SEARCH =================
window.searchVendor = async () => {

  const searchInput = document.getElementById("searchInput");
  const result = document.getElementById("result");

  const value = normalizedPhone(searchInput.value.trim());

  if (!value) {
    showToast("Enter phone number", "error");
    return;
  }

  const q = query(
    collection(db, "vendors"),
    where("phone", "in", phoneVariants(value))
  );

  result.innerHTML = '<p role="status">Looking up this number…</p>';
  const snap = await deadline(getDocs(q));

  result.innerHTML = "";

  if (snap.empty) {
    result.innerHTML = `
      <div class="card">
        <p>No vendor found.</p>
      </div>
    `;
    return;
  }

  let html = "";

  snap.forEach((docItem) => {

    const data = docItem.data();

    const trustScore = scoreOf(data.trustScore);
    const status = data.banned ? {label: "Restricted vendor", className: "status-banned"} : getVendorStatus(trustScore);
    const verifiedBadge = getVerifiedBadge(data);

    html += `
      <div class="vendor-card">
        <div class="vendor-header">
          <h3>${escapeHtml(data.name)}</h3>
          <div class="badges">
            <span class="${status.className}">${status.label}</span>
            ${verifiedBadge ? `<span class="verified-badge">${verifiedBadge}</span>` : ""}
          </div>
        </div>

        <div class="vendor-info">
          <p>Phone: ${escapeHtml(data.phone) || "No phone"}</p>
          <p>Trust score: ${trustScore}%</p>
          <p>Buyer rating: ${Number(data.averageRating) || 0}/10</p>
          <p>Location: ${escapeHtml(data.location) || "No location"}</p>
        </div>

        <div class="vendor-actions">
          <a class="btn" href="v.html?id=${encodeURIComponent(docItem.id)}">View profile</a>
          ${!data.banned && trustScore > 20 ? `<button onclick="openReviewModal('${docItem.id}')" class="btn-secondary">Add review</button>` : `<span class="status-banned">Do not send money to this vendor.</span>`}
          <button onclick="viewReviews('${docItem.id}')" class="btn-secondary">View Reviews</button>
        </div>
      </div>
    `;
  });

  result.innerHTML = html;

  await Promise.allSettled(snap.docs.map(item => updateDoc(doc(db, "vendors", item.id), { searchCount: increment(1) })));
  try { await trackVendorSearch(); } catch (error) { console.error("Search counter could not sync", error); }
};

window.reportScam = async function () {

  const user = auth.currentUser;

  if (!user) {
    showToast("Login required", "error");
    return;
  }

  let phone = normalizedPhone(document.getElementById("scamPhone").value.trim());
  let reason = document.getElementById("scamReason").value.trim();

  if (!phone || !reason) {
    showToast("Fill all fields", "warning");
    return;
  }

  try {

    await addDoc(
      collection(db, "scamReports"),
      { reporterEmail: user.email, phone: phone, reason: reason, createdAt: new Date() }
    );

    const q = query(
      collection(db, "vendors"),
      where("phone", "in", phoneVariants(phone))
    );

    const snap = await getDocs(q);

    await Promise.all(snap.docs.map(async (docSnap) => {

      const data = docSnap.data();

      let currentScore = data.trustScore ?? 50;
      let updatedScore = currentScore - 25;
      if (updatedScore < 0) updatedScore = 0;

      let verifiedStatus = data.verified || false;
      if (updatedScore < 50) verifiedStatus = false;

      let bannedStatus = data.banned || false;
      if (updatedScore <= 20) {
        bannedStatus = true;
        verifiedStatus = false;
      }

      await updateDoc(
        doc(db, "vendors", docSnap.id),
        { trustScore: updatedScore, verified: verifiedStatus, banned: bannedStatus }
      );
    }));

    showToast("Report submitted ✔", "success");

    document.getElementById("scamPhone").value = "";
    document.getElementById("scamReason").value = "";

  } catch (err) {
    console.error(err);
    showToast("Something went wrong", "error");
  }
};

// ================= PAYSTACK =================
window.payForVerification = function (vendorId, email) {

  let handler = PaystackPop.setup({

    key: "pk_live_051922fbc194c192821f256f14ccab760e3fb35d",
    email: email,
    amount: 5000 * 100,
    currency: "NGN",

    callback: function (response) {
      console.log("Payment success:", response);

      // mark vendor verified, then refresh dashboard
      updateDoc(doc(db, "vendors", vendorId), { verified: true })
        .then(() => {
          showToast("Payment successful — you are now Verified ✔", "success");
          setTimeout(() => { loadVendorDashboard(); }, 1200);
        })
        .catch((err) => {
          console.error(err);
          showToast("Payment received but verification failed. Contact support.", "error");
        });
    },

    onClose: function () {
      showToast("Payment cancelled", "warning");
    }
  });

  handler.openIframe();
};

// ================= ADMIN (legacy single-list loader, kept for compatibility) =================
window.loadAdmin = async () => {

  try {

    const adminList = document.getElementById("adminList");
    if (!adminList) return;

    adminList.innerHTML = "<p>Loading vendors...</p>";

    const snap = await getDocs(collection(db, "vendors"));

    if (snap.empty) {
      adminList.innerHTML = "<p>No vendors found.</p>";
      return;
    }

    let html = "";

    snap.forEach((docItem) => {
      const data = docItem.data();
      html += `
        <div class="card">
          <h3>${escapeHtml(data.name) || "No name"}</h3>
          <p>Phone: ${escapeHtml(data.phone) || "No phone"}</p>
          <p>${data.banned ? "🚫 BANNED" : "🟢 ACTIVE"}</p>
          <button onclick="deleteVendor('${docItem.id}')">Delete</button>
        </div>
      `;
    });

    adminList.innerHTML = html;

  } catch (err) {
    console.error("Admin load error:", err);
    showToast("Failed to load admin panel", "error");
  }
};

window.deleteVendor = async (id) => {
  await deleteDoc(doc(db, "vendors", id));
  showToast("Deleted", "success");
  loadAdminDashboard();
};

window.setStatus = function (isPaid) {
  const dot = document.getElementById("statusDot");
  const text = document.getElementById("statusText");

  if (!text) return;

  if (isPaid) {
    if (dot) { dot.classList.add("status-paid"); dot.classList.remove("status-unpaid"); }
    text.innerText = "Verified";
  } else {
    if (dot) { dot.classList.add("status-unpaid"); dot.classList.remove("status-paid"); }
    text.innerText = "Not Verified";
  }
};

// ===============================
// VENDOR DASHBOARD
// ===============================
window.loadVendorDashboard = async function () {
  const user = auth.currentUser;
  const request = ++dashboardRequest;
  if (!user) { location.replace("auth.html"); return; }
  pageState("loading");
  try {
    const snap = await deadline(getDocs(query(collection(db, "vendors"), where("createdBy", "==", user.email))));
    if (request !== dashboardRequest || auth.currentUser?.uid !== user.uid) return;
    if (snap.empty) { pageState("new"); return; }
    const docItem = snap.docs[0];
    const data = docItem.data();
    if (data.banned === true) {
      pageState("banned");
      document.getElementById("banScreen").hidden = false;
      return;
    }
    const trustScore = scoreOf(data.trustScore);
    const status = getVendorStatus(trustScore);
    const maxCodes = data.verified ? 60 : 20;
    const now = new Date();
    const sameMonth = data.lastCodeMonth === now.getMonth() && data.lastCodeYear === now.getFullYear();
    const usedCodes = sameMonth ? Number(data.codesUsedThisMonth) || 0 : 0;
    const remainingCodes = Math.max(0, maxCodes - usedCodes);
    const codes = Array.isArray(data.purchaseCodes) ? data.purchaseCodes : [];
    const codesHtml = codes.length ? codes.slice().reverse().map(c => `
      <div class="code-pill"><span class="code">${escapeHtml(c)}</span>
        <button class="code-copy" onclick="${inlineCall("copyCode", c)}">Copy</button></div>`).join("")
      : '<div class="empty-state"><h3>Your next sale starts here.</h3><p>Generate a purchase code after a sale and share it with your buyer.</p></div>';
    document.getElementById("vendorDashboard").innerHTML = `
      <section class="business-overview">
        <div class="business-identity"><span class="eyebrow">Your business</span>
          <h2>${escapeHtml(data.name)}</h2><p>${escapeHtml(data.category) || "Independent business"} · ${escapeHtml(data.location) || "Location not added"}</p>
          <div class="badges"><span class="${status.className}">${status.label}</span>
          <span class="${data.verified ? "status-paid" : "status-unpaid"}">${data.verified ? "Premium member" : "Free member"}</span></div>
          <a class="text-link" href="v.html?id=${encodeURIComponent(docItem.id)}">View public profile <span aria-hidden="true"><svg class="arrow-icon" aria-hidden="true" viewBox="0 0 16 16" fill="none"><path d="M4 12 12 4M4 4h8v8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></span></a>
        </div>
        <div class="score-summary"><div class="trust-ring" style="--p:${trustScore}"><div class="inner"><b>${trustScore}%</b><span>Trust score</span></div></div><p>Read alongside buyer reviews.</p></div>
      </section>
      <div class="metric-strip">
        <div><span>Buyer rating</span><strong>${Number(data.averageRating) || 0}<small> / 10</small></strong></div>
        <div><span>Profile searches</span><strong>${Number(data.searchCount) || 0}</strong></div>
        <div><span>Codes remaining</span><strong>${remainingCodes}<small> / ${maxCodes} this month</small></strong></div>
      </div>
      <div class="workspace-columns">
        <section class="card codes-panel"><div class="section-heading"><div><span class="eyebrow">After the sale</span><h2>Purchase codes</h2></div>
          <button onclick="generatePurchaseCode('${docItem.id}')" ${remainingCodes === 0 ? "disabled" : ""}>Generate code</button></div>
          <p>Give buyers a code to link their review to a purchase.</p><div class="codes-list">${codesHtml}</div></section>
        <aside class="card account-panel"><span class="eyebrow">Manage your profile</span><h2>Business details</h2>
          <dl class="detail-list"><div><dt>Phone</dt><dd>${escapeHtml(data.phone)}</dd></div><div><dt>Location</dt><dd>${escapeHtml(data.location)}</dd></div></dl>
          <div class="vendor-actions"><button onclick="openEditProfile('${docItem.id}')" class="btn-secondary">Edit profile</button><button onclick="copyLink('${docItem.id}')" class="btn-secondary">Copy profile link</button><button onclick="viewReviews('${docItem.id}')" class="btn-secondary">Read reviews</button></div>
          ${!data.verified ? `<div class="membership-note"><h3>More room for your business.</h3><p>Premium increases your monthly purchase-code allowance to 60.</p><button onclick="${inlineCall("payForVerification", docItem.id, user.email)}">Get Premium · ₦5,000</button></div>` : '<p class="membership-note">Your premium membership includes 60 purchase codes each month.</p>'}
        </aside>
      </div>`;
    pageState("ready");
  } catch (err) {
    if (request !== dashboardRequest || auth.currentUser?.uid !== user.uid) return;
    console.error("Vendor dashboard error:", err);
    pageState("error", "We couldn’t load your business. Your profile is still saved. Check your connection and try again.");
  }
};

// ===============================
// CUSTOMER DASHBOARD
// ===============================
window.loadCustomerDashboard = async function () {

  const user = auth.currentUser;
  if (!user) return;

  try {

    const name = (user.email || "user").split("@")[0];

    const welcomeText = document.getElementById("welcomeText");
    if (welcomeText) welcomeText.innerText = `Welcome back, ${name}.`;

    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) return;

    const data = userSnap.data();

    const searches =
      typeof data.weeklySearches === "number"
        ? data.weeklySearches
        : Number(data.weeklySearches) || 0;
    const counter = document.getElementById("weeklySearches");
    if (counter) counter.textContent = searches;

  } catch (err) {
    console.error("Customer dashboard error:", err);
  }
};

// ===============================
// TRACK SEARCHES
// ===============================
window.trackVendorSearch = async function () {

  const user = auth.currentUser;
  if (!user) return;

  const userRef = doc(db, "users", user.uid);
  await setDoc(userRef, { weeklySearches: increment(1) }, { merge: true });
  const counter = document.getElementById("weeklySearches");
  if (counter) counter.textContent = (Number(counter.textContent) || 0) + 1;
};

// ===============================
// PAGE LOADERS (auth-gated)
// ===============================
async function initializePage(user) {
  if (!protectedPage) return;
  if (!user) { ++dashboardRequest; pageState("loading"); location.replace("auth.html"); return; }
  pageState("loading");
  try {
    const profile = await deadline(getDoc(doc(db, "users", user.uid)));
    if (auth.currentUser?.uid !== user.uid) return;
    const role = user.email === "ademikun2023@gmail.com" ? "admin" : profile.data()?.role;
    if (!["customer", "vendor", "admin"].includes(role)) { pageState("error", "We couldn’t find your account profile. Try again or sign out to use another account."); return; }
    if (!location.pathname.endsWith(`${role}.html`)) { location.replace(`${role}.html`); return; }
    if (role === "vendor") await loadVendorDashboard();
    if (role === "customer") { await loadCustomerDashboard(); pageState("ready"); await loadPremiumVendors(); }
    if (role === "admin") { pageState("ready"); await loadAdminDashboard(); }
  } catch (error) { pageState("error", "We couldn’t open your account. Check your connection and try again."); }
}
onAuthStateChanged(auth, initializePage, () => pageState("error", "We couldn’t check your sign-in. Please try again."));

// ===============================
// BAN VENDOR (direct)
// ===============================
window.banVendor = async function (vendorId, email, phone, businessName) {

  await updateDoc(doc(db, "vendors", vendorId), { banned: true, verified: false });

  showToast("Vendor banned ✔", "success");

  console.log(
    `BANNED NOTICE: ${businessName} (${phone}) has been banned for unethical business practices. Sent to: ${email}`
  );

  loadAdminDashboard();
};

// ===============================
// ADMIN DASHBOARD
// ===============================
window.loadAdminDashboard = async function () {

  const reportsBox = document.getElementById("reportsList");
  const vendorsBox = document.getElementById("vendorList");

  if (!reportsBox || !vendorsBox) {
    console.error("Admin containers missing");
    return;
  }

  reportsBox.innerHTML = "<p>Loading reports...</p>";
  vendorsBox.innerHTML = "<p>Loading vendors...</p>";

  try {

    const reportsSnap = await getDocs(collection(db, "scamReports"));

    let reportsHTML = "";

    reportsSnap.forEach(docItem => {
      const d = docItem.data();
      reportsHTML += `
        <div class="result-card">
          <h3>Concern reported</h3>
          <p><b>Phone:</b> ${escapeHtml(d.phone) || "N/A"}</p>
          <p><b>Reason:</b> ${escapeHtml(d.reason) || "N/A"}</p>
          <p><b>By:</b> ${escapeHtml(d.reporterEmail) || "Unknown"}</p>
          <button onclick="${inlineCall("openReportModal", docItem.id, d.phone, d.reason, d.reporterEmail)}">View report</button>
        </div>
      `;
    });

    reportsBox.innerHTML = reportsHTML || "<p>No reports found</p>";

    const vendorsSnap = await getDocs(collection(db, "vendors"));

    let vendorsHTML = "";

    vendorsSnap.forEach(docItem => {
      const d = docItem.data();
      const trustScore =
        typeof d.trustScore === "number" ? d.trustScore : Number(d.trustScore) || 50;
      const status = getVendorStatus(trustScore);

      vendorsHTML += `
        <div class="result-card">
          <h3>${escapeHtml(d.name) || "No name"}</h3>
          <p>Phone: ${escapeHtml(d.phone) || "No phone"}</p>
          <div class="badges" style="margin:8px 0;">
            <span class="${status.className}">${status.label}</span>
            <span class="${d.banned ? "status-banned" : "status-trusted"}">${d.banned ? "Restricted" : "Active"}</span>
          </div>
          <button onclick="${inlineCall("banVendor", docItem.id, d.createdBy, d.phone, d.name)}">Ban vendor</button>
        </div>
      `;
    });

    vendorsBox.innerHTML = vendorsHTML || "<p>No vendors found</p>";

  } catch (err) {
    console.error("Admin dashboard error:", err);
    reportsBox.innerHTML = "<p>Error loading reports</p>";
    vendorsBox.innerHTML = "<p>Error loading vendors</p>";
  }
};

// ===============================
// REPORT MODAL
// ===============================
let selectedReport = null;

window.openReportModal = function (id, phone, reason, email) {

  selectedReport = { id, phone, reason, email };

  document.getElementById("modalPhone").innerText = phone;
  document.getElementById("modalReason").innerText = reason;
  document.getElementById("modalEmail").innerText = email;

  document.getElementById("reportModal").style.display = "flex";
};

window.closeModal = function () {
  document.getElementById("reportModal").style.display = "none";
};

window.banVendorFromReport = async function () {

  if (!selectedReport) return;

  const q = query(
    collection(db, "vendors"),
    where("phone", "==", selectedReport.phone)
  );

  const snap = await getDocs(q);

  if (snap.empty) {
    showToast("Vendor not found", "error");
    return;
  }

  await Promise.all(snap.docs.map(docItem => updateDoc(doc(db, "vendors", docItem.id), { banned: true, verified: false })));

  showToast("Vendor banned ✔", "success");

  closeModal();
  setTimeout(() => { loadAdminDashboard(); }, 400);
};

// ===============================
// REVIEW MODALS
// ===============================
let currentVendorId = null;

window.openReviewModal = function (vendorId) {
  currentVendorId = vendorId;
  ["reviewRating", "purchaseCode", "reviewPros", "reviewCons"].forEach(id => { document.getElementById(id).value = ""; });
  document.getElementById("reviewModal").style.display = "flex";
};

window.closeReviewModal = function () {
  document.getElementById("reviewModal").style.display = "none";
};

window.submitReview = async function () {

  const user = auth.currentUser;
  if (!user) return;

  const deviceId = getDeviceId();

  const rating = Number(document.getElementById("reviewRating").value);
  const pros = document.getElementById("reviewPros").value;
  const cons = document.getElementById("reviewCons").value;
  const purchaseCode = document.getElementById("purchaseCode").value.trim();

  if (!Number.isInteger(rating) || rating < 1 || rating > 10) { showToast("Choose a whole-number rating from 1 to 10", "warning"); return; }
  const currentVendor = await getDoc(doc(db, "vendors", currentVendorId));
  if (!currentVendor.exists() || currentVendor.data().banned) { showToast("This vendor cannot receive reviews", "warning"); return; }
  let verifiedPurchase = false;

  // one review per device
  const q = query(
    collection(db, "vendors", currentVendorId, "reviews"),
    where("deviceId", "==", deviceId)
  );

  const existing = await getDocs(q);

  if (!existing.empty) {
    showToast("You already reviewed this vendor", "warning");
    return;
  }

  if (purchaseCode) {
    const vendorRef = doc(db, "vendors", currentVendorId);
    const vendorSnap = await getDoc(vendorRef);
    const vendorData = vendorSnap.data();
    const codes = vendorData?.purchaseCodes || [];

    if (!codes.includes(purchaseCode)) { showToast("That purchase code is not valid for this vendor", "warning"); return; }
    verifiedPurchase = true;
  }

  await addDoc(
    collection(db, "vendors", currentVendorId, "reviews"),
    {
      userId: user.uid,
      userEmail: user.email,
      deviceId,
      rating,
      pros,
      cons,
      verifiedPurchase,
      createdAt: new Date()
    }
  );

  showToast("Review submitted ✔", "success");
  closeReviewModal();
};

// ===============================
// VIEW REVIEWS
// ===============================
window.viewReviews = async function (vendorId) {

  const container = document.getElementById("reviewsContainer");
  const modal = document.getElementById("reviewsModal");

  if (!container || !modal) {
    console.error("Reviews modal missing in HTML");
    showToast("Reviews UI missing", "error");
    return;
  }

  container.innerHTML = "<p>Loading reviews...</p>";
  modal.style.display = "flex";

  try {

    const snap = await getDocs(collection(db, "vendors", vendorId, "reviews"));

    if (snap.empty) {
      container.innerHTML = "<p>No reviews yet.</p>";
      return;
    }

    container.innerHTML = "";

    let totalRating = 0;
    let reviewCount = 0;

    snap.forEach(docItem => {
      const d = docItem.data();
      totalRating += Number(d.rating || 0);
      reviewCount++;

      const div = document.createElement("div");
      div.className = "result-card";
      div.innerHTML = `
        <h3>⭐ ${Number(d.rating) || 0}/10 ${d.verifiedPurchase ? " Purchase-code verified" : ""}</h3>
        <p><b>Pros:</b><br>${escapeHtml(d.pros) || "None"}</p>
        <br>
        <p><b>Cons:</b><br>${escapeHtml(d.cons) || "None"}</p>
      `;
      container.appendChild(div);
    });

    if (reviewCount > 0) {
      const avg = (totalRating / reviewCount).toFixed(1);
      await updateDoc(doc(db, "vendors", vendorId), { averageRating: Number(avg) });
    }

  } catch (err) {
    console.error("View reviews error:", err);
    showToast("Failed to load reviews", "error");
  }
};

window.closeReviewsModal = function () {
  document.getElementById("reviewsModal").style.display = "none";
};

// ===============================
// GENERATE PURCHASE CODE
// ===============================
window.generatePurchaseCode = async function (vendorId) {

  try {

    const vendorRef = doc(db, "vendors", vendorId);
    const vendorSnap = await getDoc(vendorRef);

    if (!vendorSnap.exists()) {
      showToast("Vendor not found", "error");
      return;
    }

    const vendorData = vendorSnap.data();
    if (!auth.currentUser || vendorData.createdBy !== auth.currentUser.email || vendorData.banned) { showToast("You can only create codes for your own active business", "error"); return; }

    const maxCodes = vendorData.verified === true ? 60 : 20;

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let codesUsed = vendorData.codesUsedThisMonth || 0;
    const savedMonth = vendorData.lastCodeMonth;
    const savedYear = vendorData.lastCodeYear;

    // reset on new month
    if (savedMonth !== currentMonth || savedYear !== currentYear) {
      codesUsed = 0;
      await updateDoc(vendorRef, {
        codesUsedThisMonth: 0,
        lastCodeMonth: currentMonth,
        lastCodeYear: currentYear
      });
    }

    if (codesUsed >= maxCodes) {
      showToast(`Monthly limit reached (${maxCodes})`, "warning");
      return;
    }

    const code = "VP-" + crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase();

    let purchaseCodes = vendorData.purchaseCodes || [];
    purchaseCodes.push(code);

    await updateDoc(vendorRef, {
      purchaseCodes: purchaseCodes,
      codesUsedThisMonth: increment(1),
      lastCodeMonth: currentMonth,
      lastCodeYear: currentYear
    });

    showToast(`New code: ${code} (saved to your list)`, "success");

    // refresh so the new code shows in the list
    await loadVendorDashboard();

  } catch (err) {
    console.error(err);
    showToast("Failed to generate code", "error");
  }
};

// ===============================
// PREMIUM VENDORS (customer)
// ===============================
let premiumRequest = 0;
window.loadPremiumVendors = async function () {
  const request = ++premiumRequest;

  const container = document.getElementById("premiumVendors");
  if (!container) return;

  const filterEl = document.getElementById("premiumCategoryFilter");
  const selectedCategory = filterEl ? filterEl.value : "All";

  container.innerHTML = "<p>Loading vendors...</p>";

  try {

    const snap = await deadline(getDocs(collection(db, "vendors")));
    if (request !== premiumRequest) return;
    container.innerHTML = "";

    let found = false;

    snap.forEach(docItem => {

      const d = docItem.data();
      const trustScore = d.trustScore ?? 50;

      if (
        d.verified === true &&
        d.banned !== true &&
        trustScore >= 90 &&
        (selectedCategory === "All" || d.category === selectedCategory)
      ) {

        found = true;

        const div = document.createElement("div");
        div.className = "premium-vendor-card";
        div.innerHTML = `
          <h3>${escapeHtml(d.name)}</h3>
          <p>Category: ${escapeHtml(d.category) || "Others"}</p>
          <p>Phone: ${escapeHtml(d.phone) || "No phone"}</p>
          <p>Location: ${escapeHtml(d.location) || "No location"}</p>
          <p>Trust score: ${Number(trustScore) || 0}%</p>
          <div class="premium-badge">Premium vendor</div><a class="text-link" href="v.html?id=${encodeURIComponent(docItem.id)}">View profile <svg class="arrow-icon" aria-hidden="true" viewBox="0 0 16 16" fill="none"><path d="M4 12 12 4M4 4h8v8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></a>
        `;
        container.appendChild(div);
      }
    });

    if (!found) {
      container.innerHTML = `
        <div class="card">
          <p>No premium vendors found in this category.</p>
        </div>
      `;
    }

  } catch (err) {
    console.error(err);
    if (request !== premiumRequest) return;
    container.innerHTML = '<div class="empty-state"><p>Couldn’t load vendors. Check your connection.</p><button class="btn-secondary" onclick="loadPremiumVendors()">Try again</button></div>';
  }
};

// guarded: this element only exists on customer.html
const premiumFilterEl = document.getElementById("premiumCategoryFilter");
if (premiumFilterEl) {
  premiumFilterEl.addEventListener("change", () => { loadPremiumVendors(); });
}

window.copyLink = function (id) {
  const url = `${location.origin}/v.html?id=${id}`;
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(url)
      .then(() => showToast("Your link is copied ✔", "success"))
      .catch(() => showToast(url, "success"));
  } else {
    showToast(url, "success");
  }
};

// ===============================
// EDIT PROFILE (once every 30 days)
// ===============================
let editingVendorId = null;

window.openEditProfile = async function (id) {

  const snap = await getDoc(doc(db, "vendors", id));
  if (!snap.exists()) { showToast("Vendor not found", "error"); return; }

  const d = snap.data();
  if (!auth.currentUser || d.createdBy !== auth.currentUser.email) { showToast("This is not your business profile", "error"); return; }

  // 30-day gate (soft client guard — back it with security rules for real enforcement)
  const last = d.lastProfileEdit || 0;
  const days = (Date.now() - last) / 86400000;
  if (last && days < 30) {
    showToast(`You can edit again in ${Math.ceil(30 - days)} day(s)`, "warning");
    return;
  }

  editingVendorId = id;

  const s = d.socials || {};
  document.getElementById("editName").value = d.name || "";
  document.getElementById("editLocation").value = d.location || "";
  document.getElementById("editCategory").value = d.category || "";
  document.getElementById("editWhatsapp").value = s.whatsapp || "";
  document.getElementById("editInstagram").value = s.instagram || "";
  document.getElementById("editTiktok").value = s.tiktok || "";
  document.getElementById("editX").value = s.x || "";

  document.getElementById("editModal").style.display = "flex";
};

window.closeEditProfile = function () {
  document.getElementById("editModal").style.display = "none";
};

window.updateVendor = async function () {

  if (!editingVendorId) return;

  const name = document.getElementById("editName").value.trim();
  const location = document.getElementById("editLocation").value.trim();
  const category = document.getElementById("editCategory").value;

  if (!name || !location || !category) {
    showToast("Name, location and category are required", "warning");
    return;
  }

  const socials = {
    whatsapp:  document.getElementById("editWhatsapp").value.trim(),
    instagram: document.getElementById("editInstagram").value.trim(),
    tiktok:    document.getElementById("editTiktok").value.trim(),
    x:         document.getElementById("editX").value.trim()
  };

  const updates = { name, location, category, socials, lastProfileEdit: Date.now() };

  // optional new photo
  const editPhotoFile = document.getElementById("editPhoto")?.files?.[0];
  if (editPhotoFile) {
    try {
      showToast("Uploading photo…", "success");
      updates.photoURL = await uploadVendorPhoto(editPhotoFile);
    } catch (e) {
      console.error(e);
      showToast("Photo upload failed", "warning");
    }
  }

  try {
    await updateDoc(doc(db, "vendors", editingVendorId), updates);
    showToast("Profile updated ✔", "success");
    closeEditProfile();
    await loadVendorDashboard();
  } catch (err) {
    console.error(err);
    showToast("Failed to update profile", "error");
  }
};
// Keep each action single-flight, and always recover the controls after an error.
for (const name of ["login", "signup", "addVendor", "searchVendor", "reportScam", "submitReview", "generatePurchaseCode", "openEditProfile", "updateVendor", "banVendor", "banVendorFromReport", "deleteVendor", "logout"]) {
  const action = window[name];
  let pending = false;
  window[name] = async (...args) => {
    if (pending) return;
    pending = true;
    const buttons = [...document.querySelectorAll(`button[onclick^="${name}("]`)];
    const previous = buttons.map(b => b.disabled);
    buttons.forEach(b => { b.disabled = true; b.setAttribute("aria-busy", "true"); });
    try { return await action(...args); }
    catch (error) {
      console.error(`${name} failed`, error);
      if (name === "searchVendor") document.getElementById("result").innerHTML = '<p role="alert">Search couldn’t finish. Please try again.</p>';
      showToast("Couldn’t complete that action. Check your connection and try again.", "error");
    } finally {
      pending = false;
      buttons.forEach((b, i) => { b.disabled = previous[i]; b.removeAttribute("aria-busy"); });
    }
  };
}
window.dispatchEvent(new Event("verifyplug:ready"));
