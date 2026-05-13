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
function getDeviceId() {

  let deviceId = localStorage.getItem("deviceId");

  if (!deviceId) {

    deviceId = crypto.randomUUID();

    localStorage.setItem("deviceId", deviceId);
  }

  return deviceId;
}

function getVendorStatus(trustScore) {

  if (trustScore >= 85) {
    return {
      label: "Recommended Vendor ⭐",
      className: "status-recommended"
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
      label: "Unverified Vendor ⚠️",
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
    (vendor.trustScore ?? 100) >= 50
  ) {
    return "✅ Verified Purchase";
  }

  return "";
}
function filterVendors(vendors) {

  return vendors.filter(v => {

    const score = v.trustScore ?? 100;

    // remove banned / very low trust
    if (score <= 20) return false;

    return true;
  });

}
function sortVendors(vendors) {

  return vendors.sort((a, b) => {

    const scoreA = a.trustScore ?? 100;
    const scoreB = b.trustScore ?? 100;

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

    const userCred = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

    const user = userCred.user;

    // ADMIN BYPASS
    if (user.email === "ademikun2023@gmail.com") {
      showToast("Admin login successful ✔");
      window.location.href = "admin.html";
      return;
    }

    const userDoc = await getDoc(doc(db, "users", user.uid));

    if (!userDoc.exists()) {
      showToast("User profile not found");
      return;
    }

    const role = userDoc.data().role;

    // IMPORTANT FIX:
    // wait for auth state to settle before redirect UI breaks
    await new Promise(resolve => setTimeout(resolve, 300));

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

  const q = query(
    collection(db, "vendors"),
    where("phone", "==", searchInput.value)
  );

  const snap = await getDocs(q);

  await trackVendorSearch();

  result.innerHTML = "";

  // =========================
  // EMPTY SEARCH
  // =========================
  if (snap.empty) {

    result.innerHTML = `
      <div class="card">

        <p>
          No vendor found.
        </p>

      </div>
    `;

    return;
  }

  // =========================
  // LOOP RESULTS
  // =========================
  snap.forEach(async (docItem) => {

    let data = docItem.data();

    // =========================
    // UPDATE SEARCH COUNT
    // =========================
    await updateDoc(
      doc(db, "vendors", docItem.id),
      {
        searchCount: increment(1)
      }
    );

    // =========================
    // REAL TRUST SCORE
    // =========================
    const trustScore =
      typeof data.trustScore === "number"
        ? data.trustScore
        : Number(data.trustScore) || 100;

    // =========================
    // STATUS ENGINE
    // =========================
    const status =
      getVendorStatus(trustScore);

    // =========================
    // VERIFIED BADGE
    // =========================
    const verifiedBadge =
      getVerifiedBadge(data);

    // =========================
    // RENDER CARD
    // =========================
    result.innerHTML += `

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

          <p>
            📞 ${data.phone || "No phone"}
          </p>

          <p>
            📊 Trust Score:
            ${trustScore}%
          </p>

          <p>
            ⭐ Rating:
            ${data.averageRating || 0}/10
          </p>

          <p>
            🧾 ${data.location || "No location"}
          </p>

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
        data.trustScore ?? 100;

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
// ===============================
// VENDOR DASHBOARD (FIXED + MERGED)
// ===============================

window.loadVendorDashboard = async function () {

  const user = auth.currentUser;
  if (!user) return;

  try {

    // =========================
    // GET VENDOR (OWN ACCOUNT)
    // =========================
    const q = query(
      collection(db, "vendors"),
      where("createdBy", "==", user.email)
    );

    const snap = await getDocs(q);

    // =========================
    // CONTAINERS
    // =========================
    const container =
      document.getElementById("vendorList");

    const ownerContainer =
      document.getElementById("vendorOwnerDashboard");

    if (container) container.innerHTML = "";
    if (ownerContainer) ownerContainer.innerHTML = "";

    // =========================
    // NO VENDOR FOUND
    // =========================
    if (snap.empty) {

      if (ownerContainer) {
        ownerContainer.innerHTML = `
          <div class="card">
            <h3>No vendor business found</h3>
          </div>
        `;
      }

      return;
    }

    // =========================
    // GET FIRST VENDOR DOC
    // =========================
    const docItem = snap.docs[0];
    const data = docItem.data();

    const trustScore = data.trustScore ?? 100;

    const status = getVendorStatus(trustScore);
    const verifiedBadge = getVerifiedBadge(data);

    const maxCodes = data.verified ? 60 : 20;
    const usedCodes = data.codesUsedThisMonth || 0;
    const remainingCodes = maxCodes - usedCodes;

    // =========================
    // OWNER DASHBOARD VIEW (FIXED)
    // =========================
    if (ownerContainer) {

      ownerContainer.innerHTML = `
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
          <p>🔑 Purchase Codes Remaining: ${remainingCodes}/${maxCodes}</p>

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
    }

    // =========================
    // LIST VIEW (ADMIN / OTHER UI)
    // =========================
    if (container) {

      const card = document.createElement("div");
      card.className = "vendor-card";

      card.innerHTML = `
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

        <p>📞 ${data.phone || "No phone"}</p>
        <p>📊 Trust Score: ${trustScore}%</p>
        <p>🧾 ${data.location || "No location"}</p>

        <button onclick="viewVendor('${docItem.id}')">
          View Profile
        </button>
      `;

      container.appendChild(card);
    }

  } catch (err) {

    console.error("Vendor dashboard error:", err);

    showToast("Failed to load vendor dashboard", "error");
  }
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

  // =========================
  // PURCHASE CHECK
  // =========================
  if (purchaseCode) {

    const vendorRef = doc(db, "vendors", currentVendorId);
    const vendorSnap = await getDoc(vendorRef);
    const vendorData = vendorSnap.data();

    const codes = vendorData.purchaseCodes || [];

    if (codes.includes(purchaseCode)) {
      verifiedPurchase = true;
    }
  }

  // =========================
  // SAVE REVIEW
  // =========================
  await addDoc(
    collection(db, "vendors", currentVendorId, "reviews"),
    {
      userId: user.uid,
      userEmail: user.email,

      deviceId, // important

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

window.closeReviewsModal =
  function () {

    document.getElementById(
      "reviewsModal"
    ).style.display = "none";
};

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
