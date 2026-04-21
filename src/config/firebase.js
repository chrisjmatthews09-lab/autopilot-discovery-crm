import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';

// Firebase web client config is safe to ship in the browser bundle — this is
// the Google-documented pattern. Security is enforced by Firestore rules and
// Auth domain allowlisting, not by hiding these values. Inlining them means
// CI doesn't need six more secrets just to produce a working build.
const firebaseConfig = {
  apiKey: 'AIzaSyAk-1G-tnIHfZdJcMQpLxrbBhWNoj1faxQ',
  authDomain: 'autopilot-crm-147f0.firebaseapp.com',
  projectId: 'autopilot-crm-147f0',
  storageBucket: 'autopilot-crm-147f0.firebasestorage.app',
  messagingSenderId: '1058017029354',
  appId: '1:1058017029354:web:70caa64fab93cce2b83b93',
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, 'us-central1');
export const googleProvider = new GoogleAuthProvider();
