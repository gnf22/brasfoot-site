import { initializeApp } from "firebase/app";
import { getFirestore, updateDoc, doc } from "firebase/firestore";

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

const teamsMapping = {
  "A2aVERPfCGnOKTIBeIsd": "Grêmio Foot-Ball Porto Alegrense",
  "CV1ldAD8VB4HQxxew8ID": "Club Athletico Paranaense",
  "EBpEIrJM34kwMuRmn09Q": "Botafogo de Futebol e Regatas",
  "LTtzkNiWvKL1tQZJn81j": "Clube Atlético Mineiro",
  "QAmYCXahYzLzKkXKaaQI": "Santos Futebol Clube",
  "ToVW6HlUwnDKQjEd7S1X": "Santa Cruz Futebol Clube",
  "Vux6tdON0SYarIMz1QoH": "Sport Club Corinthians Paulista",
  "hc3JGAra7ZAHJr6cBKks": "Clube de Regatas do Flamengo",
  "iZoAC3arFjIEGYBPYRe1": "São Paulo Futebol Clube",
  "lbKq2NN1AkaLpJTR9UkD": "Sociedade Esportiva Palmeiras",
  "roRJid1fSxDgNiGgb7uS": "Sport Club do Recife",
  "z6PEPDNIv7vzCERAnO08": "Fluminense Football Club"
};

async function fetchWikiImage(title) {
  const url = `https://pt.wikipedia.org/w/api.php?action=query&prop=pageimages&titles=${encodeURIComponent(title)}&format=json&pithumbsize=256`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "BrasfootFutnewsScript/1.0 (gustavo@example.com) Node.js/24"
    }
  });
  const data = await response.json();
  const pages = data.query.pages;
  const pageId = Object.keys(pages)[0];
  return pages[pageId].thumbnail?.source || null;
}

async function run() {
  console.log("Fetching correct URLs from Wikipedia...");
  for (const [id, title] of Object.entries(teamsMapping)) {
    try {
      const url = await fetchWikiImage(title);
      if (url) {
        console.log(`${title}: ${url}`);
        const teamRef = doc(db, 'teams', id);
        await updateDoc(teamRef, { logoUrl: url });
      } else {
        console.log(`NO IMAGE FOUND FOR: ${title}`);
      }
    } catch (e) {
      console.error(`Error processing ${title}:`, e);
    }
  }
  console.log("Done!");
  process.exit(0);
}

run();
