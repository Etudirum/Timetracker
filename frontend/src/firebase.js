import { initializeApp } from "firebase/app";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCimLoYpJOlCJdxXr5Qyo7UHxrwb_ss-04",
  authDomain: "timetracker-10.firebaseapp.com",
  projectId: "timetracker-10",
  storageBucket: "timetracker-10.firebasestorage.app",
  messagingSenderId: "535538347269",
  appId: "1:535538347269:web:af5762ce4cdfb24045db6c"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Enable offline persistence
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    console.log('Persistence échouée - plusieurs onglets ouverts');
  } else if (err.code === 'unimplemented') {
    console.log('Persistence non supportée par ce navigateur');
  }
});

export default app;