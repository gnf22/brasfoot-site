import { db } from '../firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';

export interface UserData {
  uid: string;
  name: string;
  email: string;
  photoURL: string;
  teamId: string | null;
  nationalTeamId?: string | null;
  declaredInterestTeamId?: string | null;
  prestige?: number;
  pendingRenewal?: {
    teamId: string;
    teamName: string;
    years: number;
  } | null;
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
      prestige: 100,
    };
    await setDoc(userRef, newUser);
    return newUser;
  }
  
  const data = userDoc.data() as UserData;
  if (data.prestige === undefined) {
    data.prestige = 100;
  }
  return data;
};
