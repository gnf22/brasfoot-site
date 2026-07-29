import { db } from '../firebase';
import { doc, getDoc, setDoc, collection, addDoc, serverTimestamp, query, orderBy, limit, onSnapshot } from 'firebase/firestore';

export interface SeasonData {
  currentYear: number;
  status?: 'ongoing' | 'end_of_season';
}

export interface CoachSeasonReport {
  teamId: string;
  teamName: string;
  teamLogoUrl: string;
  ownerName: string;
  ownerPhoto?: string | null;
  previousPrestige: number;
  newPrestige: number;
  delta: number;
  status: 'permance' | 'demitido' | 'confianca' | 'renovacao';
  statusText: string;
  details?: string;
  riskPercent?: number;
}

export interface NewsItem {
  id?: string;
  title: string;
  content: string;
  type: 'transfer' | 'season_end' | 'resignation' | 'renewal';
  date: string;
  imageUrl?: string;
  timestamp?: any;
  seasonReportList?: CoachSeasonReport[];
  coachName?: string;
  coachPhotoUrl?: string;
  teamName?: string;
  teamLogoUrl?: string;
  prestige?: number;
  years?: number;
}

export const getSeasonData = async (): Promise<SeasonData> => {
  const docRef = doc(db, 'settings', 'season');
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) {
    const initialSeason: SeasonData = { currentYear: 2026, status: 'ongoing' };
    await setDoc(docRef, initialSeason);
    return initialSeason;
  }
  return docSnap.data() as SeasonData;
};

export const updateSeasonYear = async (newYear: number): Promise<void> => {
  const docRef = doc(db, 'settings', 'season');
  await setDoc(docRef, { currentYear: newYear, status: 'ongoing' }, { merge: true });
};

const sanitizeFirestoreData = (obj: any): any => {
  if (obj === undefined) return null;
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(sanitizeFirestoreData);
  }
  const clean: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val !== undefined) {
      clean[key] = sanitizeFirestoreData(val);
    } else {
      clean[key] = null;
    }
  }
  return clean;
};

export const createNewsItem = async (news: Omit<NewsItem, 'id' | 'timestamp'>): Promise<string> => {
  const newsRef = collection(db, 'news');
  const cleanNews = sanitizeFirestoreData(news);
  const docRef = await addDoc(newsRef, {
    ...cleanNews,
    timestamp: serverTimestamp(),
  });
  return docRef.id;
};

export const subscribeToNews = (callback: (news: NewsItem[]) => void, maxItems: number = 200) => {
  const newsRef = collection(db, 'news');
  const q = query(newsRef, orderBy('timestamp', 'desc'), limit(maxItems));
  return onSnapshot(q, (snapshot) => {
    const items: NewsItem[] = [];
    snapshot.forEach((docSnap) => {
      items.push({ id: docSnap.id, ...docSnap.data() } as NewsItem);
    });
    callback(items);
  });
};

export const subscribeToSeason = (callback: (season: SeasonData) => void) => {
  const docRef = doc(db, 'settings', 'season');
  return onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      callback(docSnap.data() as SeasonData);
    } else {
      callback({ currentYear: 2026, status: 'ongoing' });
    }
  });
};

// --- Prestige Calculation ---
const getCompetitionRank = (comp: string, val: string): number => {
  if (!val || val === 'Nenhuma' || val === '-') return -1;
  if (comp === 'serieA') {
    const map: Record<string, number> = {
      'Rebaixado': 0,
      'Permanecer': 1,
      'Quartas de Final': 2,
      'Semi Final': 3,
      'Final': 4,
      'Campeão': 5
    };
    return map[val] ?? -1;
  }
  if (comp === 'serieB') {
    const map: Record<string, number> = {
      'Não Subir': 0,
      'Subir': 1,
      'Campeão': 2
    };
    return map[val] ?? -1;
  }
  if (comp === 'copaBrasil') {
    const map: Record<string, number> = {
      'Primeira Fase': 1,
      'Segunda Fase': 2,
      'Terceira Fase': 3,
      'Oitavas': 4,
      'Oitavas de Final': 4,
      'Quartas': 5,
      'Quartas de Final': 5,
      'Semi': 6,
      'Semi Final': 6,
      'Semifinal': 6,
      'Final': 7,
      'Campeão': 8
    };
    return map[val] ?? -1;
  }
  const map: Record<string, number> = {
    'Pré Libertadores': 1,
    'Pré-Libertadores': 1,
    'Fase de Grupos': 2,
    'Oitavas': 3,
    'Oitavas de Final': 3,
    'Quartas': 4,
    'Quartas de Final': 4,
    'Semi': 5,
    'Semi Final': 5,
    'Semifinal': 5,
    'Final': 6,
    'Campeão': 7
  };
  return map[val] ?? -1;
};

export const formatGoalName = (goal?: string): string => {
  if (!goal) return 'Nenhuma';
  const g = goal.trim();
  if (g === 'Oitavas') return 'Oitavas de Final';
  if (g === 'Quartas') return 'Quartas de Final';
  if (g === 'Semi' || g === 'Semifinal') return 'Semi Final';
  return g;
};

// --- Prestige Calculation ---
// Valores RPG de prestígio comparando resultado vs meta estipulada
export const calculateGoalXP = (
  competition: 'serieA' | 'serieB' | 'copaBrasil' | 'internacional',
  result: string,
  clubStatus: string = 'Grande',
  goal?: string
): { xp: number; desc: string } => {
  if (!result || result === 'Nenhuma' || result === '-') return { xp: 0, desc: '' };

  const resRank = getCompetitionRank(competition, result);
  const goalRank = goal && goal !== 'Nenhuma' && goal !== '-' ? getCompetitionRank(competition, goal) : -1;

  let xp = 0;
  let desc = '';

  const getRankBaseXP = (rank: number): number => {
    const map: Record<number, number> = {
      1: 1,
      2: 1,
      3: 1,
      4: 2,
      5: 2,
      6: 3,
      7: 3,
      8: 5
    };
    return map[rank] ?? 2;
  };

  if (resRank === 0) {
    // Rebaixado / Não Subir (Catástrofe no futebol brasileiro!)
    xp = competition === 'serieA' ? -35 : -15;
    desc = `${result} (${xp} pts)`;
  } else if (goalRank > 0) {
    // Temos meta definida: comparar Result com Meta!
    if (resRank < goalRank) {
      // Ficou ABAIXO DA META: no Brasil a cobrança é implacável!
      const diff = goalRank - resRank;
      xp = diff === 1 ? -10 : diff === 2 ? -20 : diff === 3 ? -30 : diff === 4 ? -40 : -50;
      desc = `${result} • Abaixo da meta (${xp} pts)`;
    } else if (resRank === goalRank) {
      // META ATINGIDA (obrigação do cargo, ganho modesto para não inflacionar)
      xp = getRankBaseXP(resRank);
      desc = `${result} • Meta atingida (+${xp} pts)`;
    } else {
      // SUPEROU A META!
      const base = getRankBaseXP(goalRank);
      const diff = resRank - goalRank;
      xp = Math.min(15, base + diff * 3);
      desc = `${result} • Superou meta (+${xp} pts)`;
    }
  } else {
    // Sem meta explícita (ganho modesto)
    xp = getRankBaseXP(resRank);
    desc = `${result} (+${xp} pts)`;
  }

  // Multiplicador de Porte do Clube (clube Grande pune muito mais em fracassos)
  if (clubStatus === 'Grande' && xp < 0) {
    xp = Math.round(xp * 1.3);
    desc = desc.replace(/\(-\d+ pts\)/, `(${xp} pts • Pressão Clube Grande)`);
  }

  // Multiplicador de Porte do Clube
  if (clubStatus === 'Pequeno') {
    if (xp > 0) {
      xp = Math.round(xp * 1.5);
      desc = desc.replace(/\(\+\d+ pts\)/, `(+${xp} pts • Pequeno)`);
    } else if (xp < 0) {
      xp = Math.round(xp * 0.5);
      desc = desc.replace(/\(-\d+ pts\)/, `(${xp} pts • Pequeno)`);
    }
  } else if (clubStatus === 'Médio') {
    if (xp > 0) {
      xp = Math.round(xp * 1.25);
      desc = desc.replace(/\(\+\d+ pts\)/, `(+${xp} pts • Médio)`);
    } else if (xp < 0) {
      xp = Math.round(xp * 0.75);
      desc = desc.replace(/\(-\d+ pts\)/, `(${xp} pts • Médio)`);
    }
  }

  return { xp, desc };
};

// --- Dynamic News Generators (5 Variations Each) ---
export const getRandomTransferNews = (
  coachName: string,
  teamName: string,
  year: number,
  meta?: { coachPhotoUrl?: string; teamLogoUrl?: string; prestige?: number; years?: number }
): NewsItem => {
  const variations = [
    {
      title: `OFICIAL: ${coachName} assume o comando técnico do ${teamName}!`,
      content: `A diretoria do ${teamName} acertou a contratação de ${coachName} para a temporada ${year}. A expectativa dos torcedores está altíssima para o início dos trabalhos!`
    },
    {
      title: `BEM-VINDO! ${teamName} anuncia ${coachName} como novo treinador!`,
      content: `O departamento de futebol do ${teamName} oficializou a chegada de ${coachName}. O contrato é válido para a temporada ${year}.`
    },
    {
      title: `MERCADO DA BOLA: ${coachName} assina com o ${teamName}!`,
      content: `Fim da novela! ${coachName} foi apresentado no ${teamName} e já comanda o primeiro treino rumo às disputas de ${year}.`
    },
    {
      title: `NOVO PROFESSOR! ${teamName} confirma contratação de ${coachName}!`,
      content: `Com metas ambiciosas para ${year}, a diretoria do ${teamName} apostou no perfil de ${coachName} para liderar o elenco.`
    },
    {
      title: `FECHADO! ${coachName} é o novo comandante técnico do ${teamName}!`,
      content: `O acordo entre ${coachName} e ${teamName} foi sacramentado hoje. O treinador prometeu empenho total na temporada ${year}.`
    },
    {
      title: `EM BOA HORA! ${teamName} acerta com ${coachName} para grande temporada!`,
      content: `A torcida do ${teamName} já tem motivos para comemorar. A diretoria confirmou a assinatura de contrato com o técnico ${coachName} para os desafios de ${year}.`
    },
    {
      title: `REFORÇO NA COMISSÃO! ${coachName} é apresentado pelo ${teamName}!`,
      content: `O departamento de futebol profissional do ${teamName} apresentou hoje o técnico ${coachName}. O treinador iniciou o planejamento do elenco para ${year}.`
    },
    {
      title: `PRANCHETA NOVA! ${teamName} aposta em ${coachName} para ${year}!`,
      content: `Com discurso otimista e projeto ambicioso, o ${teamName} revelou que ${coachName} será o grande responsável por comandar o time nesta temporada.`
    }
  ];
  const choice = variations[Math.floor(Math.random() * variations.length)];
  return {
    ...choice,
    type: 'transfer',
    date: `Temporada ${year}`,
    coachName,
    teamName,
    coachPhotoUrl: meta?.coachPhotoUrl,
    teamLogoUrl: meta?.teamLogoUrl,
    prestige: meta?.prestige,
    years: meta?.years
  };
};

export const getRandomDisputeWinnerNews = (
  winnerName: string,
  teamName: string,
  loserNames: string[],
  year: number,
  meta?: { coachPhotoUrl?: string; teamLogoUrl?: string; prestige?: number; years?: number }
): NewsItem => {
  const formatLosers = (names: string[]): string => {
    if (!names || names.length === 0) return 'outros concorrentes';
    if (names.length === 1) return names[0];
    if (names.length === 2) return `${names[0]} e ${names[1]}`;
    return `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`;
  };

  const formattedLosers = formatLosers(loserNames);

  const variations = [
    {
      title: `MARTELO BATIDO! ${teamName} opta por ${winnerName} e supera concorrência de peso!`,
      content: `A diretoria do ${teamName} colocou fim à novela nos bastidores e oficializou a contratação do técnico ${winnerName} para a temporada ${year}. O clube optou pelo treinador em detrimento de ${formattedLosers}, que também estavam no páreo pelo comando da equipe.`
    },
    {
      title: `ESCOLHIDO! ${winnerName} desbanca concorrentes e assume o ${teamName}!`,
      content: `Após minuciosa avaliação de projetos esportivos, o ${teamName} definiu seu novo comandante para ${year}: ${winnerName}. A preferência da diretoria pelo treinador acabou preterindo nomes que disputavam fortemente a vaga, como ${formattedLosers}.`
    },
    {
      title: `FIM DO MISTÉRIO! ${teamName} prefere ${winnerName} no comando técnico!`,
      content: `A concorrência pela prancheta do ${teamName} chegou ao fim. Em nota oficial, o clube confirmou que optou por assinar com ${winnerName}. Com a decisão da diretoria, ${formattedLosers} ficam fora dos planos da equipe para a temporada ${year}.`
    },
    {
      title: `DEFINIDO! ${teamName} escolhe ${winnerName} em disputa acirrada de bastidores!`,
      content: `O mercado da bola pegou fogo nas últimas horas. Entre vários candidatos interessados no cargo, o ${teamName} oficializou a escolha do técnico ${winnerName} para ${year}, superando a concorrência direta de ${formattedLosers}.`
    },
    {
      title: `ACORDO FECHADO! ${winnerName} ganha braço de ferro e é o novo treinador do ${teamName}!`,
      content: `A cúpula diretiva do ${teamName} bateu o martelo e selecionou ${winnerName} para liderar o elenco na temporada ${year}. A preferência pelo comandante foi decisiva para superar o interesse manifestado por ${formattedLosers}.`
    },
    {
      title: `OFICIAL: ${teamName} anuncia ${winnerName} e encerra concorrência pela prancheta!`,
      content: `O ${teamName} tem novo treinador: trata-se de ${winnerName}. A contratação marca o desfecho de uma busca concorrida em ${year}, na qual a diretoria optou pelo perfil de ${winnerName} em vez de ${formattedLosers}.`
    },
    {
      title: `PREFERÊNCIA DO CLUBE! ${winnerName} assina com o ${teamName} após superar rivais!`,
      content: `A diretoria de futebol do ${teamName} oficializou o vínculo com ${winnerName} para a temporada ${year}. Nos bastidores, a chegada do treinador concretiza a escolha do clube sobre ${formattedLosers}, que também ambicionavam o cargo.`
    }
  ];
  const choice = variations[Math.floor(Math.random() * variations.length)];
  return {
    ...choice,
    type: 'transfer',
    date: `Temporada ${year}`,
    coachName: winnerName,
    teamName,
    coachPhotoUrl: meta?.coachPhotoUrl,
    teamLogoUrl: meta?.teamLogoUrl,
    prestige: meta?.prestige,
    years: meta?.years
  };
};

export const getRandomResignationNews = (
  coachName: string,
  teamName: string,
  year: number,
  meta?: { coachPhotoUrl?: string; teamLogoUrl?: string; prestige?: number; years?: number }
): NewsItem => {
  const variations = [
    {
      title: `BAIXA NO BANCO! ${coachName} entrega o cargo no ${teamName}!`,
      content: `O treinador ${coachName} comunicou à diretoria do ${teamName} que não seguirá no comando para a temporada ${year}.`
    },
    {
      title: `FIM DE CICLO: ${coachName} não é mais técnico do ${teamName}!`,
      content: `Em comum acordo, ${coachName} e ${teamName} decidiram encerrar o vínculo profissional ao término da temporada ${year}.`
    },
    {
      title: `CADEIRA VAGA NO ${teamName.toUpperCase()}! ${coachName} pede demissão!`,
      content: `As partes seguirão caminhos distintos na temporada ${year}. ${coachName} agradeceu aos torcedores e deixou o comando técnico do ${teamName}.`
    },
    {
      title: `REVIRAVOLTA! ${coachName} deixa o ${teamName} inesperadamente!`,
      content: `Sem aviso prévio, ${coachName} optou por interromper seu projeto esportivo com o ${teamName}. A diretoria já abriu processo seletivo para um substituto.`
    },
    {
      title: `ADEUS, PROFESSOR! ${coachName} se despede do ${teamName}!`,
      content: `Após intensas especulações, confirmou-se a saída de ${coachName} do ${teamName}. O técnico segue para novos desafios profissionais na temporada ${year}.`
    }
  ];
  const choice = variations[Math.floor(Math.random() * variations.length)];
  return {
    ...choice,
    type: 'resignation',
    date: `Temporada ${year}`,
    coachName,
    teamName,
    coachPhotoUrl: meta?.coachPhotoUrl,
    teamLogoUrl: meta?.teamLogoUrl,
    prestige: meta?.prestige,
    years: meta?.years
  };
};

export const getRandomFiredNews = (
  coachName: string,
  teamName: string,
  year: number,
  xp: number,
  meta?: { coachPhotoUrl?: string; teamLogoUrl?: string; prestige?: number; years?: number }
): NewsItem => {
  const variations = [
    {
      title: `CAIU! Diretoria do ${teamName} demite ${coachName} após campanha fraca!`,
      content: `Não deu mais! Com o prestígio em queda livre (${xp} pts), a diretoria optou pela demissão de ${coachName} ao final de ${year}.`
    },
    {
      title: `FACÃO NO ${teamName.toUpperCase()}! ${coachName} é desligado do cargo!`,
      content: `A paciência da torcida e da diretoria chegou ao fim. Com apenas ${xp} pts de prestígio, ${coachName} foi demitido logo após o término da temporada ${year}.`
    },
    {
      title: `DECISÃO DA DIRETORIA: ${coachName} é dispensado do ${teamName}!`,
      content: `O insucesso no cumprimento das metas pesou bastante. ${coachName} deixa o comando do ${teamName} com ${xp} pts no ranking geral.`
    },
    {
      title: `FIM DA LINHA! ${coachName} cai do comando do ${teamName}!`,
      content: `Em nota oficial, o ${teamName} agradeceu os serviços mas confirmou a saída de ${coachName}. O baixo desempenho em ${year} resultou em sua demissão.`
    },
    {
      title: `DEMITIDO! ${coachName} não resiste à pressão no ${teamName}!`,
      content: `O conselho deliberativo bateu o martelo. A queda de prestígio para ${xp} pts inviabilizou a continuidade de ${coachName} para a próxima temporada.`
    },
    {
      title: `MUDANÇA RUMOS! ${teamName} desliga ${coachName} do comando!`,
      content: `Insatisfeita com os resultados apresentados em ${year}, a cúpula do ${teamName} optou pela demissão do treinador, que encerrou o ano com ${xp} pts de prestígio.`
    },
    {
      title: `CRISE E QUEDA! ${coachName} tem contrato rescindido pelo ${teamName}!`,
      content: `O ambiente pesado e os tropeços em ${year} custaram o cargo de ${coachName}. O clube emitiu nota comunicando a dispensa do comandante.`
    },
    {
      title: `NÃO FICARÁ! ${teamName} opta por demitir ${coachName} ao fim da temporada!`,
      content: `A reformulação no ${teamName} começou pela comissão técnica. Com desempenho aquém das metas e ${xp} pts de prestígio, ${coachName} deixa o clube.`
    }
  ];
  const choice = variations[Math.floor(Math.random() * variations.length)];
  return {
    ...choice,
    type: 'resignation',
    date: `Temporada ${year}`,
    coachName,
    teamName,
    coachPhotoUrl: meta?.coachPhotoUrl,
    teamLogoUrl: meta?.teamLogoUrl,
    prestige: xp,
    years: meta?.years
  };
};

export const getAdminExpulsionNews = (
  coachName: string,
  teamName: string,
  year: number,
  meta?: { coachPhotoUrl?: string; teamLogoUrl?: string; prestige?: number; years?: number }
): NewsItem => {
  const variations = [
    {
      title: `INTERVENÇÃO DA CGF! ${coachName} é destituído do comando do ${teamName}!`,
      content: `A Confederação Gustavo de Futebol (CGF) publicou em boletim oficial o desligamento imediato de ${coachName} do cargo de treinador do ${teamName} na temporada ${year}. O clube passa a buscar um novo comandante no mercado da bola.`
    },
    {
      title: `DECISÃO OFICIAL CGF: ${coachName} é demitido do ${teamName}!`,
      content: `Por determinação da CGF (Confederação Gustavo de Futebol), o vínculo profissional de ${coachName} com o ${teamName} foi formalmente rescindido no sistema da liga na temporada ${year}.`
    },
    {
      title: `DEMISSÃO PELA CGF! ${coachName} não é mais treinador do ${teamName}!`,
      content: `Em nota oficial da Confederação Gustavo de Futebol (CGF), ${coachName} teve seu contrato com o ${teamName} encerrado administrativamente na temporada ${year}. O cargo de técnico da equipe está vago.`
    },
    {
      title: `CANETADA DA CGF! ${coachName} é expulso do comando do ${teamName}!`,
      content: `A presidência e comissão administrativa da CGF (Confederação Gustavo de Futebol) decretou o desligamento oficial de ${coachName} do ${teamName}. A diretoria do clube aguarda definições para anunciar seu novo treinador.`
    },
    {
      title: `DECRETO DA PRESIDÊNCIA! CGF desliga ${coachName} do ${teamName}!`,
      content: `Em medida administrativa de impacto, a Confederação Gustavo de Futebol (CGF) cassou o vínculo do técnico ${coachName} à frente do ${teamName} na temporada ${year}.`
    },
    {
      title: `FORA DO CLUBE! CGF determina saída imediata de ${coachName} no ${teamName}!`,
      content: `O boletim extraordinário publicado pela CGF informou que ${coachName} não responde mais pela comissão técnica do ${teamName} em ${year}.`
    },
    {
      title: `ATRAVÉS DE RESOLUÇÃO, CGF destitui ${coachName} do comando do ${teamName}!`,
      content: `Por ato executivo da Confederação Gustavo de Futebol, a passagem de ${coachName} pelo ${teamName} foi encerrada oficialmente.`
    }
  ];
  const choice = variations[Math.floor(Math.random() * variations.length)];
  return {
    ...choice,
    type: 'resignation',
    date: `Temporada ${year}`,
    coachName,
    teamName,
    coachPhotoUrl: meta?.coachPhotoUrl,
    teamLogoUrl: meta?.teamLogoUrl,
    prestige: meta?.prestige,
    years: meta?.years
  };
};

export const getRandomRenewalNews = (
  coachName: string,
  teamName: string,
  year: number,
  years: number,
  meta?: { coachPhotoUrl?: string; teamLogoUrl?: string; prestige?: number }
): NewsItem => {
  const variations = [
    {
      title: `RENOVAÇÃO DEFINIDA: ${coachName} assina por mais ${years} ${years === 1 ? 'ano' : 'anos'} com o ${teamName}!`,
      content: `Após excelente trabalho na temporada, diretoria e treinador fecharam novo vínculo. ${coachName} permanece no ${teamName} até ${year + years}!`
    },
    {
      title: `FICA! ${coachName} renova contrato com o ${teamName}!`,
      content: `Recompensado pelas metas alcançadas, ${coachName} estendeu seu contrato por mais ${years} ${years === 1 ? 'ano' : 'anos'} à frente da equipe técnica do ${teamName}.`
    },
    {
      title: `TUDO CERTO! ${teamName} e ${coachName} assinam renovação de contrato!`,
      content: `A torcida pediu e aconteceu! ${coachName} liderará o projeto do ${teamName} pelas próximas ${years} temporadas após ótimo prestígio em ${year}.`
    },
    {
      title: `CONTINUIDADE NO TRABALHO: ${coachName} segue no ${teamName}!`,
      content: `Em coletiva de imprensa, o ${teamName} oficializou a renovação por ${years} ${years === 1 ? 'ano' : 'anos'} com o professor ${coachName}.`
    },
    {
      title: `ACORDO PRORROGADO! ${coachName} fica no comando do ${teamName}!`,
      content: `A diretoria não poupou elogios ao trabalho de ${coachName} na temporada ${year}. O novo contrato é válido até ${year + years}!`
    },
    {
      title: `MAIS TEMPO DE CASA! ${coachName} assina renovação no ${teamName}!`,
      content: `O trabalho que vem sendo desenvolvido por ${coachName} convenceu a diretoria. O treinador assinou por mais ${years} ${years === 1 ? 'ano' : 'anos'}.`
    },
    {
      title: `PLANEJAMENTO DE LONGO PRAZO! ${teamName} estende vínculo de ${coachName}!`,
      content: `Com confiança mútua, ${coachName} e a diretoria do ${teamName} firmaram acordo de renovação por mais ${years} ${years === 1 ? 'temporada' : 'temporadas'}.`
    },
    {
      title: `FICA NO CLUBE! ${coachName} acerta permanência e renova com o ${teamName}!`,
      content: `Fim dos rumores: ${coachName} não sai do ${teamName}! O clube confirmou a ampliação do contrato até ${year + years}.`
    }
  ];
  const choice = variations[Math.floor(Math.random() * variations.length)];
  return {
    ...choice,
    type: 'renewal',
    date: `Temporada ${year}`,
    coachName,
    teamName,
    coachPhotoUrl: meta?.coachPhotoUrl,
    teamLogoUrl: meta?.teamLogoUrl,
    prestige: meta?.prestige,
    years
  };
};

export const calculateNextSeasonGoals = (
  team: { division?: 'A' | 'B' | 'NONE'; clubStatus?: string; goals?: { serieA?: string; serieB?: string; copaBrasil?: string; internacional?: string } },
  results: { serieA?: string; serieB?: string; copaBrasil?: string; internacional?: string }
) => {
  const status = team.clubStatus || 'Grande';
  const currentGoals = team.goals || {};

  const adjustGoal = (
    currentGoal: string | undefined,
    result: string | undefined,
    competition: 'serieA' | 'serieB' | 'copaBrasil' | 'internacional',
    ladder: string[],
    minIdx: number
  ): string => {
    if (!result || result === 'Nenhuma' || result === '-') return currentGoal || ladder[minIdx];
    const currIdx = Math.max(minIdx, ladder.indexOf(currentGoal || ladder[minIdx]));
    const resRank = getCompetitionRank(competition, result);
    const goalRank = currentGoal ? getCompetitionRank(competition, currentGoal) : ladder.indexOf(ladder[minIdx]);

    if (resRank > goalRank) {
      // Superou a meta: aumenta a exigência para a próxima temporada (+1 degrau)
      return ladder[Math.min(ladder.length - 1, currIdx + 1)];
    } else if (resRank < goalRank && resRank > 0) {
      // Ficou abaixo da meta: reduz a exigência para a próxima temporada (-1 degrau, sem descer do mínimo do porte do clube)
      return ladder[Math.max(minIdx, currIdx - 1)];
    }
    return ladder[currIdx];
  };

  const serieALadder = ['Permanecer', 'Quartas de Final', 'Semi Final', 'Final', 'Campeão'];
  const minSerieA = status === 'Grande' ? 1 : 0;

  const copaBrasilLadder = [
    'Primeira Fase',
    'Segunda Fase',
    'Terceira Fase',
    'Oitavas de Final',
    'Quartas de Final',
    'Semi Final',
    'Final',
    'Campeão'
  ];
  const minCopa = status === 'Grande' ? 3 : status === 'Médio' ? 1 : 0;

  const interLadder = [
    'Pré Libertadores',
    'Fase de Grupos',
    'Oitavas de Final',
    'Quartas de Final',
    'Semi Final',
    'Final',
    'Campeão'
  ];
  const minInter = status === 'Grande' ? 1 : 0;

  return {
    serieA: team.division === 'B' ? 'Nenhuma' : adjustGoal(currentGoals.serieA, results.serieA, 'serieA', serieALadder, minSerieA),
    serieB: team.division === 'B' ? (results.serieB === 'Campeão' ? 'Campeão' : 'Subir') : 'Nenhuma',
    copaBrasil: adjustGoal(currentGoals.copaBrasil, results.copaBrasil, 'copaBrasil', copaBrasilLadder, minCopa),
    internacional: adjustGoal(currentGoals.internacional, results.internacional, 'internacional', interLadder, minInter)
  };
};
