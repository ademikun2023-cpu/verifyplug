// ================= FIREBASE =================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification
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
// 1) make a free account at cloudinary.com
// 2) copy your "Cloud name" below
// 3) Settings > Upload > add an UNSIGNED upload preset and put its name below
const CLOUDINARY_CLOUD  = "YOUR_CLOUD_NAME";       // <-- replace
const CLOUDINARY_PRESET = "verifyplug_unsigned";   // <-- replace if you named it differently

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
    return { label: "Highly Recommended ⭐", className: "status-recommended" };
  }
  if (trustScore >= 70) {
    return { label: "Trusted Vendor ✅", className: "status-trusted" };
  }
  if (trustScore >= 50) {
    return { label: "Normal Vendor", className: "status-normal" };
  }
  if (trustScore >= 21) {
    return { label: "Risky Vendor ⚠️", className: "status-weak" };
  }
  return { label: "Banned Vendor 🚫", className: "status-banned" };
}

function getVerifiedBadge(vendor) {
  if (vendor.verifiedPurchase === true && (vendor.trustScore ?? 50) >= 50) {
    return "✅ Verified Purchase";
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

    await sendEmailVerification(user);

    await setDoc(
      doc(db, "users", user.uid),
      { email, role, verified: false, createdAt: Date.now() }
    );

    showToast("Verification email sent ✔ Check your inbox", "success");

    await auth.signOut();

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
      setTimeout(() => { window.location.href = "admin.html"; }, 300);
      return;
    }

    const userSnap = await getDoc(doc(db, "users", user.uid));

    if (!userSnap.exists()) {
      showToast("User profile missing", "error");
      await auth.signOut();
      return;
    }

    const role = userSnap.data().role;

    showToast("Login successful ✔", "success");

    setTimeout(() => {
      if (role === "vendor") {
        window.location.href = "vendor.html";
      } else {
        window.location.href = "customer.html";
      }
    }, 300);

  } catch (err) {

    console.error(err);

    let msg = err.message;
    if (msg.includes("user-not-found")) msg = "Account not found";
    if (msg.includes("wrong-password")) msg = "Incorrect password";
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

  const cleanPhone = vendorPhone.replace(/\s+/g, "");

  const q = query(
    collection(db, "vendors"),
    where("phone", "==", cleanPhone)
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

  setTimeout(() => { loadVendorDashboard(); }, 200);
};

// ================= SEARCH =================
window.searchVendor = async () => {

  const searchInput = document.getElementById("searchInput");
  const result = document.getElementById("result");

  const value = searchInput.value.trim();

  if (!value) {
    showToast("Enter phone number", "error");
    return;
  }

  const q = query(
    collection(db, "vendors"),
    where("phone", "==", value),
    where("banned", "==", false)
  );

  const snap = await getDocs(q);

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

    const trustScore =
      typeof data.trustScore === "number"
        ? data.trustScore
        : Number(data.trustScore) || 50;

    const status = getVendorStatus(trustScore);
    const verifiedBadge = getVerifiedBadge(data);

    html += `
      <div class="vendor-card">
        <div class="vendor-header">
          <h3>${data.name}</h3>
          <div class="badges">
            <span class="${status.className}">${status.label}</span>
            ${verifiedBadge ? `<span class="verified-badge">${verifiedBadge}</span>` : ""}
          </div>
        </div>

        <div class="vendor-info">
          <p>📞 ${data.phone || "No phone"}</p>
          <p>📊 Trust Score: ${trustScore}%</p>
          <p>⭐ Rating: ${data.averageRating || 0}/10</p>
          <p>🧾 ${data.location || "No location"}</p>
        </div>

        <div class="vendor-actions">
          <button onclick="viewVendor('${docItem.id}')">View Profile</button>
          <button onclick="openReviewModal('${docItem.id}')" class="btn-secondary">Add Review</button>
          <button onclick="viewReviews('${docItem.id}')" class="btn-secondary">View Reviews</button>
        </div>
      </div>
    `;
  });

  result.innerHTML = html;

  await trackVendorSearch();
};

window.reportScam = async function () {

  const user = auth.currentUser;

  if (!user) {
    showToast("Login required", "error");
    return;
  }

  let phone = document.getElementById("scamPhone").value;
  let reason = document.getElementById("scamReason").value;

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
      where("phone", "==", phone)
    );

    const snap = await getDocs(q);

    snap.forEach(async (docSnap) => {

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
    });

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
          <h3>${data.name || "No name"}</h3>
          <p>📞 ${data.phone || "No phone"}</p>
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

  if (!user) {
    setTimeout(() => { window.loadVendorDashboard(); }, 600);
    return;
  }

  try {

    const q = query(
      collection(db, "vendors"),
      where("createdBy", "==", user.email)
    );

    const snap = await getDocs(q);

    const container = document.getElementById("vendorDashboard");
    const form = document.getElementById("vendorForm");

    if (!container) return;

    if (snap.empty) {
      container.innerHTML = `
        <div class="card">
          <h3>No vendor business found</h3>
          <p>Create your business profile above to start building trust.</p>
        </div>
      `;
      container.style.display = "block";
      return;
    }

    const docItem = snap.docs[0];
    const data = docItem.data();

    // BAN CHECK
    if (data?.banned === true) {
      document.body.innerHTML = `
        <div id="banScreen">
          <h1>🚫 You have been banned</h1>
          <p>Your vendor account has been restricted due to policy violations.</p>
          <p>Contact support if you believe this is a mistake.</p>
        </div>
      `;
      await auth.signOut();
      return;
    }

    const trustScore = data.trustScore ?? 50;
    const status = getVendorStatus(trustScore);
    const verifiedBadge = getVerifiedBadge(data);

    const maxCodes = data.verified ? 60 : 20;
    const usedCodes = data.codesUsedThisMonth || 0;
    const remainingCodes = maxCodes - usedCodes;

    const codes = Array.isArray(data.purchaseCodes) ? data.purchaseCodes : [];

    const codesHtml = codes.length
      ? codes.slice().reverse().map(c => `
          <div class="code-pill">
            <span class="code">${c}</span>
            <button class="code-copy" onclick="copyCode('${c}')">Copy</button>
          </div>
        `).join("")
      : `<p class="muted-text">No purchase codes yet. Generate one to share with buyers after a sale.</p>`;

    if (form) form.style.display = "none";
    container.style.display = "block";

    container.innerHTML = `
      <div class="vendor-owner-card reveal">

        <div class="trust-ring" style="--p:${trustScore}">
          <div class="inner">
            <b>${trustScore}%</b>
            <span>Trust</span>
          </div>
        </div>

        <h2 style="text-align:center;">Hi ${data.name} 👋</h2>

        <div class="badges" style="justify-content:center;margin-top:10px;">
          <span class="${status.className}">${status.label}</span>
          ${verifiedBadge ? `<span class="verified-badge">${verifiedBadge}</span>` : ""}
        </div>

        <div style="margin-top:18px;">
          <p>📞 ${data.phone || "No phone"}</p>
          <p>🧾 ${data.location || "No location"}</p>
          <p>⭐ Average Rating: ${data.averageRating || 0}/10</p>
          <p>🔍 Searches This Week: ${data.searchCount || 0}</p>
        </div>

        <div class="vendor-actions">
          <button onclick="generatePurchaseCode('${docItem.id}')">Generate Purchase Code</button>
          ${!data.verified ? `<button onclick="payForVerification('${docItem.id}', '${user.email}')" class="btn-secondary">Get Verified (₦5,000)</button>` : ""}
          <button onclick="viewReviews('${docItem.id}')" class="btn-secondary">View Reviews</button>
          <button onclick="copyLink('${docItem.id}')" class="btn-secondary">Copy my profile link</button>
          <button onclick="openEditProfile('${docItem.id}')" class="btn-secondary">Edit profile</button>
        </div>

        <div class="codes-wrap">
          <div class="codes-head">
            <span class="label">🔑 Your Purchase Codes</span>
            <span class="count">${remainingCodes}/${maxCodes} left this month</span>
          </div>
          <div class="codes-list">
            ${codesHtml}
          </div>
        </div>

      </div>
    `;

  } catch (err) {
    console.error("Vendor dashboard error:", err);
    showToast("Failed to load vendor dashboard", "error");
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
    if (welcomeText) welcomeText.innerText = `Hi ${name} 👋`;

    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) return;

    const data = userSnap.data();

    const searches =
      typeof data.weeklySearches === "number"
        ? data.weeklySearches
        : Number(data.weeklySearches) || 0;

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
};

// ===============================
// PAGE LOADERS (auth-gated)
// ===============================
onAuthStateChanged(auth, (user) => {
  if (user && window.location.pathname.includes("customer.html")) {
    loadCustomerDashboard();
    loadPremiumVendors();
  }
});

onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  if (window.location.pathname.includes("vendor.html")) {
    await loadVendorDashboard();
  }
});

onAuthStateChanged(auth, (user) => {
  if (user && window.location.pathname.includes("admin.html")) {
    loadAdminDashboard();
  }
});

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
          <h3>🚨 Scam Report</h3>
          <p><b>Phone:</b> ${d.phone || "N/A"}</p>
          <p><b>Reason:</b> ${d.reason || "N/A"}</p>
          <p><b>By:</b> ${d.reporterEmail || "Unknown"}</p>
          <button onclick="openReportModal('${docItem.id}','${d.phone || ""}','${(d.reason || "").replace(/'/g, "\\'")}','${d.reporterEmail || ""}')">View Report</button>
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
          <h3>${d.name || "No name"}</h3>
          <p>📞 ${d.phone || "No phone"}</p>
          <div class="badges" style="margin:8px 0;">
            <span class="${status.className}">${status.label}</span>
            <span class="${d.banned ? "status-banned" : "status-trusted"}">${d.banned ? "🚫 Banned" : "🟢 Active"}</span>
          </div>
          <button onclick="banVendor('${docItem.id}','${d.createdBy || ""}','${d.phone || ""}','${(d.name || "").replace(/'/g, "\\'")}')">Ban Vendor</button>
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

  snap.forEach(async (docItem) => {
    await updateDoc(doc(db, "vendors", docItem.id), { banned: true, verified: false });
  });

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
    const codes = vendorData.purchaseCodes || [];

    if (codes.includes(purchaseCode)) {
      verifiedPurchase = true;
    }
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
        <h3>⭐ ${d.rating}/10 ${d.verifiedPurchase ? " ✅ Verified Purchase" : ""}</h3>
        <p><b>Pros:</b><br>${d.pros || "None"}</p>
        <br>
        <p><b>Cons:</b><br>${d.cons || "None"}</p>
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

    const code = "VP-" + Math.floor(10000 + Math.random() * 90000);

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
    setTimeout(() => { loadVendorDashboard(); }, 900);

  } catch (err) {
    console.error(err);
    showToast("Failed to generate code", "error");
  }
};

// ===============================
// PREMIUM VENDORS (customer)
// ===============================
window.loadPremiumVendors = async function () {

  const container = document.getElementById("premiumVendors");
  if (!container) return;

  const filterEl = document.getElementById("premiumCategoryFilter");
  const selectedCategory = filterEl ? filterEl.value : "All";

  container.innerHTML = "<p>Loading vendors...</p>";

  try {

    const snap = await getDocs(collection(db, "vendors"));

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
          <h3>⭐ ${d.name}</h3>
          <p>📂 ${d.category || "Others"}</p>
          <p>📞 ${d.phone || "No phone"}</p>
          <p>🧾 ${d.location || "No location"}</p>
          <p>📊 Trust Score: ${trustScore}%</p>
          <div class="premium-badge">✅ Premium Vendor</div>
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
    showToast("Failed to load premium vendors", "error");
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
      document.title = `${d.name || "Vendor"} — VerifyPlug`;
      const trust = d.trustScore ?? 50;

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
    setTimeout(loadVendorDashboard, 600);
  } catch (err) {
    console.error(err);
    showToast("Failed to update profile", "error");
  }
};