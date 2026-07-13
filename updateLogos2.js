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

const logos = {
  "A2aVERPfCGnOKTIBeIsd": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/54/Gr%C3%AAmio_FBPA.svg/256px-Gr%C3%AAmio_FBPA.svg.png", // Grêmio
  "CV1ldAD8VB4HQxxew8ID": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/Club_Athletico_Paranaense_logo.svg/256px-Club_Athletico_Paranaense_logo.svg.png", // Athletico PR
  "EBpEIrJM34kwMuRmn09Q": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/Botafogo_de_Futebol_e_Regatas_logo.svg/256px-Botafogo_de_Futebol_e_Regatas_logo.svg.png", // Botafogo
  "LTtzkNiWvKL1tQZJn81j": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Clube_Atl%C3%A9tico_Mineiro.svg/256px-Clube_Atl%C3%A9tico_Mineiro.svg.png", // Atlético MG
  "QAmYCXahYzLzKkXKaaQI": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/Santos_logo.svg/256px-Santos_logo.svg.png", // Santos
  "ToVW6HlUwnDKQjEd7S1X": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1c/Santa_Cruz_Futebol_Clube_logo.svg/256px-Santa_Cruz_Futebol_Clube_logo.svg.png", // Santa Cruz
  "Vux6tdON0SYarIMz1QoH": "https://upload.wikimedia.org/wikipedia/en/thumb/5/5a/Sport_Club_Corinthians_Paulista_crest.svg/256px-Sport_Club_Corinthians_Paulista_crest.svg.png", // Corinthians
  "hc3JGAra7ZAHJr6cBKks": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/Flamengo_braz_logo.svg/256px-Flamengo_braz_logo.svg.png", // Flamengo
  "iZoAC3arFjIEGYBPYRe1": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Sao_Paulo_Futebol_Clube.svg/256px-Sao_Paulo_Futebol_Clube.svg.png", // São Paulo
  "lbKq2NN1AkaLpJTR9UkD": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/Palmeiras_logo.svg/256px-Palmeiras_logo.svg.png", // Palmeiras
  "roRJid1fSxDgNiGgb7uS": "https://upload.wikimedia.org/wikipedia/pt/thumb/4/41/Sport_Club_do_Recife.svg/256px-Sport_Club_do_Recife.svg.png", // Sport
  "z6PEPDNIv7vzCERAnO08": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/Fluminense_FC_escudo.png/256px-Fluminense_FC_escudo.png" // Fluminense
};

async function run() {
  console.log("Updating team logos...");
  for (const [id, url] of Object.entries(logos)) {
    const teamRef = doc(db, 'teams', id);
    await updateDoc(teamRef, { logoUrl: url });
    console.log(`Updated team ${id}`);
  }
  console.log("Done!");
  process.exit(0);
}

run().catch(console.error);
