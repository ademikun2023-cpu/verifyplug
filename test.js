alert("JS IS WORKING");
// ==========================
// Firebase Imports
// ==========================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
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

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import { PaystackPop } from "https://js.paystack.co/v1/inline.js";

// ==========================
// Firebase Config
// ==========================
const firebaseConfig = {
  apiKey: "AIzaSyAFkCQI646z0NTyKZB1ZL7D5EYZuxGTSlY",
  authDomain: "verifyplug-a28d6.firebaseapp.com",
  projectId: "verifyplug-a28d6",
  storageBucket: "verifyplug-a28d6.firebasestorage.app",
  messagingSenderId: "244761045495",
  appId: "1:244761045495:web:4c2f0091a7a46a7272e6f2"
};

// ==========================
// Init
// ==========================
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// ==========================
// ROUTING (GLOBAL)
// ==========================
window.goCustomer = function () {
  window.location.href = "customer.html";
};

window.goVendor = function () {
  window.location.href = "vendor.html";
};

// ==========================
// AUTH SYSTEM
// ==========================
window.signup = async function () {
  let email = document.getElementById("email").value;
  let password = document.getElementById("password").value;
  let role = document.getElementById("role").value;

  const userCred = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCred.user;

  await setDoc(doc(db, "users", user.uid), {
    email,
    role
  });

  routeUser(role);
};

window.login = async function () {
  let email = document.getElementById("email").value;
  let password = document.getElementById("password").value;

  const userCred = await signInWithEmailAndPassword(auth, email, password);
  const user = userCred.user;

  const userDoc = await getDoc(doc(db, "users", user.uid));

  if (userDoc.exists()) {
    routeUser(userDoc.data().role);
  }
};

function routeUser(role) {
  if (role === "vendor") {
    window.location.href = "vendor.html";
  } else {
    window.location.href = "customer.html";
  }
}

// ==========================
// AUTH UI STATE
// ==========================
onAuthStateChanged(auth, (user) => {
  const container = document.querySelector(".container");

  if (!container) return;

  if (user) {
    container.style.display = "block";
  } else {
    container.style.display = "none";
  }
});

// ==========================
// VENDOR ADD
// ==========================
window.addVendor = async function () {
  const user = auth.currentUser;

  if (!user) return alert("Login required");

  const name = document.getElementById("vendorName").value;
  const phone = document.getElementById("vendorPhone").value;
  const location = document.getElementById("vendorLocation").value;

  await addDoc(collection(db, "vendors"), {
    name,
    phone,
    location,
    createdBy: user.email,
    verified: false,
    createdAt: new Date()
  });

  alert("Vendor added!");
};

// ==========================
// TRUST SCORE
// ==========================
async function getTrustScore(vendorId) {
  const scamsSnap = await getDocs(collection(db, "vendors", vendorId, "scams"));

  let score = 100 - scamsSnap.size * 15;

  if (score < 0) score = 0;

  return score;
}

function renderTrust(score) {
  return `
    <div>
      <div style="background:#222;height:10px;border-radius:10px;">
        <div style="width:${score}%;height:10px;background:green;border-radius:10px;"></div>
      </div>
      <small>${score}% Trust</small>
    </div>
  `;
}

// ==========================
// SEARCH
// ==========================
window.searchVendor = async function () {
  const phone = document.getElementById("searchInput").value;

  const q = query(collection(db, "vendors"), where("phone", "==", phone));
  const snap = await getDocs(q);

  let resultDiv = document.getElementById("result");
  resultDiv.innerHTML = "";

  snap.forEach(async (docItem) => {
    const data = docItem.data();
    const score = await getTrustScore(docItem.id);

    resultDiv.innerHTML += `
      <div>
        <h3>${data.name}</h3>
        <p>${data.phone}</p>
        ${renderTrust(score)}
      </div>
    `;
  });
};

// ==========================
// REPORT SCAM
// ==========================
window.reportScam = async function () {
  const phone = document.getElementById("scamPhone").value;
  const reason = document.getElementById("scamReason").value;

  const q = query(collection(db, "vendors"), where("phone", "==", phone));
  const snap = await getDocs(q);

  if (snap.empty) return alert("Vendor not found");

  const vendor = snap.docs[0];

  await addDoc(collection(db, "vendors", vendor.id, "scams"), {
    reason,
    date: new Date()
  });

  alert("Reported!");
};

// ==========================
// PAYSTACK (VERIFICATION)
// ==========================
window.payForVerification = function (vendorId, email) {
  let handler = PaystackPop.setup({
    key: "pk_live_051922fbc194c192821f256f14ccab760e3fb35d",
    email,
    amount: 10000 * 100,
    currency: "NGN",

    callback: async function (response) {
      await updateDoc(doc(db, "vendors", vendorId), {
        verified: true,
        paymentRef: response.reference
      });

      alert("Vendor verified!");
      location.reload();
    },

    onClose: function () {
      alert("Payment cancelled");
    }
  });

  handler.openIframe();
};

// ==========================
// ADMIN (basic)
// ==========================
window.deleteVendor = async function (id) {
  await deleteDoc(doc(db, "vendors", id));
  alert("Deleted");
};
window.signup = async function () {
  console.log("signup works");
};

window.login = async function () {
  console.log("login works");
};