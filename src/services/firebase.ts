import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

export const firebaseConfig = {
  apiKey: "AIzaSyBR2zF7OMFni3UQOLTQDoRsYJcwMxSpsRQ",
  authDomain: "projetoeventos-c6466.firebaseapp.com",
  projectId: "projetoeventos-c6466",
  storageBucket: "projetoeventos-c6466.firebasestorage.app",
  messagingSenderId: "114445327320",
  appId: "1:114445327320:web:e03b427dffdefe2e3330ad",
  measurementId: "G-M4JJ4D78D9",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
