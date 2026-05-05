// ==========================
// 1. FIREBASE IMPORTS
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
  updateDoc,
  setDoc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";


// ==========================
// 2. FIREBASE CONFIG
// ==========================
const firebaseConfig = {
  apiKey: "AIzaSyAFkCQI646z0NTyKZB1ZL7D5EYZuxGTSlY",
  authDomain: "verifyplug-a28d6.firebaseapp.com",
  projectId: "verifyplug-a28d6",
  storageBucket: "verifyplug-a28d6.firebasestorage.app",
  messagingSenderId: "244761045495",
  appId: "1:244761045495:web:4c2f0091a7a46a7272e6f2"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);


// ==========================
// 3. AUTH SYSTEM
// ==========================
window.signup = async function () {
  let email = document.getElementById("email").value;
  let password = document.getElementById("password").value;
  let role = document.getElementById("role").value;

  try {
    await createUserWithEmailAndPassword(auth, email, password);

    const user = auth.currentUser;

    await setDoc(doc(db, "users", user.uid), {
      email: user.email,
      role: role
    });

    alert("Signup successful");

    window.location.href =
      role === "vendor" ? "vendor.html" : "customer.html";

  } catch (e) {
    alert(e.message);
  }
};


window.login = async function () {
  let email = document.getElementById("email").value;
  let password = document.getElementById("password").value;

  try {
    await signInWithEmailAndPassword(auth, email, password);

    const user = auth.currentUser;
    const userDoc = await getDoc(doc(db, "users", user.uid));

    const role = userDoc.data().role;

    alert("Login successful");

    window.location.href =
      role === "vendor" ? "vendor.html" : "customer.html";

  } catch (e) {
    alert(e.message);
  }
};


// ==========================
// 4. ADD VENDOR
// ==========================
window.addVendor = async function () {

  const user = auth.currentUser;
  if (!user) return alert("Login first");

  let name = document.getElementById("vendorName").value;
  let phone = document.getElementById("vendorPhone").value;
  let location = document.getElementById("vendorLocation").value;

  await addDoc(collection(db, "vendors"), {
    name,
    phone,
    location,
    createdBy: user.email,
    verified: false,
    createdAt: new Date()
  });

  alert("Vendor added");
};


// ==========================
// 5. TRUST SCORE
// ==========================
async function getTrustScore(vendorId) {

  const scamsRef = collection(db, "vendors", vendorId, "scams");
  const scamSnap = await getDocs(scamsRef);

  let score = 100 - (scamSnap.size * 15);

  if (score < 0) score = 0;

  return score;
}


// ==========================
// 6. TRUST UI
// ==========================
function renderTrust(score) {
  return `
    <div style="margin-top:10px;">
      <div style="height:10px;background:#111;border-radius:20px;">
        <div style="width:${score}%;height:100%;
        background:linear-gradient(90deg,green,lime);"></div>
      </div>
      <small>${score}% Trust</small>
    </div>
  `;
}


// ==========================
// 7. SEARCH VENDOR
// ==========================
window.searchVendor = async function () {

  let phone = document.getElementById("searchInput").value;

  const q = query(collection(db, "vendors"), where("phone", "==", phone));
  const snap = await getDocs(q);

  document.getElementById("result").innerHTML = "";

  snap.forEach(async (docItem) => {

    let data = docItem.data();
    let id = docItem.id;

    let score = await getTrustScore(id);
    let verified = score >= 70 ? "🟢 Verified" : "🔴 Not Verified";

    document.getElementById("result").innerHTML = `
      <div>
        <b>${data.name}</b><br/>
        ${data.phone}<br/>

        ${renderTrust(score)}

        <div>${verified}</div>

        <button onclick="payForVerification('${id}', '${data.createdBy}')">
          Verify Vendor (₦10,000)
        </button>
      </div>
    `;
  });
};


// ==========================
// 8. PAYSTACK PAYMENT
// ==========================
window.payForVerification = function (vendorId, email) {

  let handler = PaystackPop.setup({
    key: "pk_test_efbb2bdcd089cefcb6bb2c7aa7677fed9c173ad9",
    email: email,
    amount: 10000 * 100,
    currency: "NGN",

    callback: async function (response) {

      await updateDoc(doc(db, "vendors", vendorId), {
        verified: true,
        paymentRef: response.reference
      });

      alert("Vendor verified 🟢");

      location.reload();
    },

    onClose: function () {
      alert("Payment cancelled");
    }
  });

  handler.openIframe();
};


// ==========================
// 9. AUTH STATE
// ==========================
onAuthStateChanged(auth, (user) => {

  const container = document.querySelector(".container");

  if (user) {
    if (container) container.style.display = "block";
  } else {
    if (container) container.style.display = "none";
  }
});