// src/services/cacheService.ts
import { collection, doc, onSnapshot, Unsubscribe, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';

type Listener<T> = (data: T) => void;

class SubscriptionCache<T> {
  private listeners: Set<Listener<T>> = new Set();
  private cachedData: T | null = null;
  private unsubscribe: Unsubscribe | null = null;
  private startSubscription: (onUpdate: (data: T) => void) => Unsubscribe;
  private disconnectTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(startSubscription: (onUpdate: (data: T) => void) => Unsubscribe) {
    this.startSubscription = startSubscription;
  }

  public subscribe(listener: Listener<T>): () => void {
    if (this.disconnectTimeout) {
      clearTimeout(this.disconnectTimeout);
      this.disconnectTimeout = null;
    }

    if (this.cachedData !== null) {
      listener(this.cachedData);
    }
    this.listeners.add(listener);

    if (!this.unsubscribe) {
      this.unsubscribe = this.startSubscription((data) => {
        this.cachedData = data;
        this.listeners.forEach((l) => l(data));
      });
    }

    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) {
        this.disconnectTimeout = setTimeout(() => {
          if (this.listeners.size === 0 && this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
          }
        }, 30000); // 30 segundos de retenção no cache sem conexões ativas
      }
    };
  }

  public getCached(): T | null {
    return this.cachedData;
  }
}

// 1. Teams Cache (collection 'teams')
export const teamsCache = new SubscriptionCache<any[]>((onUpdate) => {
  return onSnapshot(collection(db, 'teams'), (snapshot) => {
    const list = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    list.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
    onUpdate(list);
  });
});

// 2. National Teams Cache (collection 'national_teams')
export const nationalTeamsCache = new SubscriptionCache<any[]>((onUpdate) => {
  return onSnapshot(collection(db, 'national_teams'), (snapshot) => {
    const list = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    list.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
    onUpdate(list);
  });
});

// 3. Users Cache (collection 'users')
export const usersCache = new SubscriptionCache<any[]>((onUpdate) => {
  return onSnapshot(collection(db, 'users'), (snapshot) => {
    const list = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    onUpdate(list);
  });
});

// 4. Global Settings Cache (doc 'settings/global')
export const globalSettingsCache = new SubscriptionCache<any>((onUpdate) => {
  return onSnapshot(doc(db, 'settings', 'global'), (docSnap) => {
    if (docSnap.exists()) {
      onUpdate(docSnap.data());
    } else {
      onUpdate({});
    }
  });
});

// 5. Tournaments Cache (doc 'tournaments/current')
export const tournamentsCache = new SubscriptionCache<any>((onUpdate) => {
  return onSnapshot(doc(db, 'tournaments', 'current'), (docSnap) => {
    if (docSnap.exists()) {
      onUpdate(docSnap.data());
    } else {
      onUpdate(null);
    }
  });
});

// 6. Season Cache (doc 'settings/season')
export const seasonCache = new SubscriptionCache<any>((onUpdate) => {
  return onSnapshot(doc(db, 'settings', 'season'), (docSnap) => {
    if (docSnap.exists()) {
      onUpdate(docSnap.data());
    } else {
      onUpdate({ currentYear: 2026, status: 'ongoing' });
    }
  });
});

// 7. News Cache (collection 'news')
export const newsCache = new SubscriptionCache<any[]>((onUpdate) => {
  const q = query(collection(db, 'news'), orderBy('timestamp', 'desc'), limit(200));
  return onSnapshot(q, (snapshot) => {
    const list = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    onUpdate(list);
  });
});
