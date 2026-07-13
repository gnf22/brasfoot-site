import { useEffect, useState } from 'react';
import { auth, provider, db } from '../firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { checkAndAddUser, UserData } from '../services/userService';
import { doc, onSnapshot } from 'firebase/firestore';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let unsubscribeSnapshot: () => void;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Primeiro garante que o usuário existe no DB
        await checkAndAddUser(currentUser);
        
        // Depois ativa o listener em tempo real para o documento do usuário
        const userRef = doc(db, 'users', currentUser.uid);
        unsubscribeSnapshot = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            setUserData(docSnap.data() as UserData);
          }
        });
      } else {
        setUserData(null);
        if (unsubscribeSnapshot) unsubscribeSnapshot();
      }
      setLoading(false);
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, []);

  const loginWithGoogle = async () => {
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Erro ao logar com Google", error);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Erro ao sair", error);
    }
  };

  // refreshUserData não é mais necessário pois o onSnapshot atualiza instantaneamente
  const refreshUserData = async () => {};

  return { user, userData, loading, loginWithGoogle, logout, refreshUserData };
};
