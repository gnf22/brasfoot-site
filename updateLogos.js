import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, updateDoc, doc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD2fEBnnEK1ibG3WTiYdPn1Ch8J6ZOn2oE",
  authDomain: "futnews-brasfoot.firebaseapp.com",
  projectId: "futnews-brasfoot",
  storageBucket: "futnews-brasfoot.firebasestorage.app",
  messagingSenderId: "682231135360",
  appId: "1:682231135360:web:d3b8a5e741f87d83417a65"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  console.log("Fetching teams...");
  const teamsCol = collection(db, 'teams');
  const snapshot = await getDocs(teamsCol);
  const teams = [];
  snapshot.forEach(d => {
    teams.push({ id: d.id, name: d.data().name, logoUrl: d.data().logoUrl });
  });
  console.log(JSON.stringify(teams, null, 2));
  process.exit(0);
}

run().catch(console.error);
