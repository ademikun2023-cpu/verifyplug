// ================= FIREBASE =================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged
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
  setDoc,
  deleteDoc
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

// ================= DEVICE ID =================
function getDeviceId() {
  let deviceId = localStorage.getItem("deviceId");
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem("deviceId", deviceId);
  }
  return deviceId;
}

// ================= STATUS ENGINE =================
function getVendorStatus(trustScore) {
  if (trustScore >= 85) {
    return { label: "Recommended Vendor ⭐", className: "status-recommended" };
  }
  if (trustScore >= 50) {
    return { label: "Normal Vendor", className: "status-normal" };
  }
  if (trustScore >= 21) {
    return { label: "Unverified Vendor ⚠️", className: "status-weak" };
  }
  return { label: "Banned Vendor 🚫", className: "status-banned" };
}

// ================= VERIFIED BADGE =================
function getVerifiedBadge(vendor) {
  if (vendor.verifiedPurchase === true && (vendor.trustScore ?? 100) >= 50) {
    return "✅ Verified Purchase";
  }
  return "";
}

// ================= FILTER =================
function filterVendors(vendors) {
  return vendors.filter(v => (v.trustScore ?? 100) > 20);
}

// ================= SORT =================
function sortVendors(vendors) {
  return vendors.sort((a, b) =>
    (b.trustScore ?? 100) - (a.trustScore ?? 100)
  );
}

// ================= EMPTY STATE =================
function renderEmptyState(container) {
  container.innerHTML = `<div class="card">No vendors available yet.</div>`;
}

// ================= TOAST =================
window.showToast = function (msg, type = "success") {
  const toast = document.getElementById("toast");
  if (!toast) return;

  toast.className = "";
  toast.classList.add("show", type);
  toast.innerText = msg;

  setTimeout(() => toast.classList.remove("show"), 3000);
};

// ================= ROUTES =================
window.goCustomer = () => location.href = "customer.html";
window.goVendor = () => location.href = "vendor.html";

// ================= SIGNUP =================
window.signup = async () => {
  let email = document.getElementById("emailInput").value;
  let password = document.getElementById("passwordInput").value;
  let role = document.getElementById("roleInput").value;

  try {
    const userCred = await createUserWithEmailAndPassword(auth, email, password);

    await setDoc(doc(db, "users", userCred.user.uid), {
      email,
      role
    });

    location.href = role === "vendor" ? "vendor.html" : "customer.html";
  } catch (e) {
    alert(e.message);
  }
};

// ================= LOGIN =================
window.login = async () => {
  let email = document.getElementById("emailInput").value;
  let password = document.getElementById("passwordInput").value;

  try {
    const userCred = await signInWithEmailAndPassword(auth, email, password);
    const user = userCred.user;

    if (user.email === "ademikun2023@gmail.com") {
      showToast("Admin login successful ✔");
      location.href = "admin.html";
      return;
    }

    const userDoc = await getDoc(doc(db, "users", user.uid));

    if (!userDoc.exists()) {
      showToast("User profile not found");
      return;
    }

    const role = userDoc.data().role;

    location.href = role === "vendor" ? "vendor.html" : "customer.html";

  } catch (err) {
    console.error(err);
    alert(err.message);
  }
};

// ================= LOAD VENDOR DASHBOARD =================
window.loadVendorDashboard = async function () {

  const user = auth.currentUser;
  if (!user) return;

  const q = query(collection(db, "vendors"), where("createdBy", "==", user.email));
  const snap = await getDocs(q);

  if (!snap.empty) {

    const vendor = snap.docs[0];
    const data = vendor.data();

    document.getElementById("vendorForm").style.display = "none";
    document.getElementById("vendorDashboard").style.display = "block";

    document.getElementById("welcomeText").innerText = `Hi ${data.name} 👋`;

    const trustScore = data.trustScore ?? 100;

    document.getElementById("trustFill").style.width = trustScore + "%";
    document.getElementById("trustText").innerText = trustScore + "% Trusted";

    document.getElementById("searchCount").innerText = data.searchCount || 0;

    const status = getVendorStatus(trustScore);
    const statusEl = document.getElementById("vendorStatus");

    if (statusEl) {
      statusEl.innerText = status.label;
      statusEl.className = status.className;
    }

    const verifiedBadge = document.getElementById("verifiedBadge");

    if (data.verified) {
      verifiedBadge && (verifiedBadge.style.display = "inline-block");
      setStatus(true);
    } else {
      verifiedBadge && (verifiedBadge.style.display = "none");
      setStatus(false);
    }

    const maxCodes = data.verified ? 60 : 20;
    const usedCodes = data.codesUsedThisMonth || 0;

    document.getElementById("purchaseCodesLeft").innerText =
      `${maxCodes - usedCodes}/${maxCodes}`;

    document.getElementById("generateCodeBtn").onclick = () =>
      generatePurchaseCode(vendor.id);

    document.getElementById("viewReviewsBtn").onclick = () =>
      viewReviews(vendor.id);

    const verifyBtn = document.getElementById("verifyBtn");

    if (verifyBtn) {
      verifyBtn.style.display = data.verified ? "none" : "inline-block";

      verifyBtn.onclick = () =>
        payForVerification(vendor.id, user.email);
    }
  }
};

// ================= TRACK SEARCH =================
window.trackVendorSearch = async function () {
  const user = auth.currentUser;
  if (!user) return;

  const userRef = doc(db, "users", user.uid);

  await setDoc(userRef, {
    weeklySearches: increment(1)
  }, { merge: true });
};

// ================= AUTH STATE =================
onAuthStateChanged(auth, (user) => {
  if (user && location.pathname.includes("customer.html")) {
    loadCustomerDashboard();
  }

  if (user && location.pathname.includes("vendor.html")) {
    loadVendorDashboard();
  }

  if (user && location.pathname.includes("admin.html")) {
    loadAdminDashboard();
  }
});