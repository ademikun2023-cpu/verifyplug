where

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

// ================= ROUTING =================
window.goCustomer = () => location.href = "customer.html";
window.goVendor = () => location.href = "vendor.html";

// ================= AUTH =================
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


    role === "vendor"
      ? location.href = "vendor.html"
      : location.href = "customer.html";

  } catch (e) {
    alert(e.message);
  }
};

window.login = async () => {

  let email = document.getElementById("emailInput").value;
  let password = document.getElementById("passwordInput").value;

  try {

    // LOGIN USER
    const userCred = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

    const user = userCred.user;

    // 🔥 ADMIN BYPASS
    if (user.email === "ademikun2023@gmail.com") {

      alert("Admin login successful ✔");
      window.location.href = "admin.html";
      return;
    }

    // NORMAL USER FLOW
    const userDoc = await getDoc(doc(db, "users", user.uid));

    // if user doc missing
    if (!userDoc.exists()) {
      alert("User profile not found");
      return;
    }

    const role = userDoc.data().role;

    // ROUTE USERS
    if (role === "vendor") {
      window.location.href = "vendor.html";
    } else {
      window.location.href = "customer.html";
    }

  } catch (err) {

    console.error(err);
    alert(err.message);

  }
};
// ================= ADD VENDOR =================
window.addVendor = async function () {

  const user = auth.currentUser;

  if (!user) {
    alert("You must be logged in");
    return;
  }

  // INPUT VALUES
  let name =
    document.getElementById("vendorName").value;

  let phone =
    document.getElementById("vendorPhone").value;

  let location =
    document.getElementById("vendorLocation").value;

  // VALIDATION
  if (!name || !phone || !location) {
    alert("Fill all fields");
    return;
  }

  try {

    // CHECK IF USER ALREADY HAS BUSINESS
    const q = query(
      collection(db, "vendors"),
      where("createdBy", "==", user.email)
    );

    const existingVendor = await getDocs(q);

    if (!existingVendor.empty) {
      alert("You already added a business");
      return;
    }

    // ADD VENDOR
 await addDoc(collection(db, "vendors"), {

  name,
  phone,
  location,

  createdBy: user.email,

  searchCount: 0,

  trustScore: 100,

  verified: false,

  banned: false,

  createdAt: new Date()

});

    alert("Business added successfully ✔");

    // RELOAD DASHBOARD
    loadVendorDashboard();

  } catch (err) {

    console.error(err);
    alert(err.message);

  }
};

// ================= SEARCH =================
window.searchVendor = async () => {
  const q = query(collection(db, "vendors"), where("phone", "==", searchInput.value));
  const snap = await getDocs(q);
  await trackVendorSearch();
  result.innerHTML = "";

  snap.forEach(async (docItem) => {
    let data = docItem.data();
    await updateDoc(doc(db, "vendors", docItem.id), {
  searchCount: increment(1)
});
    let scams = await getDocs(collection(db, "vendors", docItem.id, "scams"));
    let score = 100 - (scams.size * 15);

    if (score < 0) score = 0;

    result.innerHTML += `
      <div class="card">
        <b>${data.name}</b><br/>
        ${data.phone}<br/>
        Trust Score: ${score}%<br/>
        ${data.verified ? "🟢 Verified" : "⚪ Not Verified"}
      </div>
    `;
  });
};
window.reportScam = async function () {

  const user = auth.currentUser;

  if (!user) {
    alert("Login required");
    return;
  }

  let phone = document.getElementById("scamPhone").value;
  let reason = document.getElementById("scamReason").value;

  if (!phone || !reason) {
    alert("Fill all fields");
    return;
  }

  try {

   await addDoc(collection(db, "scamReports"), {

  reporterEmail: user.email,
  phone: phone,
  reason: reason,

  createdAt: new Date()

});

    // OPTIONAL: reduce trust score (if you already linked vendor search system)
    const q = query(
      collection(db, "vendors"),
      where("phone", "==", phone)
    );

    const snap = await getDocs(q);

    snap.forEach(async (d) => {
      await updateDoc(doc(db, "vendors", d.id), {
        trustScore: increment(-25)
      });
    });

    alert("Report submitted ✔");

  } catch (err) {
    console.error(err);
    alert(err.message);
  }
};

// ================= PAYSTACK =================
window.payForVerification = function (vendorId, email) {
let handler = PaystackPop.setup({

  key: "pk_test_efbb2bdcd089cefcb6bb2c7aa7677fed9c173ad9",

  email: email,

  amount: 10000 * 100,

  currency: "NGN",

  callback: function (response) {
    console.log("Payment success:", response);

    // your verify logic here
  },

  onClose: function () {
    alert("Payment cancelled");
  }

});

handler.openIframe();
};
// ================= ADMIN =================
window.loadAdmin = async () => {

  const vendors = await getDocs(collection(db, "vendors"));
  adminList.innerHTML = "";

  vendors.forEach((docItem) => {
    let data = docItem.data();

    adminList.innerHTML += `
      <div class="card">
        ${data.name} - ${data.phone}
        <button onclick="deleteVendor('${docItem.id}')">Delete</button>
      </div>
    `;
  });
};

window.deleteVendor = async (id) => {
  await deleteDoc(doc(db, "vendors", id));
  alert("Deleted");
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

window.loadVendorDashboard = async function () {

  const user = auth.currentUser;

  if (!user) return;

  const q = query(
    collection(db, "vendors"),
    where("createdBy", "==", user.email)
  );

  const snap = await getDocs(q);

  // NO BUSINESS YET
  if (snap.empty) {

    document.getElementById("vendorForm").style.display = "block";
    document.getElementById("vendorDashboard").style.display = "none";

    return;
  }

  const vendorDoc = snap.docs[0];
  const data = vendorDoc.data();

  // =========================
  // SAFE TRUST SCORE FIX
  // =========================
  const trustScore =
    typeof data.trustScore === "number"
      ? data.trustScore
      : Number(data.trustScore) || 100;

  const searchCount = data.searchCount || 0;

  // =========================
  // AUTO BAN SYSTEM 🔥
  // =========================
  if (trustScore <= 20 && data.banned !== true) {

    await updateDoc(doc(db, "vendors", vendorDoc.id), {
      banned: true,
      verified: false
    });

    alert("You have been banned due to low trust score");

    window.location.href = "index.html";
    return;
  }

  // =========================
  // UI SWITCH
  // =========================
  document.getElementById("vendorForm").style.display = "none";
  document.getElementById("vendorDashboard").style.display = "block";

  // =========================
  // NAME DISPLAY
  // =========================
  document.getElementById("welcomeText").innerText =
    `Hi ${data.name} 👋`;

  // =========================
  // SEARCH COUNT
  // =========================
  document.getElementById("searchCount").innerText =
    searchCount;

  // =========================
  // TRUST SCORE UI
  // =========================
  document.getElementById("trustFill").style.width =
    trustScore + "%";

  document.getElementById("trustText").innerText =
    trustScore + "% Trusted";

  // =========================
  // VERIFIED STATUS
  // =========================
  const statusDot = document.getElementById("statusDot");
  const statusText = document.getElementById("statusText");

  if (data.verified) {

    statusDot.classList.add("status-paid");
    statusText.innerText = "Verified";

  } else {

    statusDot.classList.remove("status-paid");
    statusText.innerText = "Not Verified";
  }

  // =========================
  // PAYSTACK BUTTON
  // =========================
  document.getElementById("verifyBtn").onclick = function () {
    payForVerification(vendorDoc.id, user.email);
  };
};
// CUSTOMER DASHBOARD


window.loadCustomerDashboard = async function () {

  const user = auth.currentUser;

  if (!user) return;


  let name = user.email.split("@")[0];


  const welcomeText = document.getElementById("welcomeText");

  if (welcomeText) {
    welcomeText.innerText = `Hi ${name} 👋`;
  }


  const userRef = doc(db, "users", user.uid);

  const userSnap = await getDoc(userRef);

  if (userSnap.exists()) {

    let data = userSnap.data();

    let searches = data.weeklySearches || 0;

    const weeklySearches =
      document.getElementById("weeklySearches");

    if (weeklySearches) {
      weeklySearches.innerText = searches;
    }
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

    loadCustomerDashboard();
  }
});
// ===============================
// VENDOR DASHBOARD
// ===============================

window.loadVendorDashboard = async function () {

  const user = auth.currentUser;

  if (!user) return;

  const q = query(
    collection(db, "vendors"),
    where("createdBy", "==", user.email)
  );

  const snap = await getDocs(q);

  // NO BUSINESS YET
  if (snap.empty) {

    document.getElementById("vendorForm").style.display = "block";
    document.getElementById("vendorDashboard").style.display = "none";
    document.getElementById("banScreen").style.display = "none";

    return;
  }

  const vendorDoc = snap.docs[0];
  const data = vendorDoc.data();

  // SAFE DEFAULTS
  const trustScore =
    typeof data.trustScore === "number"
      ? data.trustScore
      : Number(data.trustScore) || 100;

  // 🚨 STEP 1 — CHECK IF BANNED (PUT THIS FIRST)
  if (data.banned === true) {

    document.getElementById("banScreen").style.display = "block";
    document.getElementById("vendorForm").style.display = "none";
    document.getElementById("vendorDashboard").style.display = "none";

    return;
  }

  // 🚨 STEP 2 — AUTO BAN LOGIC (YOUR CODE GOES HERE)
  if (trustScore <= 20 && data.banned !== true) {

    await updateDoc(doc(db, "vendors", vendorDoc.id), {
      banned: true,
      verified: false
    });

    document.getElementById("banScreen").style.display = "block";
    document.getElementById("vendorForm").style.display = "none";
    document.getElementById("vendorDashboard").style.display = "none";

    return;
  }

  // =========================
  // SHOW NORMAL DASHBOARD
  // =========================

  document.getElementById("banScreen").style.display = "none";
  document.getElementById("vendorForm").style.display = "none";
  document.getElementById("vendorDashboard").style.display = "block";

  // NAME
  document.getElementById("welcomeText").innerText =
    `Hi ${data.name} 👋`;

  // SEARCH COUNT
  document.getElementById("searchCount").innerText =
    data.searchCount || 0;

  // TRUST SCORE UI
  document.getElementById("trustFill").style.width =
    trustScore + "%";

  document.getElementById("trustText").innerText =
    trustScore + "% Trusted";

  // VERIFIED STATUS
  const statusDot = document.getElementById("statusDot");
  const statusText = document.getElementById("statusText");

  if (data.verified) {
    statusDot.classList.add("status-paid");
    statusText.innerText = "Verified";
  } else {
    statusDot.classList.remove("status-paid");
    statusText.innerText = "Not Verified";
  }

  // PAYSTACK BUTTON
  document.getElementById("verifyBtn").onclick = function () {
    payForVerification(vendorDoc.id, user.email);
  };
};

// ===============================
// LOAD VENDOR PAGE
// ===============================

onAuthStateChanged(auth, (user) => {

  if (
    user &&
    window.location.pathname.includes("vendor.html")
  ) {

    loadVendorDashboard();
  }
});
window.banVendor = async function (vendorId, email, phone, businessName) {

  await updateDoc(doc(db, "vendors", vendorId), {
    banned: true,
    verified: false
  });

  alert("Vendor banned ✔");

  console.log(
    `BANNED NOTICE:
    ${businessName} (${phone}) has been banned for unethical business practices.
    Sent to: ${email}`
  );
};
window.loadAdminDashboard = async function () {

  // =========================
  // LOAD SCAM REPORTS
  // =========================
  const reportsSnap = await getDocs(collection(db, "scamReports"));

  const reportsBox = document.getElementById("reportsBox");
  reportsBox.innerHTML = "";

  reportsSnap.forEach(docItem => {

    const data = docItem.data();

    const div = document.createElement("div");

    div.className = "result-card";

    div.innerHTML = `
      <b>Phone:</b> ${data.phone}<br>
      <b>Reason:</b> ${data.reason}<br>
      <b>By:</b> ${data.reporterEmail}<br><br>
    `;

    reportsBox.appendChild(div);
  });

  // =========================
  // LOAD VENDORS
  // =========================
  const vendorSnap = await getDocs(collection(db, "vendors"));

  const vendorBox = document.getElementById("vendorBox");
  vendorBox.innerHTML = "";

  vendorSnap.forEach(docItem => {

    const v = docItem.data();

    const div = document.createElement("div");

    div.className = "result-card";

    div.innerHTML = `
      <b>${v.name}</b><br>
      Phone: ${v.phone}<br>
      Trust: ${v.trustScore ?? 100}%<br>
      Status: ${v.banned ? "🚫 BANNED" : "🟢 ACTIVE"}<br><br>

      <button onclick="banVendor(
        '${docItem.id}',
        '${v.createdBy}',
        '${v.phone}',
        '${v.name}'
      )">
        Ban Vendor
      </button>
    `;

    vendorBox.appendChild(div);
  });
};
onAuthStateChanged(auth, (user) => {

  if (user && window.location.pathname.includes("admin.html")) {
    loadAdminDashboard();
  }
});

let selectedReport = null;

// LOAD REPORTS
window.loadScamReports = async function () {

  const snap = await getDocs(collection(db, "scamReports"));

  const list = document.getElementById("reportsList");
  list.innerHTML = "";

  snap.forEach((docItem) => {

    const data = docItem.data();

    const div = document.createElement("div");

    div.className = "result-card";

    div.innerHTML = `
      <b>${data.phone}</b><br>
      ${data.reason}<br><br>

      <button onclick='openReportModal("${docItem.id}", "${data.phone}", "${data.reason}", "${data.reporterEmail}")'>
        View
      </button>
    `;

    list.appendChild(div);
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

// BAN VENDOR FROM REPORT
document.getElementById("banBtn").onclick = async function () {

  if (!selectedReport) return;

  const q = query(
    collection(db, "vendors"),
    where("phone", "==", selectedReport.phone)
  );

  const snap = await getDocs(q);

  snap.forEach(async (docItem) => {

    await updateDoc(doc(db, "vendors", docItem.id), {
      banned: true,
      verified: false
    });

  });

  alert("Vendor banned ✔");

  closeModal();
};