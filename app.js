where

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
// PROFESSIONAL TOAST SYSTEM
// ============================
function validatePassword(password) {

  // at least 8 chars
  const lengthCheck =
    password.length >= 8;

  // at least 1 uppercase
  const capsCheck =
    /[A-Z]/.test(password);

  // at least 1 special symbol
  const symbolCheck =
    /[!@#$%^&*(),.?":{}|<>]/.test(password);

  if (!lengthCheck) {
    return "Password must be at least 8 characters";
  }

  if (!capsCheck) {
    return "Password must contain at least 1 uppercase letter";
  }

  if (!symbolCheck) {
    return "Password must contain at least 1 special symbol";
  }

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
    return {
      label: "Highly Recommended ⭐",
      className: "status-recommended"
    };
  }

  if (trustScore >= 70) {
    return {
      label: "Trusted Vendor ✅",
      className: "status-trusted"
    };
  }

  if (trustScore >= 50) {
    return {
      label: "Normal Vendor",
      className: "status-normal"
    };
  }

  if (trustScore >= 21) {
    return {
      label: "Risky Vendor ⚠️",
      className: "status-weak"
    };
  }

  return {
    label: "Banned Vendor 🚫",
    className: "status-banned"
  };
}
function getVerifiedBadge(vendor) {

  if (
    vendor.verifiedPurchase === true &&
    (vendor.trustScore ?? 50) >= 50
  ) {
    return "✅ Verified Purchase";
  }

  return "";
}
function filterVendors(vendors) {

  return vendors.filter(v => {

    const score = v.trustScore ?? 50;

    // 🚫 remove banned vendors
    if (v.banned === true) return false;

    // remove very low trust
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
    <div style="
      text-align:center;
      opacity:0.6;
      padding:20px;
      font-size:14px;
    ">
      No vendors available yet.
    </div>
  `;
}
let toastTimer = null;

window.showToast = function (message, type = "success") {

  const toast =
    document.getElementById("toast");

  if (!toast) {
    console.error("Toast div missing");
    return;
  }

  // RESET CLASSES
  toast.className = "";

  // SET MESSAGE
  toast.innerText = message;

  // FORCE SHOW
  toast.style.display = "block";

  // ADD CLASSES
  toast.classList.add("show");
  toast.classList.add(type);

  // REMOVE AFTER TIME
  setTimeout(() => {

    toast.classList.remove("show");

  }, 3000);
};
// ================= ROUTING =================
window.goCustomer = () => location.href = "customer.html";
window.goVendor = () => location.href = "vendor.html";

// ================= AUTH =================
window.signup = async () => {

  const email =
    document.getElementById("emailInput").value.trim();

  const password =
    document.getElementById("passwordInput").value;

  const role =
    document.getElementById("roleInput").value;

  try {

    // =========================
    // QUICK EMPTY CHECK (FAST FAIL)
    // =========================
    if (!email || !password || !role) {
      showToast("All fields are required", "error");
      return;
    }

    // =========================
    // PASSWORD VALIDATION
    // =========================
    const passwordRegex =
      /^(?=.*[A-Z])(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;

    if (!passwordRegex.test(password)) {

      showToast(
        "Password must be 8+ chars, include 1 uppercase & 1 special symbol",
        "error"
      );

      return;
    }

    // =========================
    // CREATE USER
    // =========================
    const userCred =
      await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

    const user = userCred.user;

    // =========================
    // SEND VERIFICATION EMAIL
    // =========================
    await sendEmailVerification(user);

    // =========================
    // SAVE USER ROLE
    // =========================
    await setDoc(
      doc(db, "users", user.uid),
      {
        email,
        role,
        verified: false,
        createdAt: Date.now()
      }
    );

    // =========================
    // SUCCESS FEEDBACK
    // =========================
    showToast(
      "Verification email sent ✔ Check your inbox",
      "success"
    );

    // =========================
    // SIGN OUT UNTIL VERIFIED
    // =========================
    await auth.signOut();

  } catch (e) {

    console.error(e);

    // FIREBASE ERRORS CLEANER
    let msg = e.message;

    if (msg.includes("email-already-in-use")) {
      msg = "Email already in use";
    }

    if (msg.includes("invalid-email")) {
      msg = "Invalid email address";
    }

    showToast(msg, "error");
  }
};
window.login = async () => {

  const email =
    document.getElementById("emailInput").value.trim();

  const password =
    document.getElementById("passwordInput").value;

  try {

    // =========================
    // FAST EMPTY CHECK (NO FIREBASE CALL WASTE)
    // =========================
    if (!email || !password) {
      showToast("Enter email and password", "error");
      return;
    }

    // =========================
    // SIGN IN
    // =========================
    const userCred =
      await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

    const user = userCred.user;

    // =========================
    // ADMIN BYPASS (FAST PATH)
    // =========================
    if (user.email === "ademikun2023@gmail.com") {

      showToast(
        "Admin login successful ✔",
        "success"
      );

      setTimeout(() => {
        window.location.href = "admin.html";
      }, 300);

      return;
    }

    // =========================
    // GET USER ROLE
    // =========================
    const userSnap =
      await getDoc(doc(db, "users", user.uid));

    if (!userSnap.exists()) {

      showToast("User profile missing", "error");

      await auth.signOut(); // prevent ghost session

      return;
    }

    const role =
      userSnap.data().role;

    // =========================
    // SUCCESS FEEDBACK FIRST
    // =========================
    showToast("Login successful ✔", "success");

    // =========================
    // SMOOTHER ROUTE TRANSITION
    // =========================
    setTimeout(() => {

      if (role === "vendor") {
        window.location.href = "vendor.html";
      } else {
        window.location.href = "customer.html";
      }

    }, 300);

  } catch (err) {

    console.error(err);

    // =========================
    // CLEAN ERROR MESSAGES
    // =========================
    let msg = err.message;

    if (msg.includes("user-not-found")) {
      msg = "Account not found";
    }

    if (msg.includes("wrong-password")) {
      msg = "Incorrect password";
    }

    if (msg.includes("invalid-email")) {
      msg = "Invalid email format";
    }

    showToast(msg, "error");
  }
};
window.addVendor = async function () {

  const user = auth.currentUser;

  if (!user) {
    showToast("Login required", "error");
    return;
  }

  // =========================
  // INPUT VALUES (TRIMMED FOR CLEAN DATA)
  // =========================
  const vendorName =
    document.getElementById("vendorName").value.trim();

  const vendorPhone =
    document.getElementById("vendorPhone").value.trim();

  const vendorLocation =
    document.getElementById("vendorLocation").value.trim();

  const vendorCategory =
  document.getElementById("vendorCategory").value;
  // =========================
  // VALIDATION
  // =========================
  if (!vendorName || !vendorPhone || !vendorLocation || !vendorCategory) {
    showToast("Please fill all fields", "warning");
    return;
  }

  // =========================
  // PHONE FORMAT CLEANUP (OPTIONAL SPEED + CONSISTENCY)
  // =========================
  const cleanPhone = vendorPhone.replace(/\s+/g, "");

  // =========================
  // CHECK IF PHONE EXISTS (FAST EARLY EXIT)
  // =========================
  const q = query(
    collection(db, "vendors"),
    where("phone", "==", cleanPhone)
  );

  const existing = await getDocs(q);

  if (!existing.empty) {
    showToast("Vendor already exists", "error");
    return;
  }

  // =========================
  // ADD VENDOR (OPTIMIZED WRITE)
  // =========================
  await addDoc(
    collection(db, "vendors"),
    {

      name: vendorName,
      phone: cleanPhone,
      location: vendorLocation,
      category: vendorCategory,
      verified: false,
      banned: false,

      trustScore: 50, // your new baseline system

      averageRating: 0,
      searchCount: 0,

      purchaseCodes: [],

      createdBy: user.email,

      createdAt: Date.now() // faster than new Date()
    }
  );

  // =========================
  // UI FEEDBACK FIRST (FEELS FASTER)
  // =========================
  showToast("Business added successfully ✔", "success");

  // =========================
  // CLEAR INPUTS
  // =========================
  document.getElementById("vendorName").value = "";
  document.getElementById("vendorPhone").value = "";
  document.getElementById("vendorLocation").value = "";

  // =========================
  // REFRESH DASHBOARD (NON-BLOCKING UX IMPROVEMENT)
  // =========================
  setTimeout(() => {
    loadVendorDashboard();
  }, 200);
};

// ================= SEARCH =================
window.searchVendor = async () => {

  const value = searchInput.value.trim();

  if (!value) {
    showToast("Enter phone number", "error");
    return;
  }

  // =========================
  // QUERY (exclude banned vendors)
  // =========================
  const q = query(
    collection(db, "vendors"),
    where("phone", "==", value),
    where("banned", "==", false)
  );

  const snap = await getDocs(q);

  result.innerHTML = "";

  // =========================
  // EMPTY SEARCH
  // =========================
  if (snap.empty) {

    result.innerHTML = `
      <div class="card">
        <p>No vendor found.</p>
      </div>
    `;

    return;
  }

  // =========================
  // BUILD HTML FIRST (FASTER RENDER)
  // =========================
  let html = "";

  snap.forEach((docItem) => {

    const data = docItem.data();

    // =========================
    // SAFE TRUST SCORE
    // =========================
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

            <span class="${status.className}">
              ${status.label}
            </span>

            ${verifiedBadge ? `
              <span class="verified-badge">
                ${verifiedBadge}
              </span>
            ` : ""}

          </div>

        </div>

        <div class="vendor-info">

          <p>📞 ${data.phone || "No phone"}</p>

          <p>📊 Trust Score: ${trustScore}%</p>

          <p>⭐ Rating: ${data.averageRating || 0}/10</p>

          <p>🧾 ${data.location || "No location"}</p>

        </div>

        <div class="vendor-actions">

          <button onclick="viewVendor('${docItem.id}')">
            View Profile
          </button>

          <button onclick="openReviewModal('${docItem.id}')">
            Add Review
          </button>

          <button onclick="viewReviews('${docItem.id}')">
            View Reviews
          </button>

        </div>

      </div>
    `;
  });

  // =========================
  // RENDER ONCE (FAST)
  // =========================
  result.innerHTML = html;

  // =========================
  // TRACK SEARCH AFTER SUCCESS
  // =========================
  await trackVendorSearch();
};
window.reportScam = async function () {

  const user = auth.currentUser;

  if (!user) {
    showToast("Login required", "error");
    return;
  }

  let phone =
    document.getElementById("scamPhone").value;

  let reason =
    document.getElementById("scamReason").value;

  if (!phone || !reason) {

    showToast(
      "Fill all fields",
      "warning"
    );

    return;
  }

  try {

    // =========================
    // SAVE SCAM REPORT
    // =========================
    await addDoc(
      collection(db, "scamReports"),
      {

        reporterEmail: user.email,

        phone: phone,

        reason: reason,

        createdAt: new Date()
      }
    );

    // =========================
    // FIND VENDOR
    // =========================
    const q = query(
      collection(db, "vendors"),
      where("phone", "==", phone)
    );

    const snap =
      await getDocs(q);

    snap.forEach(async (docSnap) => {

      const data =
        docSnap.data();

      let currentScore =
        data.trustScore ?? 50;

      // =========================
      // REDUCE TRUST SCORE
      // =========================
      let updatedScore =
        currentScore - 25;

      // PREVENT NEGATIVE VALUES
      if (updatedScore < 0) {
        updatedScore = 0;
      }

      // =========================
      // VERIFIED BADGE LOGIC
      // =========================
      let verifiedStatus =
        data.verified || false;

      // REMOVE VERIFIED IF BELOW 50
      if (updatedScore < 50) {
        verifiedStatus = false;
      }

      // =========================
      // AUTO BAN IF <= 20
      // =========================
      let bannedStatus =
        data.banned || false;

      if (updatedScore <= 20) {
        bannedStatus = true;
        verifiedStatus = false;
      }

      // =========================
      // UPDATE FIRESTORE
      // =========================
      await updateDoc(
        doc(db, "vendors", docSnap.id),
        {
          trustScore: updatedScore,

          verified: verifiedStatus,

          banned: bannedStatus
        }
      );

    });

    showToast(
      "Report submitted ✔",
      "success"
    );

    // CLEAR INPUTS
    document.getElementById("scamPhone").value = "";

    document.getElementById("scamReason").value = "";

  } catch (err) {

    console.error(err);

    showToast(
      "Something went wrong",
      "error"
    );
  }
};

// ================= PAYSTACK =================
window.payForVerification = function (vendorId, email) {
let handler = PaystackPop.setup({

  key: "pk_test_efbb2bdcd089cefcb6bb2c7aa7677fed9c173ad9",

  email: email,

  amount: 5000 * 100,

  currency: "NGN",

  callback: function (response) {
    console.log("Payment success:", response);

    // your verify logic here
  },

  onClose: function () {
    showToast("Payment cancelled");
  }

});

handler.openIframe();
};
// ================= ADMIN =================
window.loadAdmin = async () => {

  try {

    const adminList =
      document.getElementById("adminList");

    if (!adminList) return;

    adminList.innerHTML = "<p>Loading vendors...</p>";

    const snap = await getDocs(collection(db, "vendors"));

    if (snap.empty) {
      adminList.innerHTML = "<p>No vendors found.</p>";
      return;
    }

    // =========================
    // BUILD HTML FIRST (FAST)
    // =========================
    let html = "";

    snap.forEach((docItem) => {

      const data = docItem.data();

      html += `
        <div class="card">

          <h3>${data.name || "No name"}</h3>

          <p>📞 ${data.phone || "No phone"}</p>

          <p>
            ${data.banned ? "🚫 BANNED" : "🟢 ACTIVE"}
          </p>

          <button onclick="deleteVendor('${docItem.id}')">
            Delete
          </button>

        </div>
      `;
    });

    // =========================
    // SINGLE DOM UPDATE (FAST)
    // =========================
    adminList.innerHTML = html;

  } catch (err) {

    console.error("Admin load error:", err);

    showToast("Failed to load admin panel", "error");
  }
};

window.deleteVendor = async (id) => {
  await deleteDoc(doc(db, "vendors", id));
  showToast("Deleted");
  loadAdmin();
};
if (window.location.pathname.includes("admin.html")) {
  loadAdmin();
}
window.setStatus = function(isPaid) {
  const dot = document.getElementById("statusDot");
  const text = document.getElementById("statusText");

  if (!dot || !text) return;

  if (isPaid) {
    dot.classList.add("status-paid");
    dot.classList.remove("status-unpaid");
    text.innerText = "Verified";
  } else {
    dot.classList.add("status-unpaid");
    dot.classList.remove("status-paid");
    text.innerText = "Not Verified";
  }
};
window.setStatus = function(isPaid) {
  const dot = document.getElementById("statusDot");
  const text = document.getElementById("statusText");

  if (!dot || !text) return;

  if (isPaid) {
    dot.classList.add("status-paid");
    text.innerText = "Verified";
  } else {
    text.innerText = "Not Verified";
  }
};
// ===============================
// VENDOR DASHBOARD (FIXED + MERGED)
// ===============================

window.loadVendorDashboard = async function () {

  const user = auth.currentUser;

  if (!user) {
    setTimeout(() => {
      window.loadVendorDashboard();
    }, 600);
    return;
  }

  try {

    const q = query(
      collection(db, "vendors"),
      where("createdBy", "==", user.email)
    );

    const snap = await getDocs(q);

    const container =
      document.getElementById("vendorDashboard");

    const form =
      document.getElementById("vendorForm");

    if (!container) return;

    // =========================
    // NO VENDOR FOUND
    // =========================
    if (snap.empty) {
      container.innerHTML = `
        <div class="card">
          <h3>No vendor business found</h3>
        </div>
      `;
      return;
    }

    // =========================
    // SAFELY PICK FIRST VENDOR
    // =========================
    // =========================
// BAN CHECK (ROBUST)
// =========================
const docItem = snap.docs[0];
const data = docItem.data();

const isBanned = data?.banned === true;

if (isBanned) {

  document.body.innerHTML = `
    <div id="banScreen">
      <h1>🚫 You have been banned</h1>
      <p>
        Your vendor account has been restricted due to policy violations.
      </p>
      <p>
        Contact support if you believe this is a mistake.
      </p>
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

    if (form) form.style.display = "none";
    container.style.display = "block";

    container.innerHTML = `
      <div class="vendor-owner-card">

        <h2>Hi ${data.name} 👋</h2>

        <div class="badges">
          <span class="${status.className}">
            ${status.label}
          </span>

          ${verifiedBadge ? `
            <span class="verified-badge">
              ${verifiedBadge}
            </span>
          ` : ""}
        </div>

        <br>

        <p>📞 ${data.phone || "No phone"}</p>
        <p>🧾 ${data.location || "No location"}</p>
        <p>📊 Trust Score: ${trustScore}%</p>
        <p>⭐ Average Rating: ${data.averageRating || 0}/10</p>
        <p>🔍 Searches This Week: ${data.searchCount || 0}</p>

        <p>
          🔑 Purchase Codes Remaining:
          ${remainingCodes}/${maxCodes}
        </p>

        <br>

        <div class="vendor-actions">

          <button onclick="generatePurchaseCode('${docItem.id}')">
            Generate Purchase Code
          </button>

          ${!data.verified ? `
            <button onclick="payForVerification('${docItem.id}', '${user.email}')">
              Get Verified
            </button>
          ` : ""}

          <button onclick="viewReviews('${docItem.id}')">
            View Reviews
          </button>

        </div>

      </div>
    `;

  } catch (err) {
    console.error("Vendor dashboard error:", err);
    showToast("Failed to load vendor dashboard", "error");
  }
};
// CUSTOMER DASHBOARD


window.loadCustomerDashboard = async function () {

  const user = auth.currentUser;

  if (!user) return;

  try {

    // =========================
    // SAFE NAME FALLBACK
    // =========================
    const name =
      (user.email || "user").split("@")[0];

    const welcomeText =
      document.getElementById("welcomeText");

    if (welcomeText) {
      welcomeText.innerText = `Hi ${name} 👋`;
    }

    // =========================
    // GET USER DATA
    // =========================
    const userRef =
      doc(db, "users", user.uid);

    const userSnap =
      await getDoc(userRef);

    if (!userSnap.exists()) return;

    const data = userSnap.data();

    // =========================
    // SAFE SEARCH VALUE
    // =========================
    const searches =
      typeof data.weeklySearches === "number"
        ? data.weeklySearches
        : Number(data.weeklySearches) || 0;

    const weeklySearches =
      document.getElementById("weeklySearches");

    if (weeklySearches) {
      weeklySearches.innerText = searches;
    }

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

  // increment customer searches
  await setDoc(userRef, {

    weeklySearches: increment(1)

  }, { merge: true });
};

// ===============================
// LOAD CUSTOMER PAGE
// ===============================

onAuthStateChanged(auth, (user) => {

  if (
    user &&
    window.location.pathname.includes("customer.html")
  ) {

    // CUSTOMER INFO
    loadCustomerDashboard();

    // PREMIUM VENDORS
    loadPremiumVendors();
  }
});
// ===============================
// LOAD VENDOR PAGE
// ===============================

onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  if (window.location.pathname.includes("vendor.html")) {
    await loadVendorDashboard();
  }
});
window.banVendor = async function (vendorId, email, phone, businessName) {

  await updateDoc(doc(db, "vendors", vendorId), {
    banned: true,
    verified: false
  });

  showToast("Vendor banned ✔");

  console.log(
    `BANNED NOTICE:
    ${businessName} (${phone}) has been banned for unethical business practices.
    Sent to: ${email}`
  );
};
window.loadAdminDashboard = async function () {

  const reportsBox =
    document.getElementById("reportsList");

  const vendorsBox =
    document.getElementById("vendorList");

  // =========================
  // SAFETY CHECK
  // =========================
  if (!reportsBox || !vendorsBox) {
    console.error("Admin containers missing");
    return;
  }

  // =========================
  // LOADING STATE (UX IMPROVEMENT)
  // =========================
  reportsBox.innerHTML = "<p>Loading reports...</p>";
  vendorsBox.innerHTML = "<p>Loading vendors...</p>";

  try {

    // =========================
    // LOAD SCAM REPORTS
    // =========================
    const reportsSnap =
      await getDocs(collection(db, "scamReports"));

    let reportsHTML = "";

    reportsSnap.forEach(docItem => {

      const d = docItem.data();

      reportsHTML += `
        <div class="card">
          <h3>🚨 Scam Report</h3>

          <p><b>Phone:</b> ${d.phone || "N/A"}</p>

          <p><b>Reason:</b> ${d.reason || "N/A"}</p>

          <p><b>By:</b> ${d.reporterEmail || "Unknown"}</p>

          <button onclick="openReportModal(
            '${docItem.id}',
            '${d.phone || ""}',
            '${d.reason || ""}',
            '${d.reporterEmail || ""}'
          )">
            View Report
          </button>
        </div>
      `;
    });

    reportsBox.innerHTML =
      reportsHTML || "<p>No reports found</p>";

    // =========================
    // LOAD VENDORS
    // =========================
    const vendorsSnap =
      await getDocs(collection(db, "vendors"));

    let vendorsHTML = "";

    vendorsSnap.forEach(docItem => {

      const d = docItem.data();

      const trustScore =
        typeof d.trustScore === "number"
          ? d.trustScore
          : Number(d.trustScore) || 50;

      vendorsHTML += `
        <div class="card">

          <h3>${d.name || "No name"}</h3>

          <p>${d.phone || "No phone"}</p>

          <p>Trust Score: ${trustScore}%</p>

          <p>
            ${d.banned ? "🚫 BANNED" : "🟢 ACTIVE"}
          </p>

          <button onclick="banVendor(
            '${docItem.id}',
            '${d.createdBy || ""}',
            '${d.phone || ""}',
            '${d.name || ""}'
          )">
            Ban Vendor
          </button>

        </div>
      `;
    });

    vendorsBox.innerHTML =
      vendorsHTML || "<p>No vendors found</p>";

  } catch (err) {
    console.error("Admin dashboard error:", err);

    reportsBox.innerHTML =
      "<p>Error loading reports</p>";

    vendorsBox.innerHTML =
      "<p>Error loading vendors</p>";
  }
};
onAuthStateChanged(auth, (user) => {

  if (user && window.location.pathname.includes("admin.html")) {
    loadAdminDashboard();
  }
});



// LOAD REPORTS
let selectedReport = null;

window.loadScamReports = async function () {

  const snap = await getDocs(collection(db, "scamReports"));

  const box = document.getElementById("reportsList");
  box.innerHTML = "";

  snap.forEach(docItem => {

    const d = docItem.data();

    const div = document.createElement("div");

    div.className = "result-card";

    div.innerHTML = `
      <b>Phone:</b> ${d.phone}<br>
      <b>Reason:</b> ${d.reason}<br>
      <b>By:</b> ${d.reporterEmail}<br><br>

      <button onclick="openReportModal(
        '${docItem.id}',
        '${d.phone}',
        '${d.reason}',
        '${d.reporterEmail}'
      )">
        View Report
      </button>
    `;

    box.appendChild(div);
  });
};
// OPEN MODAL
window.openReportModal = function (id, phone, reason, email) {

  selectedReport = { id, phone, reason, email };

  document.getElementById("modalPhone").innerText =
    "Phone: " + phone;

  document.getElementById("modalReason").innerText =
    "Reason: " + reason;

  document.getElementById("modalEmail").innerText =
    "Reported by: " + email;

  document.getElementById("reportModal").style.display =
    "block";
};

// CLOSE MODAL
window.closeModal = function () {
  document.getElementById("reportModal").style.display =
    "none";
};

// ============================
// BAN VENDOR FROM REPORT
// ============================
window.banVendorFromReport = async function () {

  if (!selectedReport) return;

  const q = query(
    collection(db, "vendors"),
    where("phone", "==", selectedReport.phone)
  );

  const snap = await getDocs(q);

  if (snap.empty) {
    showToast("Vendor not found");
    return;
  }

  snap.forEach(async (docItem) => {

    await updateDoc(doc(db, "vendors", docItem.id), {
      banned: true,
      verified: false
    });

  });

  showToast("Vendor banned ✔");

  closeModal();
};
window.banVendorFromReport = async function () {

  if (!selectedReport) return;

  const q = query(
    collection(db, "vendors"),
    where("phone", "==", selectedReport.phone)
  );

  const snap = await getDocs(q);

  if (snap.empty) {
    showToast("Vendor not found");
    return;
  }

  snap.forEach(async (docItem) => {

    await updateDoc(doc(db, "vendors", docItem.id), {
      banned: true,
      verified: false
    });

  });

  showToast("Vendor banned ✔");

  closeModal();
};
let currentVendorId = null;

// OPEN MODAL
window.openReviewModal = function (vendorId) {

  currentVendorId = vendorId;

  document.getElementById(
    "reviewModal"
  ).style.display = "flex";
};

// CLOSE MODAL
window.closeReviewModal = function () {

  document.getElementById(
    "reviewModal"
  ).style.display = "none";
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

  // =========================
  // DEVICE CHECK (YOUR CODE GOES HERE)
  // =========================
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

      deviceId, // clear
 
      rating,
      pros,
      cons,

      verifiedPurchase,

      createdAt: new Date()
    }
  );

  showToast("Review submitted ✔");
  closeReviewModal();
};
// ============================
// VIEW REVIEWS
// ============================
window.viewReviews = async function (vendorId) {

  const container =
    document.getElementById("reviewsContainer");

  const modal =
    document.getElementById("reviewsModal");

  if (!container || !modal) {
    console.error("Reviews modal missing in HTML");
    showToast("Reviews UI missing", "error");
    return;
  }

  container.innerHTML = "<p>Loading reviews...</p>";
  modal.style.display = "flex";

  try {

    const snap = await getDocs(
      collection(db, "vendors", vendorId, "reviews")
    );

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
        <h3>
          ⭐ ${d.rating}/10
          ${d.verifiedPurchase ? " ✅ Verified Purchase" : ""}
        </h3>

        <p><b>Pros:</b><br>${d.pros || "None"}</p>
        <br>
        <p><b>Cons:</b><br>${d.cons || "None"}</p>
      `;

      container.appendChild(div);
    });

    // prevent crash if no ratings
    if (reviewCount > 0) {
      const avg = (totalRating / reviewCount).toFixed(1);

      await updateDoc(
        doc(db, "vendors", vendorId),
        {
          averageRating: Number(avg)
        }
      );
    }

  } catch (err) {
    console.error("View reviews error:", err);
    showToast("Failed to load reviews", "error");
  }
};

window.closeReviewsModal =
  function () {

    document.getElementById(
      "reviewsModal"
    ).style.display = "none";
};

window.generatePurchaseCode = async function (vendorId) {

  try {

    // =========================
    // GET VENDOR
    // =========================
    const vendorRef = doc(db, "vendors", vendorId);

    const vendorSnap = await getDoc(vendorRef);

    if (!vendorSnap.exists()) {
      showToast("Vendor not found", "error");
      return;
    }

    const vendorData = vendorSnap.data();

    // =========================
    // VERIFIED = 60
    // NORMAL = 20
    // =========================
    const maxCodes =
      vendorData.verified === true
        ? 60
        : 20;

    // =========================
    // CURRENT MONTH
    // =========================
    const now = new Date();

    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // =========================
    // SAVED MONTH DATA
    // =========================
    let codesUsed =
      vendorData.codesUsedThisMonth || 0;

    const savedMonth =
      vendorData.lastCodeMonth;

    const savedYear =
      vendorData.lastCodeYear;

    // =========================
    // RESET NEW MONTH
    // =========================
    if (
      savedMonth !== currentMonth ||
      savedYear !== currentYear
    ) {

      codesUsed = 0;

      await updateDoc(vendorRef, {
        codesUsedThisMonth: 0,
        lastCodeMonth: currentMonth,
        lastCodeYear: currentYear
      });
    }

    // =========================
    // LIMIT CHECK
    // =========================
    if (codesUsed >= maxCodes) {

      showToast(
        `Monthly limit reached (${maxCodes})`,
        "warning"
      );

      return;
    }

    // =========================
    // GENERATE CODE
    // =========================
    const code =
      "VP-" +
      Math.floor(
        10000 + Math.random() * 90000
      );

    // =========================
    // GET CURRENT CODES
    // =========================
    let purchaseCodes =
      vendorData.purchaseCodes || [];

    purchaseCodes.push(code);

    // =========================
    // UPDATE FIRESTORE
    // =========================
    await updateDoc(vendorRef, {

      purchaseCodes: purchaseCodes,

      codesUsedThisMonth:
        increment(1),

      lastCodeMonth:
        currentMonth,

      lastCodeYear:
        currentYear
    });
// =========================
// SUCCESS
// =========================
showToast(
  `Purchase code: ${code}`,
  "success"
);

// =========================
// RELOAD DASHBOARD
// =========================
setTimeout(() => {

  loadVendorDashboard();

}, 1800);

  } catch (err) {

    console.error(err);

    showToast(
      "Failed to generate code",
      "error"
    );
  }
};
window.loadPremiumVendors = async function () {

  const container =
    document.getElementById("premiumVendors");

  if (!container) return;

  // =========================
  // CATEGORY FILTER
  // =========================
  const selectedCategory =
    document.getElementById(
      "premiumCategoryFilter"
    ).value;

  container.innerHTML =
    "<p>Loading vendors...</p>";

  try {

    const snap =
      await getDocs(
        collection(db, "vendors")
      );

    container.innerHTML = "";

    let found = false;

    snap.forEach(docItem => {

      const d = docItem.data();

      const trustScore =
        d.trustScore ?? 50;

      // =========================
      // PREMIUM FILTER LOGIC
      // =========================
      if (

        d.verified === true &&

        d.banned !== true &&

        trustScore >= 90 &&

        (
          selectedCategory === "All" ||

          d.category === selectedCategory
        )

      ) {

        found = true;

        const div =
          document.createElement("div");

        div.className =
          "premium-vendor-card";

        div.innerHTML = `

          <h3>
            ⭐ ${d.name}
          </h3>

          <p>
            📂 ${d.category || "Others"}
          </p>

          <p>
            📞 ${d.phone || "No phone"}
          </p>

          <p>
            🧾 ${d.location || "No location"}
          </p>

          <p>
            📊 Trust Score:
            ${trustScore}%
          </p>

          <div class="premium-badge">
            ✅ Premium Vendor
          </div>

        `;

        container.appendChild(div);
      }

    });

    // =========================
    // EMPTY STATE
    // =========================
    if (!found) {

      container.innerHTML = `
        <div class="card">

          <p>
            No premium vendors found
            in this category.
          </p>

        </div>
      `;
    }

  } catch (err) {

    console.error(err);

    showToast(
      "Failed to load premium vendors",
      "error"
    );
  }
};
document
  .getElementById("premiumCategoryFilter")
  .addEventListener("change", () => {

    loadPremiumVendors();

  });