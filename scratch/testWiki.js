import https from 'https';

function fetchWikiImage(title) {
  return new Promise((resolve, reject) => {
    const url = `https://pt.wikipedia.org/w/api.php?action=query&prop=pageimages&titles=${encodeURIComponent(title)}&format=json&pithumbsize=256`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const pages = json.query.pages;
          const pageId = Object.keys(pages)[0];
          if (pages[pageId].thumbnail) {
            resolve(pages[pageId].thumbnail.source);
          } else {
            resolve(null);
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

const teams = [
  "Grêmio Foot-Ball Porto Alegrense",
  "Club Athletico Paranaense",
  "Botafogo de Futebol e Regatas",
  "Clube Atlético Mineiro",
  "Santos Futebol Clube",
  "Santa Cruz Futebol Clube",
  "Sport Club Corinthians Paulista",
  "Clube de Regatas do Flamengo",
  "São Paulo Futebol Clube",
  "Sociedade Esportiva Palmeiras",
  "Sport Club do Recife",
  "Fluminense Football Club"
];

async function run() {
  for (const team of teams) {
    const url = await fetchWikiImage(team);
    console.log(`${team}: ${url}`);
  }
}

run();
