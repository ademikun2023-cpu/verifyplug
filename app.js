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
  let name = document.getElementById("name").value;
  let phone = document.getElementById("phone").value;

  await addDoc(collection(db, "vendors"), {
    name: name,
    phone: phone
  });

  alert("Saved to database!");
};
import {
  doc,
  collection,
  addDoc,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
  let input = document.getElementById("searchInput").value;

  const q = query(
    collection(db, "vendors"),
    where("phone", "==", input)
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    document.getElementById("result").innerHTML = "No vendor found";
    return;
  }

  const vendorDoc = snapshot.docs[0];
  const data = vendorDoc.data();

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
};
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