import { useEffect, useState } from 'react';
import { signInWithPopup, signOut as fbSignOut, onAuthStateChanged } from 'firebase/auth';
import { auth, googleProvider } from '../config/firebase';
import { isAllowedEmail } from '../config/auth';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    return onAuthStateChanged(auth, (fbUser) => {
      if (fbUser && !isAllowedEmail(fbUser.email)) {
        fbSignOut(auth);
        setAuthError(`${fbUser.email} is not authorized.`);
        setUser(null);
      } else {
        setUser(fbUser);
        if (fbUser) setAuthError(null);
      }
      setLoading(false);
    });
  }, []);

  const signIn = async () => {
    setAuthError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (!isAllowedEmail(result.user.email)) {
        await fbSignOut(auth);
        setAuthError(`${result.user.email} is not authorized.`);
      }
    } catch (err) {
      setAuthError(err.message || 'Sign-in failed');
    }
  };

  const signOut = () => fbSignOut(auth);

  return { user, loading, authError, signIn, signOut };
}
