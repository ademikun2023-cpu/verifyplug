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
  setDoc,
  getDoc,
  updateDoc,
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
    const userCred = await signInWithEmailAndPassword(auth, email, password);

    const userDoc = await getDoc(doc(db, "users", userCred.user.uid));

    const role = userDoc.data().role;

    alert("Login successful");

    if (role === "vendor") {
      window.location.href = "vendor.html";
    } else {
      window.location.href = "customer.html";
    }

  } catch (e) {
    alert(e.message);
  }
};
// ================= ADD VENDOR =================
window.addVendor = async function () {

  const user = auth.currentUser;

  let name = document.getElementById("vendorName").value;
  let phone = document.getElementById("vendorPhone").value;
  let location = document.getElementById("vendorLocation").value;

  await addDoc(collection(db, "vendors"), {
    name,
    phone,
    location,
    createdBy: user.email,
    verified: false,
    searches: 0
  });

  alert("Business added successfully");

  location.reload();
};

// ================= SEARCH =================
window.searchVendor = async () => {
  const q = query(collection(db, "vendors"), where("phone", "==", searchInput.value));
  const snap = await getDocs(q);

  result.innerHTML = "";

  snap.forEach(async (docItem) => {
    let data = docItem.data();

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

// ================= REPORT SCAM =================
window.reportScam = async () => {
  const q = query(collection(db, "vendors"), where("phone", "==", scamPhone.value));
  const snap = await getDocs(q);

  if (snap.empty) return alert("Vendor not found");

  await addDoc(collection(db, "vendors", snap.docs[0].id, "scams"), {
    reason: scamReason.value
  });

  alert("Reported");
};

// ================= PAYSTACK =================
window.payForVerification = function (vendorId, email) {

  if (!vendorId || !email) {
    alert("Missing vendor info");
    return;
  }

  let handler = PaystackPop.setup({
    key: "pk_test_efbb2bdcd089cefcb6bb2c7aa7677fed9c173ad9",
    email: email,
    amount: 10000 * 100,
    currency: "NGN",

    // ✅ MUST BE INSIDE HERE EXACTLY
    callback: function (response) {

      console.log("PAYSTACK SUCCESS:", response);

      updateDoc(doc(db, "vendors", vendorId), {
        verified: true,
        paymentRef: response.reference
      }).then(() => {
        alert("Payment successful ✔ Vendor verified");
        location.reload();
      }).catch(err => {
        console.error(err);
        alert("Payment ok but DB update failed");
      });

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

  if (!snap.empty) {

    const vendor = snap.docs[0];
    const data = vendor.data();

    document.getElementById("vendorForm").style.display = "none";

    document.getElementById("vendorDashboard").style.display = "block";

    document.getElementById("welcomeText").innerText =
      `Hi ${data.name} 👋`;

    let score = data.verified ? 85 : 45;

    document.getElementById("trustFill").style.width =
      score + "%";

    document.getElementById("trustText").innerText =
      score + "% Trusted";

    document.getElementById("searchCount").innerText =
      data.searches || 0;

    if (data.verified) {
      setStatus(true);
      document.getElementById("verifyBtn").style.display = "none";
    }

    document.getElementById("verifyBtn").onclick = () => {
      payForVerification(vendor.id, user.email);
    };
  }
};
onAuthStateChanged(auth, (user) => {

  if (user && window.location.pathname.includes("vendor.html")) {
    loadVendorDashboard();
  }

});