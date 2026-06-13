/* ═══════════════════════════════════════════════════════════════════
   AMBI241 — firebase-config.js
   Projet : Ambi241  |  ID : ambi241
═══════════════════════════════════════════════════════════════════ */

const firebaseConfig = {
  apiKey:            "AIzaSyCx3hD28Lb9EtUrawHbTnM-6vmXdgO1ABw",
  authDomain:        "ambi241.firebaseapp.com",
  projectId:         "ambi241",
  storageBucket:     "ambi241.firebasestorage.app",
  messagingSenderId: "422590051382",
  appId:             "1:422590051382:web:fe05eaf701a6f704c2d497"
};

// Initialisation Firebase (SDK v9 compat)
import { initializeApp }         from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, doc, getDoc, setDoc, updateDoc,
         deleteDoc, getDocs, query, where, orderBy, limit,
         onSnapshot, addDoc, serverTimestamp, increment,
         Timestamp }              from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged,
         signInWithEmailAndPassword, createUserWithEmailAndPassword,
         signOut, GoogleAuthProvider, signInWithPopup }
                                  from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getStorage, ref as storageRef,
         uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const app     = initializeApp(firebaseConfig);
const db      = getFirestore(app);
const auth    = getAuth(app);
const storage = getStorage(app);

// Expose globaux (utilisés par index.html et les modules)
window.db      = db;
window.auth    = auth;
window.storage = storage;

// Expose les helpers Firestore globaux
window.fbCollection    = collection;
window.fbDoc           = doc;
window.fbGetDoc        = getDoc;
window.fbSetDoc        = setDoc;
window.fbUpdateDoc     = updateDoc;
window.fbDeleteDoc     = deleteDoc;
window.fbGetDocs       = getDocs;
window.fbQuery         = query;
window.fbWhere         = where;
window.fbOrderBy       = orderBy;
window.fbLimit         = limit;
window.fbOnSnapshot    = onSnapshot;
window.fbAddDoc        = addDoc;
window.fbServerTimestamp = serverTimestamp;
window.fbIncrement     = increment;
window.fbTimestamp     = Timestamp;

// Auth helpers
window.fbSignIn        = signInWithEmailAndPassword;
window.fbSignUp        = createUserWithEmailAndPassword;
window.fbSignOut       = signOut;
window.fbGoogleProvider = new GoogleAuthProvider();
window.fbSignInPopup   = signInWithPopup;
window.fbOnAuth        = onAuthStateChanged;

// Storage helpers
window.fbStorageRef    = storageRef;
window.fbUploadBytes   = uploadBytes;
window.fbGetDownloadURL = getDownloadURL;

// Signal d'initialisation (écouté par core-app.js)
window.firebaseReady = true;
window.dispatchEvent(new CustomEvent('firebaseInitialized'));

console.log('%c🔥 Firebase initialisé', 'color: #ff2d9b; font-weight: bold');
