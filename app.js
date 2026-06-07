
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

// ================= CACHE =================
let vendorCache = null;
let vendorCacheTime = 0;
const CACHE_DURATION = 60 * 1000;

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

// ================= TOAST =================
window.showToast = function (message, type = "success") {

  let toast = document.getElementById("toast");

  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast";
    document.body.appendChild(toast);
  }

  toast.innerText = message;
  toast.className = `toast ${type} show`;

  toast.style.position = "fixed";
  toast.style.bottom = "20px";
  toast.style.left = "50%";
  toast.style.transform = "translateX(-50%)";
  toast.style.zIndex = "99999";

  clearTimeout(window.toastTimer);

  window.toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
};

// ================= SAFE HELPER (NEW ADDITION - DOES NOT BREAK ANYTHING) =================
function el(id) {
  return document.getElementById(id);
}

// ================= ROUTING =================
window.goCustomer = () => location.href = "customer.html";
window.goVendor = () => location.href = "vendor.html";

// ================= SIGNUP =================
window.signup = async () => {

  const email = el("emailInput")?.value.trim();
  const password = el("passwordInput")?.value;
  const role = el("roleInput")?.value;

  try {

    if (!email || !password || !role) {
      showToast("All fields are required", "error");
      return;
    }

    const passwordRegex =
      /^(?=.*[A-Z])(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;

    if (!passwordRegex.test(password)) {
      showToast("Weak password", "error");
      return;
    }

    const userCred =
      await createUserWithEmailAndPassword(auth, email, password);

    const user = userCred.user;

    await sendEmailVerification(user);

    await setDoc(doc(db, "users", user.uid), {
      email,
      role,
      verified: false,
      createdAt: Date.now()
    });

    showToast("Verification sent ✔", "success");

    await auth.signOut();

  } catch (e) {
    console.error(e);
    showToast(e.message, "error");
  }
};

// ================= LOGIN =================
window.login = async () => {

  const email = el("emailInput")?.value.trim();
  const password = el("passwordInput")?.value;

  try {

    if (!email || !password) {
      showToast("Enter email/password", "error");
      return;
    }

    const userCred =
      await signInWithEmailAndPassword(auth, email, password);

    const user = userCred.user;

    const snap =
      await getDoc(doc(db, "users", user.uid));

    if (!snap.exists()) {
      showToast("User missing", "error");
      return;
    }

    const role = snap.data().role;

    showToast("Login success ✔", "success");

    setTimeout(() => {
      window.location.href =
        role === "vendor"
          ? "vendor.html"
          : "customer.html";
    }, 300);

  } catch (err) {
    console.error(err);
    showToast(err.message, "error");
  }
};

// ================= ADD VENDOR =================
window.addVendor = async function () {

  const user = auth.currentUser;
  if (!user) return showToast("Login required", "error");

  const vendorName = el("vendorName")?.value.trim();
  const vendorPhone = el("vendorPhone")?.value.trim();
  const vendorLocation = el("vendorLocation")?.value.trim();
  const vendorCategory = el("vendorCategory")?.value;

  if (!vendorName || !vendorPhone || !vendorLocation || !vendorCategory) {
    return showToast("Fill all fields", "warning");
  }

  const cleanPhone = vendorPhone.replace(/\s+/g, "");

  const q = query(
    collection(db, "vendors"),
    where("phone", "==", cleanPhone)
  );

  const existing = await getDocs(q);

  if (!existing.empty) {
    return showToast("Vendor exists", "error");
  }

  await addDoc(collection(db, "vendors"), {
    name: vendorName,
    phone: cleanPhone,
    location: vendorLocation,
    category: vendorCategory,
    trustScore: 50,
    verified: false,
    banned: false,
    createdBy: user.email,
    createdAt: Date.now()
  });

  showToast("Vendor added ✔", "success");
};

// ================= SEARCH =================
window.searchVendor = async () => {

  const value = el("searchInput")?.value.trim();
  const result = el("result");

  if (!value) return showToast("Enter phone", "error");
  if (!result) return;

  const q = query(
    collection(db, "vendors"),
    where("phone", "==", value)
  );

  const snap = await getDocs(q);

  if (snap.empty) {
    result.innerHTML = "<p>No vendor found</p>";
    return;
  }

  let html = "";

  snap.forEach(docItem => {

    const d = docItem.data();

    html += `
      <div class="card">
        <h3>${d.name}</h3>
        <p>${d.phone}</p>
        <p>${d.location}</p>
      </div>
    `;
  });

  result.innerHTML = html;
};

// ================= FIX: PREMIUM FILTER ERROR (IMPORTANT FIX) =================
const premiumFilter = el("premiumCategoryFilter");

if (premiumFilter) {
  premiumFilter.addEventListener("change", () => {
    loadPremiumVendors();
  });
}

// ================= SAFE ONAUTH (NO CRASH) =================
onAuthStateChanged(auth, (user) => {

  const path = window.location.pathname;

  if (!user) return;

  if (path.includes("customer.html")) {
    loadCustomerDashboard();
    loadPremiumVendors();
  }

  if (path.includes("vendor.html")) {
    loadVendorDashboard();
  }

  if (path.includes("admin.html")) {
    loadAdmin();
  }
});