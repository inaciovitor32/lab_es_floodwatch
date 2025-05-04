import { initializeApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth, signInAnonymously, onAuthStateChanged, User } from 'firebase/auth';

const firebaseConfig = {
  // YOUR FIREBASE PROJECT CONFIG
};

const app: FirebaseApp = initializeApp(firebaseConfig);
const db: Firestore = getFirestore(app);
const auth: Auth = getAuth(app);

const signInAnonymouslyIfNeeded = async (): Promise<void> => {
  try {
    if (!auth.currentUser) {
      await signInAnonymously(auth);
      console.log('Anonymous user signed in');
    } else {
      console.log('User already signed in:', auth.currentUser.uid);
    }
  } catch (error) {
    console.error('Anonymous sign-in failed:', error);
  }
};

const setupAuthStateListener = (): void => {
  onAuthStateChanged(auth, (user: User | null) => {
    if (user) {
      console.log('Auth state changed: User signed in with UID', user.uid);
    } else {
      console.log('Auth state changed: User signed out');
    }
  });
};

const initializeFirebaseAuth = async (): Promise<void> => {
  await signInAnonymouslyIfNeeded();
  setupAuthStateListener();
};

// ❗️Don't auto-run during test – just export
// initializeFirebaseAuth().catch((error) => {
//   console.error('Failed to initialize Firebase auth:', error);
// });

export {
  app,
  db,
  auth,
  signInAnonymouslyIfNeeded,
  setupAuthStateListener,
  initializeFirebaseAuth,
};
