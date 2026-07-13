import { db } from '../firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';

export interface UserData {
  uid: string;
  name: string;
  email: string;
  photoURL: string;
  teamId: string | null;
}

export const checkAndAddUser = async (user: any): Promise<UserData> => {
  const userRef = doc(db, 'users', user.uid);
  const userDoc = await getDoc(userRef);

  if (!userDoc.exists()) {
    const newUser: UserData = {
      uid: user.uid,
      name: user.displayName || 'Sem Nome',
      email: user.email || '',
      photoURL: user.photoURL || '',
      teamId: null,
    };
    await setDoc(userRef, newUser);
    return newUser;
  }
  
  return userDoc.data() as UserData;
};
