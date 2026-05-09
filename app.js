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

// ============================
// PROFESSIONAL TOAST SYSTEM
// ============================

window.showToast = function (
  message,
  type = "success"
) {

  const toast =
    document.getElementById("toast");

  toast.className = "";

  toast.classList.add("show");
  toast.classList.add(type);

  toast.innerText = message;

  setTimeout(() => {
    toast.classList.remove("show");
  }, 3200);
};
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

    showToast("Admin login successful ✔");
      window.location.href = "admin.html";
      return;
    }

    // NORMAL USER FLOW
    const userDoc = await getDoc(doc(db, "users", user.uid));

    // if user doc missing
    if (!userDoc.exists()) {
      showToast("User profile not found");
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
window.addVendor = async function () {

  const user = auth.currentUser;

  if (!user) {
    showToast("Login required", "error");
    return;
  }

  // =========================
  // INPUT VALUES
  // =========================
  const vendorName =
    document.getElementById("vendorName").value;

  const vendorPhone =
    document.getElementById("vendorPhone").value;

  const vendorLocation =
    document.getElementById("vendorLocation").value;

  // =========================
  // VALIDATION
  // =========================
  if (
    !vendorName ||
    !vendorPhone ||
    !vendorLocation
  ) {
    showToast(
      "Please fill all fields",
      "warning"
    );
    return;
  }

  // =========================
  // CHECK IF PHONE EXISTS
  // =========================
  const q = query(
    collection(db, "vendors"),
    where("phone", "==", vendorPhone)
  );

  const existing =
    await getDocs(q);

  if (!existing.empty) {

    showToast(
      "Vendor already exists",
      "error"
    );

    return;
  }

  // =========================
  // ADD VENDOR
  // =========================
  await addDoc(
    collection(db, "vendors"),
    {

      name: vendorName,

      phone: vendorPhone,

      location: vendorLocation,

      verified: false,

      banned: false,

      trustScore: 100,

      averageRating: 0,

      searchCount: 0,

      purchaseCodes: [],

      createdBy: user.email,

      createdAt: new Date()
    }
  );

  showToast(
    "Business added successfully ✔"
  );

  // =========================
  // CLEAR INPUTS
  // =========================
  document.getElementById("vendorName").value = "";

  document.getElementById("vendorPhone").value = "";

  document.getElementById("vendorLocation").value = "";

  // =========================
  // RELOAD DASHBOARD
  // =========================
  loadVendorDashboard();
};

// ================= SEARCH =================
window.searchVendor = async () => {
  const q = query(collection(db, "vendors"), where("phone", "==", searchInput.value));
  const snap = await getDocs(q);
  await trackVendorSearch();
  result.innerHTML = "";

snap.forEach(async (docItem) => {

  let data = docItem.data();

  // UPDATE SEARCH COUNT
  await updateDoc(doc(db, "vendors", docItem.id), {
    searchCount: increment(1)
  });

  // USE REAL TRUST SCORE
  const trustScore =
    typeof data.trustScore === "number"
      ? data.trustScore
      : Number(data.trustScore) || 100;
result.innerHTML += `
  <div class="card">

    <b>${data.name}</b><br/>

    ${data.phone}<br/><br/>

    Trust Score: ${trustScore}%<br/>

    ⭐ Rating:
    ${data.averageRating || 0}/10
    <br/><br/>

    ${
      data.verified
        ? "🟢 Verified"
        : "⚪ Not Verified"
    }

    <br/><br/>

    <button onclick="openReviewModal(
      '${docItem.id}'
    )">
      Add Review
    </button>

    <button onclick="viewReviews(
      '${docItem.id}'
    )">
      View Reviews
    </button>

  </div>
`;
});
};
window.reportScam = async function () {

  const user = auth.currentUser;

  if (!user) return;

  let phone = document.getElementById("scamPhone").value;
  let reason = document.getElementById("scamReason").value;

  if (!phone || !reason) {
    showToast("Fill all fields");
    return;
  }

  try {

    // 1. SAVE REPORT
    await addDoc(collection(db, "scamReports"), {

      reporterEmail: user.email,
      phone: phone,
      reason: reason,
      createdAt: new Date()

    });

    // 2. FIND VENDOR BY PHONE (IMPORTANT FIX)
    const q = query(
      collection(db, "vendors"),
      where("phone", "==", phone)
    );

    const snap = await getDocs(q);

    snap.forEach(async (docSnap) => {

      const data = docSnap.data();

      let currentScore = data.trustScore ?? 100;

      // 3. REDUCE TRUST SCORE (-25 FIX)
      await updateDoc(doc(db, "vendors", docSnap.id), {
        trustScore: currentScore - 25
      });

    });

    showToast("Report submitted ✔");

  } catch (err) {
    console.error(err);
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

    showToast("You have been banned due to low trust score");

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

  // SAFETY CHECK
  if (!reportsBox || !vendorsBox) {
    console.error("Admin containers missing");
    return;
  }

  reportsBox.innerHTML = "";
  vendorsBox.innerHTML = "";

  // =========================
  // LOAD SCAM REPORTS
  // =========================
  const reportsSnap =
    await getDocs(collection(db, "scamReports"));

  reportsSnap.forEach(docItem => {

    const d = docItem.data();

    const div = document.createElement("div");

    div.className = "card";

    div.innerHTML = `
      <h3>🚨 Scam Report</h3>

      <p><b>Phone:</b> ${d.phone}</p>

      <p><b>Reason:</b> ${d.reason}</p>

      <p><b>By:</b> ${d.reporterEmail}</p>

      <button onclick="openReportModal(
        '${docItem.id}',
        '${d.phone}',
        '${d.reason}',
        '${d.reporterEmail}'
      )">
        View Report
      </button>
    `;

    reportsBox.appendChild(div);
  });

  // =========================
  // LOAD VENDORS
  // =========================
  const vendorsSnap =
    await getDocs(collection(db, "vendors"));

  vendorsSnap.forEach(docItem => {

    const d = docItem.data();

    const trustScore =
      typeof d.trustScore === "number"
        ? d.trustScore
        : Number(d.trustScore) || 100;

    const div = document.createElement("div");

    div.className = "card";

    div.innerHTML = `
      <h3>${d.name}</h3>

      <p>${d.phone}</p>

      <p>Trust Score: ${trustScore}%</p>

      <p>
        ${
          d.banned
            ? "🚫 BANNED"
            : "🟢 ACTIVE"
        }
      </p>

      <button onclick="banVendor(
        '${docItem.id}',
        '${d.createdBy}',
        '${d.phone}',
        '${d.name}'
      )">
        Ban Vendor
      </button>
    `;

    vendorsBox.appendChild(div);
  });
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

  if (!user) {
    showToast("Login required", "error");
    return;
  }

  const rating = Number(
    document.getElementById("reviewRating").value
  );

  const pros =
    document.getElementById("reviewPros").value;

  const cons =
    document.getElementById("reviewCons").value;

  const purchaseCode =
    document.getElementById("purchaseCode").value.trim();

  // =========================
  // VERIFY PURCHASE CODE
  // =========================
  let verifiedPurchase = false;

  if (purchaseCode) {

    const vendorRef =
      doc(db, "vendors", currentVendorId);

    const vendorSnap =
      await getDoc(vendorRef);

    const vendorData =
      vendorSnap.data();

    const codes =
      vendorData.purchaseCodes || [];
if (codes.includes(purchaseCode)) {

  verifiedPurchase = true;

  // REMOVE USED CODE
  const updatedCodes =
    codes.filter(
      code => code !== purchaseCode
    );

  // UPDATE FIRESTORE
  await updateDoc(vendorRef, {
    purchaseCodes: updatedCodes
  });
}
  }

  // =========================
  // SAVE REVIEW (FIRESTORE)
  // =========================
  await addDoc(
    collection(
      db,
      "vendors",
      currentVendorId,
      "reviews"
    ),
    {
      userId: user.uid,
      userEmail: user.email,

      rating,
      pros,
      cons,

      verifiedPurchase: verifiedPurchase,

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

  container.innerHTML = "<p>Loading reviews...</p>";

  document.getElementById("reviewsModal").style.display = "flex";

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
        ${
          d.verifiedPurchase
            ? " ✅ Verified Purchase"
            : ""
        }
      </h3>

      <p>
        <b>Pros:</b><br>
        ${d.pros || "None"}
      </p>

      <br>

      <p>
        <b>Cons:</b><br>
        ${d.cons || "None"}
      </p>
    `;

    container.appendChild(div);
  });

  // update average rating
  const avg = (totalRating / reviewCount).toFixed(1);

  await updateDoc(
    doc(db, "vendors", vendorId),
    {
      averageRating: Number(avg)
    }
  );
};

// ============================
// CLOSE REVIEWS MODAL
// ============================
window.closeReviewsModal =
  function () {

    document.getElementById(
      "reviewsModal"
    ).style.display = "none";
};
// ============================
// GENERATE PURCHASE CODE
// ============================
window.generatePurchaseCode =
async function () {

  const user = auth.currentUser;

  if (!user) return;

  // FIND VENDOR
  const q = query(
    collection(db, "vendors"),
    where("createdBy", "==", user.email)
  );

  const snap = await getDocs(q);

  if (snap.empty) return;

  const vendorDoc =
    snap.docs[0];

  // RANDOM CODE
  const code =
    "VP-" +
    Math.floor(
      10000 + Math.random() * 90000
    );

  // GET CURRENT CODES
  let data =
    vendorDoc.data();

  let codes =
    data.purchaseCodes || [];

  codes.push(code);

  // UPDATE FIRESTORE
  await updateDoc(
    doc(db, "vendors", vendorDoc.id),
    {
      purchaseCodes: codes
    }
  );

  showToast(
    `Purchase code: ${code}`
  );
};