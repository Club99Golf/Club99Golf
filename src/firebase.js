import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// This is your specific configuration from the browser
const firebaseConfig = {
  apiKey: "AIzaSyCtvMnSnohd3GvTvgT0qfEUaHhp6KFnyR8",
  authDomain: "golf-app-9c01f.firebaseapp.com",
  projectId: "golf-app-9c01f",
  storageBucket: "golf-app-9c01f.appspot.com",
  messagingSenderId: "919346751838",
  appId: "1:919346751838:web:da2906170d5254267e07cf",
  measurementId: "G-SR5KQZERKF"
};

// Initialize Firebase and Export the Database
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);