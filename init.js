// ============================================================
//  firebase/init.js  —  Initialize Firebase services
// ============================================================
import { initializeApp }                    from 'firebase/app';
import { getAuth, GoogleAuthProvider }      from 'firebase/auth';
import { getFirestore }                     from 'firebase/firestore';
import { getStorage }                       from 'firebase/storage';
import firebaseConfig                       from './config.js';

const app       = initializeApp(firebaseConfig);
export const auth      = getAuth(app);
export const db        = getFirestore(app);
export const storage   = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

// Force account selection every time (so users can switch accounts)
googleProvider.setCustomParameters({ prompt: 'select_account' });
