/* ==========================================================================
   FIREBASE-CONFIG.JS
   ========================================================================== */

const firebaseConfig = {
  apiKey: "AIzaSyAOsQQEIfW4TRugygHt0ZEi3qeI5N7WQEQ",
  authDomain: "highwayfeeds-pos.firebaseapp.com",
  projectId: "highwayfeeds-pos",
  storageBucket: "highwayfeeds-pos.firebasestorage.app",
  messagingSenderId: "12460256188",
  appId: "1:12460256188:web:f3b49b936eebf02e9659b9"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
  if (err.code === "failed-precondition") {
    console.warn("Offline persistence: multiple tabs open, persistence enabled in another tab only.");
  } else if (err.code === "unimplemented") {
    console.warn("Offline persistence not supported in this browser.");
  }
});

const FIXED_EMAILS = {
  seller: "seller@mistycode.local",
  manager: "manager@mistycode.local",
};
