import React, { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { SeasonData, NewsItem, createNewsItem, updateSeasonYear, calculateGoalXP, getRandomFiredNews, formatGoalName, calculateNextSeasonGoals } from '../services/seasonService';
import AlertModal, { AlertMessage } from './AlertModal';

interface Team {
  id: string;
  name: string;
  logoUrl: string;
  ownerId: string | null;
  ownerName: string | null;
  ownerPhoto: string | null;
  contractYears?: number;
  defaultContractYears?: number;
  contractStartYear?: number;
  division?: 'A' | 'B' | 'NONE';
  clubStatus?: 'Grande' | 'Médio' | 'Pequeno';
  goals?: {
    serieA?: string;
    serieB?: string;
    copaBrasil?: string;
    internacional?: string;
  };
}

interface SeasonEndModalProps {
  teams: Team[];
  allUsers: any[];
  season: SeasonData;
  onClose: () => void;
  onSeasonClosed: (report: NewsItem) => void;
}

const SeasonEndModal: React.FC<SeasonEndModalProps> = ({
  teams,
  allUsers,
  season,
  onClose,
  onSeasonClosed
}) => {
  const [processing, setProcessing] = useState(false);
  const [alertMsg, setAlertMsg] = useState<AlertMessage | null>(null);

  const getOptionLabel = (comp: any, val: string, status?: string, goal?: string) => {
    if (val === 'Nenhuma') return '- Nenhuma -';
    const res = calculateGoalXP(comp, val, status, goal);
    const text = formatGoalName(val);
    return `${text} (${res.xp >= 0 ? '+' : ''}${res.xp} pts)`;
  };

  // Initial state for results for occupied teams
  const occupiedTeams = teams.filter(t => t.ownerId);

  const [results, setResults] = useState<Record<string, {
    serieA: string;
    serieB: string;
    copaBrasil: string;
    internacional: string;
  }>>(() => {
    const init: Record<string, any> = {};
    occupiedTeams.forEach(t => {
      init[t.id] = {
        serieA: t.division === 'B' ? 'Nenhuma' : 'Permanecer',
        serieB: t.division === 'B' ? 'Subir' : 'Nenhuma',
        copaBrasil: 'Nenhuma',
        internacional: 'Nenhuma'
      };
    });
    return init;
  });

  const handleResultChange = (teamId: string, comp: 'serieA' | 'serieB' | 'copaBrasil' | 'internacional', value: string) => {
    setResults(prev => ({
      ...prev,
      [teamId]: {
        ...prev[teamId],
        [comp]: value
      }
    }));
  };

  const handleEncerrarTemporada = async () => {
    if (occupiedTeams.length === 0) {
      setAlertMsg({ title: 'Aviso', message: 'Nenhum clube possui treinador no momento.', type: 'warning' });
      return;
    }

    const confirmed = window.confirm(`Deseja realmente encerrar a temporada ${season.currentYear} e calcular o prestígio de todos os técnicos?`);
    if (!confirmed) return;

    setProcessing(true);
    try {
      const summaryLines: string[] = [];
      const firedCoaches: string[] = [];
      const renewedCoaches: string[] = [];
      const highlights: string[] = [];

      const seasonReportList: any[] = [];

      for (const team of occupiedTeams) {
        const teamRes = results[team.id] || { serieA: 'Nenhuma', serieB: 'Nenhuma', copaBrasil: 'Nenhuma', internacional: 'Nenhuma' };
        
        const rA = calculateGoalXP('serieA', teamRes.serieA, team.clubStatus, team.goals?.serieA);
        const rB = calculateGoalXP('serieB', teamRes.serieB, team.clubStatus, team.goals?.serieB);
        const rC = calculateGoalXP('copaBrasil', teamRes.copaBrasil, team.clubStatus, team.goals?.copaBrasil);
        const rI = calculateGoalXP('internacional', teamRes.internacional, team.clubStatus, team.goals?.internacional);

        const totalDelta = rA.xp + rB.xp + rC.xp + rI.xp;

        const ownerObj = allUsers.find(u => u.id === team.ownerId);
        const currentPrestige = Math.min(100, Math.max(0, ownerObj?.prestige ?? 70));
        const newPrestige = Math.min(100, Math.max(0, currentPrestige + totalDelta));

        const userRef = doc(db, 'users', team.ownerId!);
        const teamRef = doc(db, 'teams', team.id);

        let statusDesc = '';
        let statusType: 'permance' | 'demitido' | 'confianca' | 'renovacao' = 'permance';
        let statusText = '';
        const nextSeasonGoals = calculateNextSeasonGoals(team, teamRes);
        const goalsChanged = JSON.stringify(team.goals || {}) !== JSON.stringify(nextSeasonGoals);

        const isAtRisk = newPrestige <= 65 || totalDelta <= -15 || (team.clubStatus === 'Grande' && newPrestige <= 70);
        let riskPercent = 0;

        if (isAtRisk) {
          // Futebol Brasileiro: Cobrança altíssima! Quanto menor o prestígio ou pior a temporada, maior o risco de demissão.
          riskPercent = Math.min(95, Math.max(25, (70 - newPrestige) * 2.2 + 25));
          if (team.clubStatus === 'Grande') riskPercent += 30;
          else if (team.clubStatus === 'Médio') riskPercent += 15;
          else if (team.clubStatus === 'Pequeno') riskPercent -= 5;
          if (totalDelta <= -10) riskPercent += 20;
          if (totalDelta <= -25) riskPercent += 20;
          riskPercent = Math.min(95, Math.max(25, riskPercent));
        }

        const isFired = isAtRisk && (Math.random() * 100 < riskPercent);

        if (isFired) {
          statusType = 'demitido';
          statusText = '🚨 DEMITIDO PELA DIRETORIA';
          firedCoaches.push(`${team.ownerName} (${team.name}) - Prestígio final: ${newPrestige} pts (Pressão: ${Math.round(riskPercent)}%)`);
          statusDesc = `DEMITIDO por baixo prestígio (${newPrestige} pts)`;

          await updateDoc(userRef, {
            teamId: null,
            prestige: newPrestige
          });
          await updateDoc(teamRef, {
            ownerId: null,
            ownerName: null,
            ownerPhoto: null,
            interestedUsers: [],
            goals: nextSeasonGoals
          });

          await createNewsItem(
            getRandomFiredNews(team.ownerName || 'Técnico', team.name, season.currentYear, newPrestige, {
              coachPhotoUrl: team.ownerPhoto || ownerObj?.photoURL || '',
              teamLogoUrl: team.logoUrl || '',
              prestige: newPrestige
            })
          );
        } else {
          const startYear = team.contractStartYear || season.currentYear;
          const years = team.contractYears || 2;
          const yearsLeft = Math.max(0, startYear + years - season.currentYear);

          const teamUpdates: Record<string, any> = { goals: nextSeasonGoals };
          if (!team.contractStartYear) {
            teamUpdates.contractStartYear = season.currentYear;
          }
          await updateDoc(teamRef, teamUpdates);

          if (isAtRisk && !isFired) {
            statusType = 'confianca';
            statusText = '⚠️ VOTO DE CONFIANÇA DA DIRETORIA';
            statusDesc = `Voto de confiança da diretoria (${newPrestige} pts - Risco: ${Math.round(riskPercent)}%)`;
            await updateDoc(userRef, { prestige: newPrestige });
          } else if (yearsLeft <= 1) {
            const offeredYears = team.defaultContractYears || team.contractYears || 2;
            statusType = 'renovacao';
            statusText = `📝 PROPOSTA DE RENOVAÇÃO (${offeredYears} ${offeredYears === 1 ? 'ANO' : 'ANOS'})`;
            renewedCoaches.push(`${team.ownerName} (${team.name})`);
            statusDesc = `Fim de Contrato -> Proposta de Renovação (${offeredYears} ${offeredYears === 1 ? 'Ano' : 'Anos'})`;

            await updateDoc(userRef, {
              prestige: newPrestige,
              pendingRenewal: {
                teamId: team.id,
                teamName: team.name,
                years: offeredYears
              }
            });
          } else {
            statusType = 'permance';
            statusText = '✅ PERMANECE NO CARGO';
            statusDesc = `Permanece no cargo (${newPrestige} pts)`;
            await updateDoc(userRef, { prestige: newPrestige });
          }

          if (totalDelta >= 10) {
            highlights.push(`${team.ownerName} brilhou no comando do ${team.name} (+${totalDelta} pts de Prestígio)!`);
          }
          if (goalsChanged) {
            highlights.push(`📊 Diretoria do ${team.name} reajustou as metas para a próxima temporada com base no desempenho!`);
          }
        }

        const detailsStr = [
          rA.desc && `Série A: ${rA.desc}`,
          rB.desc && `Série B: ${rB.desc}`,
          rC.desc && `Copa do Brasil: ${rC.desc}`,
          rI.desc && `Internacional: ${rI.desc}`
        ].filter(Boolean).join(' • ');

        seasonReportList.push({
          teamId: team.id || null,
          teamName: team.name || 'Clube',
          teamLogoUrl: team.logoUrl || null,
          ownerName: team.ownerName || 'Treinador',
          ownerPhoto: team.ownerPhoto || ownerObj?.photoURL || null,
          previousPrestige: currentPrestige ?? 70,
          newPrestige: newPrestige ?? 70,
          delta: totalDelta ?? 0,
          status: statusType || 'permance',
          statusText: statusText || '',
          details: detailsStr || null,
          riskPercent: isAtRisk ? Math.round(riskPercent) : null
        });

        summaryLines.push(
          `• ${team.ownerName} (${team.name}): ${currentPrestige} pts -> ${newPrestige} pts (${totalDelta >= 0 ? '+' : ''}${totalDelta} pts) [${statusDesc}]`
        );
      }

      const nextYear = season.currentYear + 1;
      await updateSeasonYear(nextYear);

      const articleTitle = `Balanço da Temporada ${season.currentYear}`;
      const articleContent = `A Temporada ${season.currentYear} chegou ao fim! Confira a avaliação oficial de prestígio dos técnicos, o cumprimento das metas estipuladas e as decisões da diretoria de todos os clubes do futebol brasileiro.\n\nClique para ler a matéria completa com os cards de desempenho do Globo Esporte.`;

      const newsId = await createNewsItem({
        title: articleTitle,
        content: articleContent,
        type: 'season_end',
        date: `Temporada ${season.currentYear}`,
        seasonReportList
      });

      const fullReport: NewsItem = {
        id: newsId,
        title: articleTitle,
        content: articleContent,
        type: 'season_end',
        date: `Temporada ${season.currentYear}`,
        seasonReportList
      };

      onSeasonClosed(fullReport);
      onClose();
    } catch (error) {
      console.error('Erro ao encerrar temporada:', error);
      setAlertMsg({ title: 'Erro', message: 'Erro ao encerrar temporada. Verifique o console.', type: 'error' });
    }
    setProcessing(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '850px', width: '95%', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '2px solid #eab308', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.5rem' }}>🏆</span>
            <h3 style={{ margin: 0, color: '#eab308', textTransform: 'uppercase' }}>
              Encerramento da Temporada {season.currentYear}
            </h3>
          </div>
          <button onClick={onClose} className="btn-secondary" style={{ padding: '4px 10px' }}>✕</button>
        </div>

        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
          Informe os resultados obtidos por cada treinador em comparação com as metas estipuladas. O sistema calculará o prestígio ganho ou perdido, testará o risco de demissão para prestígios em 50 pts ou menos e enviará propostas automáticas de renovação.
        </p>

        {occupiedTeams.length === 0 ? (
          <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
            Nenhum clube possui técnico no momento.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {occupiedTeams.map(team => {
              const res = results[team.id] || { serieA: 'Nenhuma', serieB: 'Nenhuma', copaBrasil: 'Nenhuma', internacional: 'Nenhuma' };
              const rA = calculateGoalXP('serieA', res.serieA, team.clubStatus, team.goals?.serieA);
              const rB = calculateGoalXP('serieB', res.serieB, team.clubStatus, team.goals?.serieB);
              const rC = calculateGoalXP('copaBrasil', res.copaBrasil, team.clubStatus, team.goals?.copaBrasil);
              const rI = calculateGoalXP('internacional', res.internacional, team.clubStatus, team.goals?.internacional);
              const totalDelta = rA.xp + rB.xp + rC.xp + rI.xp;

              return (
                <div key={team.id} style={{ background: 'var(--bg-color)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <img src={team.logoUrl} alt={team.name} style={{ width: 32, height: 32, objectFit: 'contain' }} />
                      <div>
                        <strong style={{ color: 'var(--text-color)', fontSize: '1rem' }}>{team.name}</strong>
                        {team.clubStatus && (
                          <span style={{ marginLeft: '8px', fontSize: '0.65rem', background: '#3b82f6', color: '#fff', padding: '2px 6px', borderRadius: '8px', fontWeight: 'bold' }}>
                            {team.clubStatus.toUpperCase()}
                          </span>
                        )}
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Treinador: <strong>{team.ownerName}</strong></div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Variação de Prestígio</div>
                      <strong style={{ fontSize: '1.1rem', color: totalDelta >= 0 ? 'var(--primary-color)' : 'var(--danger-color)' }}>
                        {totalDelta >= 0 ? `+${totalDelta}` : totalDelta} pts
                      </strong>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                    {team.division === 'B' ? (
                      <div>
                        <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>
                          Série B {team.goals?.serieB && team.goals.serieB !== 'Nenhuma' ? `(Meta: ${team.goals.serieB})` : ''}
                        </label>
                        <select
                          value={res.serieB}
                          onChange={(e) => handleResultChange(team.id, 'serieB', e.target.value)}
                          style={{ width: '100%', padding: '6px', fontSize: '0.8rem', borderRadius: '4px', background: 'var(--card-bg)', color: 'var(--text-color)', border: '1px solid var(--border-color)' }}
                        >
                          <option value="Nenhuma">- Nenhuma -</option>
                          <option value="Subir">{getOptionLabel('serieB', 'Subir', team.clubStatus, team.goals?.serieB)}</option>
                          <option value="Campeão">{getOptionLabel('serieB', 'Campeão', team.clubStatus, team.goals?.serieB)}</option>
                          <option value="Não Subir">{getOptionLabel('serieB', 'Não Subir', team.clubStatus, team.goals?.serieB)}</option>
                        </select>
                      </div>
                    ) : (
                      <div>
                        <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>
                          Série A {team.goals?.serieA && team.goals.serieA !== 'Nenhuma' ? `(Meta: ${formatGoalName(team.goals.serieA)})` : ''}
                        </label>
                        <select
                          value={res.serieA}
                          onChange={(e) => handleResultChange(team.id, 'serieA', e.target.value)}
                          style={{ width: '100%', padding: '6px', fontSize: '0.8rem', borderRadius: '4px', background: 'var(--card-bg)', color: 'var(--text-color)', border: '1px solid var(--border-color)' }}
                        >
                          <option value="Nenhuma">- Nenhuma -</option>
                          <option value="Permanecer">{getOptionLabel('serieA', 'Permanecer', team.clubStatus, team.goals?.serieA)}</option>
                          <option value="Quartas de Final">{getOptionLabel('serieA', 'Quartas de Final', team.clubStatus, team.goals?.serieA)}</option>
                          <option value="Semi Final">{getOptionLabel('serieA', 'Semi Final', team.clubStatus, team.goals?.serieA)}</option>
                          <option value="Final">{getOptionLabel('serieA', 'Final', team.clubStatus, team.goals?.serieA)}</option>
                          <option value="Campeão">{getOptionLabel('serieA', 'Campeão', team.clubStatus, team.goals?.serieA)}</option>
                          <option value="Rebaixado">{getOptionLabel('serieA', 'Rebaixado', team.clubStatus, team.goals?.serieA)}</option>
                        </select>
                      </div>
                    )}

                    <div>
                      <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>
                        Copa do Brasil {team.goals?.copaBrasil && team.goals.copaBrasil !== 'Nenhuma' ? `(Meta: ${formatGoalName(team.goals.copaBrasil)})` : ''}
                      </label>
                      <select
                        value={res.copaBrasil}
                        onChange={(e) => handleResultChange(team.id, 'copaBrasil', e.target.value)}
                        style={{ width: '100%', padding: '6px', fontSize: '0.8rem', borderRadius: '4px', background: 'var(--card-bg)', color: 'var(--text-color)', border: '1px solid var(--border-color)' }}
                      >
                        <option value="Nenhuma">- Nenhuma -</option>
                        <option value="Primeira Fase">{getOptionLabel('copaBrasil', 'Primeira Fase', team.clubStatus, team.goals?.copaBrasil)}</option>
                        <option value="Segunda Fase">{getOptionLabel('copaBrasil', 'Segunda Fase', team.clubStatus, team.goals?.copaBrasil)}</option>
                        <option value="Terceira Fase">{getOptionLabel('copaBrasil', 'Terceira Fase', team.clubStatus, team.goals?.copaBrasil)}</option>
                        <option value="Oitavas de Final">{getOptionLabel('copaBrasil', 'Oitavas de Final', team.clubStatus, team.goals?.copaBrasil)}</option>
                        <option value="Quartas de Final">{getOptionLabel('copaBrasil', 'Quartas de Final', team.clubStatus, team.goals?.copaBrasil)}</option>
                        <option value="Semi Final">{getOptionLabel('copaBrasil', 'Semi Final', team.clubStatus, team.goals?.copaBrasil)}</option>
                        <option value="Final">{getOptionLabel('copaBrasil', 'Final', team.clubStatus, team.goals?.copaBrasil)}</option>
                        <option value="Campeão">{getOptionLabel('copaBrasil', 'Campeão', team.clubStatus, team.goals?.copaBrasil)}</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>
                        Internacional {team.goals?.internacional && team.goals.internacional !== 'Nenhuma' ? `(Meta: ${formatGoalName(team.goals.internacional)})` : ''}
                      </label>
                      <select
                        value={res.internacional}
                        onChange={(e) => handleResultChange(team.id, 'internacional', e.target.value)}
                        style={{ width: '100%', padding: '6px', fontSize: '0.8rem', borderRadius: '4px', background: 'var(--card-bg)', color: 'var(--text-color)', border: '1px solid var(--border-color)' }}
                      >
                        <option value="Nenhuma">- Nenhuma -</option>
                        <option value="Pré Libertadores">{getOptionLabel('internacional', 'Pré Libertadores', team.clubStatus, team.goals?.internacional)}</option>
                        <option value="Fase de Grupos">{getOptionLabel('internacional', 'Fase de Grupos', team.clubStatus, team.goals?.internacional)}</option>
                        <option value="Oitavas de Final">{getOptionLabel('internacional', 'Oitavas de Final', team.clubStatus, team.goals?.internacional)}</option>
                        <option value="Quartas de Final">{getOptionLabel('internacional', 'Quartas de Final', team.clubStatus, team.goals?.internacional)}</option>
                        <option value="Semi Final">{getOptionLabel('internacional', 'Semi Final', team.clubStatus, team.goals?.internacional)}</option>
                        <option value="Final">{getOptionLabel('internacional', 'Final', team.clubStatus, team.goals?.internacional)}</option>
                        <option value="Campeão">{getOptionLabel('internacional', 'Campeão', team.clubStatus, team.goals?.internacional)}</option>
                      </select>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="modal-actions" style={{ marginTop: '2rem', justifyContent: 'flex-end', gap: '10px' }}>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={processing}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn-primary"
            style={{ background: '#eab308', color: '#000', fontWeight: 'bold' }}
            onClick={handleEncerrarTemporada}
            disabled={processing || occupiedTeams.length === 0}
          >
            {processing ? 'Calculando e Gerando Globo Esporte...' : 'Encerrar Temporada & Publicar Globo Esporte'}
          </button>
        </div>
      </div>
      <AlertModal alert={alertMsg} onClose={() => setAlertMsg(null)} />
    </div>
  );
};

export default SeasonEndModal;
