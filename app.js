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
const firebaseConfig = {
  apiKey: "AIzaSyAFkCQI646z0NTyKZB1ZL7D5EYZuxGTSlY",
  authDomain: "verifyplug-a28d6.firebaseapp.com",
  projectId: "verifyplug-a28d6",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
window.signup = async function () {
  let email = email.value;
  let password = password.value;
  let role = document.getElementById("role").value;

  try {
    await createUserWithEmailAndPassword(auth, email, password);

    const user = auth.currentUser;

    await setDoc(doc(db, "users", user.uid), {
      email: user.email,
      role
    });

    window.location.href =
      role === "vendor" ? "vendor.html" : "customer.html";

  } catch (e) {
    alert(e.message);
  }
};
window.login = async function () {
  let email = email.value;
  let password = password.value;

  try {
    await signInWithEmailAndPassword(auth, email, password);

    const user = auth.currentUser;
    const userDoc = await getDoc(doc(db, "users", user.uid));

    const role = userDoc.data().role;

    window.location.href =
      role === "vendor" ? "vendor.html" : "customer.html";

  } catch (e) {
    alert(e.message);
  }
};