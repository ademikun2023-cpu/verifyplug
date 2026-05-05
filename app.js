// Import Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Your config
const firebaseConfig = {
  apiKey: "AIzaSyAFkCQI646z0NTyKZB1ZL7D5EYZuxGTSlY",
  authDomain: "verifyplug-a28d6.firebaseapp.com",
  projectId: "verifyplug-a28d6",
  storageBucket: "verifyplug-a28d6.firebasestorage.app",
  messagingSenderId: "244761045495",
  appId: "1:244761045495:web:4c2f0091a7a46a7272e6f2"
};

// Initialize
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ADD vendor
window.addVendor = async function () {
  const user = auth.currentUser;

  if (!user) {
    alert("You must be logged in");
    return;
  }

  let name = document.getElementById("vendorName").value;
  let phone = document.getElementById("vendorPhone").value;
  let location = document.getElementById("vendorLocation").value;

  if (!name || !phone) {
    alert("Fill required fields");
    return;
  }

  await addDoc(collection(db, "vendors"), {
    name,
    phone,
    location,
    createdBy: user.email,
    createdAt: new Date()
  });

  alert("Business added successfully!");
};
// ADD REVIEW
window.addReview = async function () {
  let phone = document.getElementById("reviewPhone").value;
  let rating = document.getElementById("rating").value;
  let comment = document.getElementById("comment").value;

  const q = query(
    collection(db, "vendors"),
    where("phone", "==", phone)
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    alert("Vendor not found!");
    return;
  }

  const vendorDoc = snapshot.docs[0];

  await addDoc(
    collection(db, "vendors", vendorDoc.id, "reviews"),
    {
      rating: Number(rating),
      comment: comment
    }
  );

  alert("Review added!");
};
// SEARCH vendor
window.searchVendor = async function () {

  let phone = document.getElementById("searchInput").value;

  const q = query(collection(db, "vendors"), where("phone", "==", phone));
  const snap = await getDocs(q);

  document.getElementById("result").innerHTML = "";

  snap.forEach(async (docItem) => {

    let data = docItem.data();

    let score = await getTrustScore(docItem.id);

    let verified = score >= 70 ? "🟢 Verified" : "🔴 Not Verified";

    document.getElementById("result").innerHTML = `
      <div style="padding:12px;">
        <b>${data.name}</b><br/>
        ${data.phone}<br/><br/>

        ${renderTrust(score)}<br/>

        <div style="font-size:12px;">
          ${verified}
        </div>
      </div>
    `;
  });
};
  // Get reviews
  const reviewsSnapshot = await getDocs(
    collection(db, "vendors", vendorDoc.id, "reviews")
  );

  let reviewsHTML = "";
  let total = 0;

  reviewsSnapshot.forEach(doc => {
    let r = doc.data();
    total += r.rating;

    reviewsHTML += `<p>⭐ ${r.rating} - ${r.comment}</p>`;
  });

  let avg = reviewsSnapshot.size
    ? (total / reviewsSnapshot.size).toFixed(1)
    : "No rating";

  document.getElementById("result").innerHTML = `
    <h3>${data.name}</h3>
    <p>Phone: ${data.phone}</p>
    <p>Trust Score: ${avg}</p>
    <h4>Reviews:</h4>
    ${reviewsHTML || "No reviews yet"}
  `;
window.reportScam = async function () {
  let phone = document.getElementById("scamPhone").value;
  let reason = document.getElementById("scamReason").value;

  const q = query(
    collection(db, "vendors"),
    where("phone", "==", phone)
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    alert("Vendor not found!");
    return;
  }

  const vendorDoc = snapshot.docs[0];

  await addDoc(
    collection(db, "vendors", vendorDoc.id, "scams"),
    {
      reason: reason,
      date: new Date()
    }
  );

  alert("Scam reported!");
};
// Get scam reports
const scamSnapshot = await getDocs(
  collection(db, "vendors", vendorDoc.id, "scams")
);

let scamCount = scamSnapshot.size;
<p>🚨 Scam Reports: ${scamCount}</p>
let avg = reviewsSnapshot.size
  ? total / reviewsSnapshot.size
  : 0;

let trustScore = (avg * 20) - (scamCount * 10);

if (trustScore < 0) trustScore = 0;

trustScore = trustScore.toFixed(0);

<p>Trust Score: ${trustScore}/100</p>

if (!name || !phone) {
  alert("Fill all fields");
  return;
}
onAuthStateChanged(auth, (user) => {

  // If user is logged in
  if (user) {

    // show UI
    const container = document.querySelector(".container");
    if (container) container.style.display = "block";

    // show user email
    const userInfo = document.getElementById("userInfo");
    if (userInfo) {
      userInfo.innerText = "Logged in as: " + user.email;
    }

  } else {

    // hide UI
    const container = document.querySelector(".container");
    if (container) container.style.display = "none";
  }
});
window.goCustomer = function () {
  window.location.href = "customer.html";
};

window.goVendor = function () {
  window.location.href = "vendor.html";
};window.loadAdminData = async function () {

  const vendorList = document.getElementById("vendorList");
  const scamList = document.getElementById("scamList");

  vendorList.innerHTML = "";
  scamList.innerHTML = "";

  // GET VENDORS
  const vendorsSnap = await getDocs(collection(db, "vendors"));

  vendorsSnap.forEach((docItem) => {
    const v = docItem.data();

    vendorList.innerHTML += `
      <div style="padding:10px; background:#1f2937; margin-bottom:8px; border-radius:8px;">
        <b>${v.name}</b><br/>
        ${v.phone}<br/>
        <button onclick="deleteVendor('${docItem.id}')">Delete</button>
      </div>
    `;
  });

  // GET SCAMS (ALL SUBCOLLECTIONS - SIMPLE VERSION)
  const vendors = await getDocs(collection(db, "vendors"));

  vendors.forEach(async (vDoc) => {
    const scamSnap = await getDocs(collection(db, "vendors", vDoc.id, "scams"));

    scamSnap.forEach((s) => {
      const data = s.data();

      scamList.innerHTML += `
        <div style="padding:10px; background:#1f2937; margin-bottom:8px; border-radius:8px;">
          <b>Vendor ID:</b> ${vDoc.id}<br/>
          Reason: ${data.reason}
        </div>
      `;
    });
  });

};window.deleteVendor = async function (id) {
  await deleteDoc(doc(db, "vendors", id));
  alert("Vendor deleted");
  loadAdminData();
};if (window.location.pathname.includes("admin.html")) {
  loadAdminData();
}onAuthStateChanged(auth, (user) => {

  if (window.location.pathname.includes("admin.html")) {

    if (!user || user.email !== "ademikun2023@gmail.com") {
      alert("Access denied");
      window.location.href = "index.html";
    }

  }

});
window.signup = async function () {

  let email = document.getElementById("email").value;
  let password = document.getElementById("password").value;
  let role = document.getElementById("role").value;

  await createUserWithEmailAndPassword(auth, email, password);

  const user = auth.currentUser;

  await setDoc(doc(db, "users", user.uid), {
    email: user.email,
    role: role
  });

  routeUser(role);
};
window.login = async function () {

  let email = document.getElementById("email").value;
  let password = document.getElementById("password").value;

  await signInWithEmailAndPassword(auth, email, password);

  const user = auth.currentUser;

  const userDoc = await getDoc(doc(db, "users", user.uid));

  if (userDoc.exists()) {
    const role = userDoc.data().role;
    routeUser(role);
  }
};
function routeUser(role) {
  if (role === "vendor") {
    window.location.href = "vendor.html";
  } else {
    window.location.href = "customer.html";
  }
}
/* 🔍 SEARCH FUNCTION */
function searchVendor() {
  // your existing logic here
}

/* 📊 TRUST SCORE FUNCTION 👇 PUT HERE */
function renderTrust(score) {
  return `
    <div style="margin-top:10px;">
      <div style="font-size:12px; opacity:0.7;">Trust Score</div>

      <div style="height:10px; background:#1f2937; border-radius:20px; overflow:hidden; margin-top:6px;">
        <div style="width:${score}%; height:100%; background:linear-gradient(90deg,#22c55e,#16a34a);"></div>
      </div>

      <div style="font-size:12px; margin-top:6px; opacity:0.7;">
        ${score}% Trusted
      </div>
    </div>
  `;
}
document.getElementById("result").innerHTML = `
  <div><b>Vendor Found</b></div>
  <div>Phone: 080xxxxxxx</div>
  ${renderTrust(72)}
`;
async function getTrustScore(vendorId) {

  const scamsRef = collection(db, "vendors", vendorId, "scams");
  const scamSnap = await getDocs(scamsRef);

  let scamCount = scamSnap.size;

  // Base score
  let score = 100;

  // Each scam reduces score
  score -= scamCount * 15;

  if (score < 0) score = 0;

  return score;
}
addDoc(collection(db, "vendors", vendorId, "scams"), {
  reason: "scam report"
});