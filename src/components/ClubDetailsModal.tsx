import React from 'react';
import { calculateGoalXP, formatGoalName } from '../services/seasonService';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

interface Team {
  id: string;
  name: string;
  logoUrl: string;
  color?: string;
  secondaryColor?: string;
  ownerId: string | null;
  ownerName: string | null;
  ownerPhoto: string | null;
  isActive?: boolean;
  division?: 'A' | 'B' | 'NONE';
  clubStatus?: 'Grande' | 'Médio' | 'Pequeno';
  contractYears?: number;
  defaultContractYears?: number;
  contractStartYear?: number;
  goals?: {
    serieA?: string;
    serieB?: string;
    copaBrasil?: string;
    internacional?: string;
  };
  interestedUsers?: string[];
}

interface ClubDetailsModalProps {
  team: Team | null;
  currentYear: number;
  allUsers: any[];
  isAdmin: boolean;
  isMyTeam: boolean;
  isAvailable: boolean;
  hasDeclaredInterest: boolean;
  canInteractWithMarket: boolean;
  onClose: () => void;
  onDeclareInterest?: (team: Team) => void;
  onCancelInterest?: (team: Team) => void;
  onAdminAddInterest?: (team: Team, userId: string) => void;
  onResign?: (team: Team) => void;
  onEdit?: (team: Team) => void;
}

const ClubDetailsModal: React.FC<ClubDetailsModalProps> = ({
  team,
  currentYear,
  allUsers,
  isAdmin,
  isMyTeam,
  isAvailable,
  hasDeclaredInterest,
  canInteractWithMarket,
  onClose,
  onDeclareInterest,
  onCancelInterest,
  onAdminAddInterest,
  onResign,
  onEdit
}) => {
  if (!team) return null;

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'Grande':
        return <span style={{ background: '#3b82f6', color: '#fff', padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold' }}>PORTARIA: GRANDE</span>;
      case 'Médio':
        return <span style={{ background: '#10b981', color: '#fff', padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold' }}>PORTARIA: MÉDIO</span>;
      case 'Pequeno':
        return <span style={{ background: '#64748b', color: '#fff', padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold' }}>PORTARIA: PEQUENO</span>;
      default:
        return <span style={{ background: '#3b82f6', color: '#fff', padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold' }}>PORTARIA: GRANDE</span>;
    }
  };

  const getDivisionBadge = (div?: string) => {
    switch (div) {
      case 'A':
        return <span style={{ background: '#eab308', color: '#000', padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold' }}>SÉRIE A</span>;
      case 'B':
        return <span style={{ background: '#f97316', color: '#fff', padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold' }}>SÉRIE B</span>;
      default:
        return <span style={{ background: '#6b7280', color: '#fff', padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold' }}>NÃO EXIBIDO</span>;
    }
  };

  const startYear = team.contractStartYear || currentYear;
  const years = team.contractYears || 2;
  const yearsLeft = Math.max(0, startYear + years - currentYear);
  const ownerObj = allUsers.find(u => u.id === team.ownerId);
  const xp = ownerObj?.prestige ?? 100;

  const getGoalXP = (comp: string, val: string) => {
    if (!val || val === 'Nenhuma') return '0 pts';
    const res = calculateGoalXP(comp as any, val, team.clubStatus);
    return `${res.xp >= 0 ? '+' : ''}${res.xp} pts`;
  };

  const handleAdjustPrestigeAdmin = async (userId: string, delta: number) => {
    if (!isAdmin || !userId) return;
    const userRef = doc(db, 'users', userId);
    const newPrestige = Math.max(0, Math.min(100, xp + delta));
    await updateDoc(userRef, { prestige: newPrestige });
  };

  const handleAdjustContractAdmin = async (delta: number) => {
    if (!isAdmin || !team) return;
    const currentYears = team.contractYears || 2;
    const newYears = Math.max(1, Math.min(10, currentYears + delta));
    const teamRef = doc(db, 'teams', team.id);
    await updateDoc(teamRef, { contractYears: newYears });
  };

  const isSerieB = team.division === 'B';

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1050 }}>
      <div 
        className="modal-content" 
        onClick={(e) => e.stopPropagation()} 
        style={{ maxWidth: '560px', width: '95%', padding: '1.75rem', borderRadius: '14px', background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}
      >
        {/* Top Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <img src={team.logoUrl} alt={team.name} style={{ width: 64, height: 64, objectFit: 'contain' }} />
            <div>
              <h3 style={{ margin: '0 0 8px 0', color: 'var(--primary-color)', fontSize: '1.4rem' }}>{team.name}</h3>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {getDivisionBadge(team.division)}
                {getStatusBadge(team.clubStatus)}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="btn-secondary" style={{ padding: '6px 12px' }}>✕</button>
        </div>

        {/* Treinador / Contrato Info */}
        <div style={{ background: 'var(--bg-color)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>COMANDO TÉCNICO</span>
            {team.ownerId ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {team.ownerPhoto ? (
                  <img src={team.ownerPhoto} alt={team.ownerName!} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
                ) : (
                  <div className="default-avatar" style={{ width: 36, height: 36 }}>{team.ownerName?.charAt(0).toUpperCase()}</div>
                )}
                <div>
                  <strong style={{ color: 'var(--text-color)', display: 'block', fontSize: '1rem' }}>{team.ownerName}</strong>
                  <span style={{ fontSize: '0.75rem', color: xp < 70 ? 'var(--danger-color)' : 'var(--primary-color)' }}>
                    Prestígio: <strong>{xp}/100</strong>
                    {isAdmin && team.ownerId && (
                      <span style={{ display: 'inline-flex', gap: '4px', marginLeft: '8px' }}>
                        <button
                          style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', padding: '1px 6px', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 'bold' }}
                          onClick={(e) => { e.stopPropagation(); handleAdjustPrestigeAdmin(team.ownerId!, 5); }}
                          title="Adicionar +5 de Prestígio"
                        >
                          +5
                        </button>
                        <button
                          style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', padding: '1px 6px', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 'bold' }}
                          onClick={(e) => { e.stopPropagation(); handleAdjustPrestigeAdmin(team.ownerId!, -5); }}
                          title="Remover -5 de Prestígio"
                        >
                          -5
                        </button>
                      </span>
                    )}
                  </span>
                </div>
              </div>
            ) : (
              <div>
                <strong style={{ color: '#10b981', fontSize: '1.05rem', display: 'block' }}>Livre no Mercado</strong>
                {isAdmin && onAdminAddInterest && (
                  <div style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <select 
                      id={`admin-add-interested-${team.id}`}
                      style={{ padding: '4px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-color)', fontSize: '0.8rem' }}
                    >
                      <option value="">+ Adicionar interesse de...</option>
                      {allUsers.filter(u => !u.teamId && !(team.interestedUsers || []).includes(u.id)).map(u => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                    <button 
                      className="btn-primary" 
                      style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        const select = document.getElementById(`admin-add-interested-${team.id}`) as HTMLSelectElement;
                        if (select && select.value) {
                          onAdminAddInterest(team, select.value);
                          select.value = '';
                        }
                      }}
                    >
                      Adicionar
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>DURAÇÃO DO CONTRATO</span>
            {team.ownerId ? (
              <div>
                <strong style={{ fontSize: '1.1rem', color: yearsLeft === 0 ? 'var(--danger-color)' : 'var(--primary-color)' }}>
                  {yearsLeft === 0 ? 'Expirado' : `${yearsLeft} ${yearsLeft === 1 ? 'Ano restante' : 'Anos restantes'}`}
                </strong>
                {isAdmin && (
                  <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end', marginTop: '4px' }}>
                    <button
                      style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', padding: '2px 8px', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 'bold' }}
                      onClick={(e) => { e.stopPropagation(); handleAdjustContractAdmin(1); }}
                      title="Adicionar +1 Ano ao Contrato"
                    >
                      +1 Ano
                    </button>
                    <button
                      style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', padding: '2px 8px', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 'bold' }}
                      onClick={(e) => { e.stopPropagation(); handleAdjustContractAdmin(-1); }}
                      title="Remover -1 Ano do Contrato"
                    >
                      -1 Ano
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <strong style={{ fontSize: '1.05rem', color: 'var(--text-color)' }}>
                {(() => {
                  const offered = team.defaultContractYears || team.contractYears || 2;
                  return `Oferece ${offered} ${offered === 1 ? 'Ano' : 'Anos'}`;
                })()}
              </strong>
            )}
          </div>
        </div>

        {/* Metas do Clube */}
        <div style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ margin: '0 0 1rem 0', color: 'var(--primary-color)', fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            🎯 Metas Estipuladas para {currentYear}
          </h4>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {/* Campeonato Brasileiro (Exibe Série A ou Série B dependendo do time) */}
            {isSerieB ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-color)', padding: '0.75rem 1rem', borderRadius: '8px', borderLeft: '4px solid #f97316' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>CAMPEONATO BRASILEIRO (SÉRIE B)</span>
                  <strong style={{ color: 'var(--text-color)', fontSize: '1rem' }}>{team.goals?.serieB || 'Subir'}</strong>
                </div>
                <span style={{ background: 'var(--card-bg)', padding: '4px 10px', borderRadius: '6px', fontWeight: 'bold', color: '#f97316', fontSize: '0.85rem' }}>
                  {getGoalXP('serieB', team.goals?.serieB || 'Subir')}
                </span>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-color)', padding: '0.75rem 1rem', borderRadius: '8px', borderLeft: '4px solid #eab308' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>CAMPEONATO BRASILEIRO (SÉRIE A)</span>
                  <strong style={{ color: 'var(--text-color)', fontSize: '1rem' }}>{formatGoalName(team.goals?.serieA || 'Permanecer')}</strong>
                </div>
                <span style={{ background: 'var(--card-bg)', padding: '4px 10px', borderRadius: '6px', fontWeight: 'bold', color: '#eab308', fontSize: '0.85rem' }}>
                  {getGoalXP('serieA', team.goals?.serieA || 'Permanecer')}
                </span>
              </div>
            )}

            {/* Copa do Brasil */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-color)', padding: '0.75rem 1rem', borderRadius: '8px', borderLeft: '4px solid #10b981' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>COPA DO BRASIL</span>
                <strong style={{ color: 'var(--text-color)', fontSize: '1rem' }}>{formatGoalName(team.goals?.copaBrasil || 'Quartas de Final')}</strong>
              </div>
              <span style={{ background: 'var(--card-bg)', padding: '4px 10px', borderRadius: '6px', fontWeight: 'bold', color: '#10b981', fontSize: '0.85rem' }}>
                {getGoalXP('copaBrasil', team.goals?.copaBrasil || 'Quartas de Final')}
              </span>
            </div>

            {/* Competição Internacional */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-color)', padding: '0.75rem 1rem', borderRadius: '8px', borderLeft: '4px solid #3b82f6' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>COMPETIÇÃO INTERNACIONAL</span>
                <strong style={{ color: 'var(--text-color)', fontSize: '1rem' }}>{formatGoalName(team.goals?.internacional || 'Fase de Grupos')}</strong>
              </div>
              <span style={{ background: 'var(--card-bg)', padding: '4px 10px', borderRadius: '6px', fontWeight: 'bold', color: '#3b82f6', fontSize: '0.85rem' }}>
                {getGoalXP('internacional', team.goals?.internacional || 'Fase de Grupos')}
              </span>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '1rem', flexWrap: 'wrap' }}>
          {isAdmin && onEdit && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => { onClose(); onEdit(team); }}
              style={{ marginRight: 'auto' }}
            >
              ✎ Editar Clube
            </button>
          )}

          {!team.ownerId && isAvailable && canInteractWithMarket && onDeclareInterest && (
            <button
              type="button"
              className="btn-primary"
              style={{ background: '#eab308', color: '#000', fontWeight: 'bold' }}
              onClick={() => { onDeclareInterest(team); onClose(); }}
            >
              Declarar Interesse no Cargo
            </button>
          )}

          {!team.ownerId && hasDeclaredInterest && onCancelInterest && (
            <button
              type="button"
              className="btn-secondary"
              style={{ borderColor: '#ef4444', color: '#ef4444' }}
              onClick={() => { onCancelInterest(team); onClose(); }}
            >
              Cancelar Interesse
            </button>
          )}

          {isMyTeam && canInteractWithMarket && onResign && (
            <button
              type="button"
              className="btn-danger"
              onClick={() => { onClose(); onResign(team); }}
            >
              Demitir-se
            </button>
          )}

          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClubDetailsModal;
