import { initializeApp } from "firebase/app";
import {
  getAuth,
  initializeAuth,
  browserLocalPersistence,
  browserSessionPersistence,
  indexedDBLocalPersistence
} from "firebase/auth";
import { getFirestore, initializeFirestore, persistentLocalCache } from "firebase/firestore";

export const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "AIzaSyCtvMnSnohd3GvTvgT0qFEUaHhp6KFnyR8",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "golf-app-9c01f.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "golf-app-9c01f",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "golf-app-9c01f.appspot.com",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "919346751838",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:919346751838:web:da2906170d5254267e07cf",
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || "G-SR5KQZERKF",
};

export const firebaseApp = initializeApp(firebaseConfig);

export const auth = (() => {
  try {
    return initializeAuth(firebaseApp, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence],
    });
  } catch {
    return getAuth(firebaseApp);
  }
})();