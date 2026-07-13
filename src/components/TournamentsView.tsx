import React, { useEffect, useState, useRef } from 'react';
import { collection, updateDoc, doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../hooks/useAuth';

export interface NationalTeam {
  id: string;
  name: string;
  logoUrl: string;
  confederation: string;
  ownerId: string | null;
  ownerName: string | null;
  ownerPhoto: string | null;
  isActive?: boolean;
}

interface TournamentsViewProps {
  type: 'world_cup' | 'euro_copa';
}

interface TournamentData {
  [groupName: string]: string[]; // Array of NationalTeam IDs
}

const TournamentsView: React.FC<TournamentsViewProps> = ({ type }) => {
  const { user, userData, loading } = useAuth();
  const [nationalTeams, setNationalTeams] = useState<NationalTeam[]>([]);
  const [tournamentData, setTournamentData] = useState<TournamentData>({});
  
  // Admin Management Modal State
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [draggedTeamId, setDraggedTeamId] = useState<string | null>(null);
  const [activeSearchGroup, setActiveSearchGroup] = useState<string | null>(null);
  const [groupSearchTerm, setGroupSearchTerm] = useState('');
  const [focusedSearchResultIndex, setFocusedSearchResultIndex] = useState(0);
  
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const hasUnsavedChangesRef = useRef(false);

  const setUnsaved = (val: boolean) => {
    setHasUnsavedChanges(val);
    hasUnsavedChangesRef.current = val;
  };

  // Global Settings state
  const [transferWindowOpen, setTransferWindowOpen] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [confirmDemitirTeam, setConfirmDemitirTeam] = useState<NationalTeam | null>(null);

  const isAdmin = user?.email === 'gnferreira2000@gmail.com';
  const hasNationalTeam = !!userData?.nationalTeamId;

  // Define Groups based on type
  const worldCupGroups = ['A','B','C','D','E','F','G','H','I','J','K','L']; // 12 groups, 4 each
  const euroGroups = ['A','B','C','D','E','F']; // 6 groups, 4 each
  const copaAmericaGroups = ['A','B']; // 2 groups, 5 each

  useEffect(() => {
    // Fetch Teams
    const teamsRef = collection(db, 'national_teams');
    const unsubTeams = onSnapshot(teamsRef, (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as NationalTeam));
      setNationalTeams(list);
    });

    // Fetch Tournament Data
    const tourneyRef = doc(db, 'tournaments', type);
    const unsubTourney = onSnapshot(tourneyRef, (docSnap) => {
      if (!hasUnsavedChangesRef.current) {
        if (docSnap.exists()) {
          setTournamentData(docSnap.data() as TournamentData);
        } else {
          setTournamentData({});
        }
      }
    });

    // Fetch Transfer Window Settings
    const settingsRef = doc(db, 'settings', 'global');
    const unsubSettings = onSnapshot(settingsRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setTransferWindowOpen(data[`transferWindowOpen_${type}`] ?? true);
      }
    });

    return () => {
      unsubTeams();
      unsubTourney();
      unsubSettings();
    };
  }, [type]);

  // Bulletproof focus restoration
  useEffect(() => {
    if (adminModalOpen && activeSearchGroup) {
      const timer = setTimeout(() => {
        const el = document.getElementById(`group-search-${activeSearchGroup}`);
        if (el) el.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [activeSearchGroup, tournamentData, adminModalOpen]);

  const handleAssumir = async (team: NationalTeam) => {
    if (processing || !userData) return;
    if (team.ownerId) return;
    if (!transferWindowOpen) return;

    setProcessing(true);
    try {
      const teamRef = doc(db, 'national_teams', team.id);
      const userRef = doc(db, 'users', userData.uid);
      await updateDoc(teamRef, {
        ownerId: userData.uid,
        ownerName: userData.name,
        ownerPhoto: userData.photoURL || null
      });
      await updateDoc(userRef, { nationalTeamId: team.id });
    } catch (error) {
      console.error(error);
    }
    setProcessing(false);
  };

  const executeDemitir = async () => {
    if (!userData || !confirmDemitirTeam) return;
    if (!transferWindowOpen) return;

    setProcessing(true);
    try {
      const teamRef = doc(db, 'national_teams', confirmDemitirTeam.id);
      const userRef = doc(db, 'users', userData.uid);
      await updateDoc(teamRef, {
        ownerId: null,
        ownerName: null,
        ownerPhoto: null
      });
      await updateDoc(userRef, { nationalTeamId: null });
      setConfirmDemitirTeam(null);
    } catch (error) {
      console.error(error);
    }
    setProcessing(false);
  };

  const handleForceResign = async (team: NationalTeam) => {
    if (!isAdmin || !team.ownerId) return;
    setProcessing(true);
    try {
      const teamRef = doc(db, 'national_teams', team.id);
      const userRef = doc(db, 'users', team.ownerId);
      await updateDoc(teamRef, { ownerId: null, ownerName: null, ownerPhoto: null });
      await updateDoc(userRef, { nationalTeamId: null });
    } catch (error) {
      console.error(error);
    }
    setProcessing(false);
  };

  // --- Admin Drag & Drop Logic ---
  const saveTournamentData = async (newData: TournamentData) => {
    setProcessing(true);
    try {
      const tourneyRef = doc(db, 'tournaments', type);
      await setDoc(tourneyRef, newData, { merge: true });
      setUnsaved(false);
    } catch (e) {
      console.error(e);
    }
    setProcessing(false);
  };

  const handleDragStart = (e: React.DragEvent, teamId: string) => {
    e.dataTransfer.setData('teamId', teamId);
    setDraggedTeamId(teamId);
  };

  const handleAddToGroup = (teamId: string, groupKey: string, maxTeams: number) => {
    const currentGroupTeams = tournamentData[groupKey] || [];
    if (currentGroupTeams.length >= maxTeams && !currentGroupTeams.includes(teamId)) {
        alert(`O grupo ${groupKey} já está cheio!`);
        return;
    }

    const newData = { ...tournamentData };
    Object.keys(newData).forEach(key => {
      newData[key] = (newData[key] || []).filter(id => id !== teamId);
    });

    newData[groupKey] = [...(newData[groupKey] || []), teamId];
    setTournamentData(newData);
    setUnsaved(true);

    // Auto-focus logic via state update
    const isNowFull = newData[groupKey].length >= maxTeams;
    if (isNowFull) {
      const allGroups: string[] = [];
      if (type === 'world_cup') {
        worldCupGroups.forEach(l => allGroups.push(`WC_${l}`));
      } else {
        euroGroups.forEach(l => allGroups.push(`EURO_${l}`));
        copaAmericaGroups.forEach(l => allGroups.push(`CA_${l}`));
      }
      const currentIndex = allGroups.indexOf(groupKey);
      if (currentIndex !== -1 && currentIndex + 1 < allGroups.length) {
        const nextGroupKey = allGroups[currentIndex + 1];
        setActiveSearchGroup(nextGroupKey);
      } else {
        setActiveSearchGroup(null);
      }
    } else {
      setActiveSearchGroup(groupKey);
    }
  };

  const handleDropToGroup = (e: React.DragEvent, groupKey: string, maxTeams: number) => {
    e.preventDefault();
    const teamId = e.dataTransfer.getData('teamId');
    setDraggedTeamId(null);
    if (!teamId) return;
    handleAddToGroup(teamId, groupKey, maxTeams);
  };

  const handleRemoveFromGroup = (teamId: string) => {
    const newData = { ...tournamentData };
    Object.keys(newData).forEach(key => {
      newData[key] = (newData[key] || []).filter(id => id !== teamId);
    });
    setTournamentData(newData);
    setUnsaved(true);
  };

  // --- Render Helpers ---
  const renderTeamCard = (teamId: string, groupKey?: string) => {
    const team = nationalTeams.find(t => t.id === teamId);
    if (!team) return null;

    const isMyTeam = team.ownerId === userData?.uid;
    const canInteractWithMarket = transferWindowOpen;
    const isAvailable = !team.ownerId && !hasNationalTeam && canInteractWithMarket;
    const isTakenByOther = team.ownerId && !isMyTeam;

    let cardClass = 'team-card tourney-team-card';
    if (isAvailable) cardClass += ' available';
    if (isMyTeam) cardClass += ' my-team';
    if (isTakenByOther) cardClass += ' taken-other';
    if (!team.ownerId && !isAvailable) cardClass += ' unavailable';

    return (
      <div 
        key={team.id} 
        className={cardClass}
        onClick={() => isAvailable && handleAssumir(team)}
      >
        {isAdmin && adminModalOpen && groupKey && (
          <button 
            className="btn-danger btn-small"
            style={{ position: 'absolute', top: -8, right: -8, borderRadius: '50%', width: 24, height: 24, padding: 0 }}
            onClick={(e) => { e.stopPropagation(); handleRemoveFromGroup(team.id); }}
            title="Remover do Grupo"
          >
            x
          </button>
        )}
        <div className="tourney-team-logo-container">
          <img src={team.logoUrl} alt={team.name} className="team-logo" />
        </div>
        <div className="tourney-team-name" style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0, paddingRight: '4px' }}>
          {team.name}
        </div>
        
        <div className="team-status-area" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {!team.ownerId && isAvailable && (
            <button 
              className="btn-secondary" 
              style={{ padding: '4px 10px', fontSize: '0.75rem', borderRadius: '20px' }}
              onClick={(e) => { e.stopPropagation(); handleAssumir(team); }}
            >
              Assumir
            </button>
          )}
          {!team.ownerId && !isAvailable && (
            <div className="lock-icon" title={!transferWindowOpen ? "Mercado Fechado" : "Bloqueado"} style={{ padding: 2 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
            </div>
          )}
          {team.ownerId && isMyTeam && canInteractWithMarket && (
             <button 
               className="btn-danger" 
               style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 8px', fontSize: '0.7rem', borderRadius: '12px' }}
               onClick={(e) => { e.stopPropagation(); setConfirmDemitirTeam(team); }}
               title="Sair da Seleção"
             >
               {team.ownerPhoto && <img src={team.ownerPhoto} referrerPolicy="no-referrer" style={{ width: 14, height: 14, borderRadius: '50%' }} />}
               Sair
             </button>
          )}

          {team.ownerId && (!isMyTeam || !canInteractWithMarket) && (
             <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
               <div className="owner-pill" style={{ padding: '2px 6px' }}>
                 {team.ownerPhoto ? (
                    <img src={team.ownerPhoto} alt={team.ownerName!} referrerPolicy="no-referrer" style={{ width: 16, height: 16 }} />
                 ) : (
                    <div className="default-avatar" style={{ width: 16, height: 16, fontSize: '0.5rem' }}>
                      {team.ownerName?.charAt(0).toUpperCase()}
                    </div>
                 )}
                 <span style={{ fontSize: '0.65rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '70px' }}>
                   {team.ownerName}
                 </span>
               </div>
               
               {isAdmin && (
                 <button 
                   className="btn-danger btn-small" 
                   style={{ padding: '2px 6px', fontSize: '0.6rem', borderRadius: '4px' }}
                   onClick={(e) => { e.stopPropagation(); handleForceResign(team); }}
                   title="Remover Treinador"
                 >
                   X
                 </button>
               )}
             </div>
          )}
        </div>
      </div>
    );
  };

  const renderGroup = (prefix: string, letter: string, maxTeams: number) => {
    const groupKey = `${prefix}_${letter}`;
    const teamsInGroup = tournamentData[groupKey] || [];
    
    const isActiveSearch = activeSearchGroup === groupKey;
    const searchResults = isActiveSearch && groupSearchTerm 
      ? unassignedTeams
          .filter(t => t.name.toLowerCase().includes(groupSearchTerm.toLowerCase()))
          .slice(0, 8)
      : [];

    return (
      <div 
        key={groupKey} 
        className="tourney-group"
        onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }}
        onDragLeave={(e) => { e.currentTarget.classList.remove('drag-over'); }}
        onDrop={(e) => { e.currentTarget.classList.remove('drag-over'); handleDropToGroup(e, groupKey, maxTeams); }}
      >
        <div className="tourney-group-header">Grupo {letter}</div>
        <div className="tourney-group-teams">
          {teamsInGroup.map(tid => renderTeamCard(tid, groupKey))}
          
          {isAdmin && adminModalOpen && teamsInGroup.length < maxTeams && (
             <div className="inline-group-search" style={{ position: 'relative', marginTop: '0.5rem' }}>
               <input 
                 id={`group-search-${groupKey}`}
                 type="text" 
                 placeholder={`Adicionar... (${teamsInGroup.length}/${maxTeams})`}
                 value={isActiveSearch ? groupSearchTerm : ''}
                 onChange={e => {
                   setActiveSearchGroup(groupKey);
                   setGroupSearchTerm(e.target.value);
                   setFocusedSearchResultIndex(0);
                 }}
                 onFocus={() => {
                   setActiveSearchGroup(groupKey);
                   setFocusedSearchResultIndex(0);
                 }}
                 onKeyDown={e => {
                   if (!isActiveSearch || searchResults.length === 0) return;
                   
                   if (e.key === 'ArrowDown' || e.key === 'Tab') {
                     e.preventDefault();
                     setFocusedSearchResultIndex(prev => Math.min(prev + 1, searchResults.length - 1));
                   } else if (e.key === 'ArrowUp') {
                     e.preventDefault();
                     setFocusedSearchResultIndex(prev => Math.max(prev - 1, 0));
                   } else if (e.key === 'Enter') {
                     e.preventDefault();
                     const selected = searchResults[focusedSearchResultIndex];
                     if (selected) {
                       handleAddToGroup(selected.id, groupKey, maxTeams);
                       setGroupSearchTerm('');
                       setFocusedSearchResultIndex(0);
                     }
                   }
                 }}
                 className="tourney-search-input"
                 style={{ padding: '6px', fontSize: '0.8rem' }}
               />
               {isActiveSearch && groupSearchTerm && (
                 <div className="inline-search-results" style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #ddd', borderRadius: '4px', zIndex: 10, maxHeight: '150px', overflowY: 'auto', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                   {searchResults.map((t, idx) => (
                       <div 
                         key={t.id} 
                         style={{ 
                           padding: '6px 8px', 
                           fontSize: '0.8rem', 
                           display: 'flex', 
                           alignItems: 'center', 
                           gap: '6px', 
                           cursor: 'pointer', 
                           borderBottom: '1px solid #eee',
                           backgroundColor: idx === focusedSearchResultIndex ? '#e0e0e0' : 'transparent'
                         }}
                         onMouseDown={(e) => {
                           e.preventDefault(); // Prevents the input from losing focus!
                           handleAddToGroup(t.id, groupKey, maxTeams);
                           setGroupSearchTerm('');
                           setFocusedSearchResultIndex(0);
                         }}
                         onMouseEnter={() => setFocusedSearchResultIndex(idx)}
                       >
                         <img src={t.logoUrl} alt={t.name} style={{ width: 16, height: 16, objectFit: 'contain' }} /> {t.name}
                       </div>
                     ))
                   }
                 </div>
               )}
             </div>
          )}

          {!isAdmin && teamsInGroup.length === 0 && (
             <div className="empty-group-text">Vazio</div>
          )}
        </div>
      </div>
    );
  };

  const renderWorldCup = () => (
    <div className="tournament-section">
      <h2 className="tournament-title">Copa do Mundo</h2>
      <div className="groups-grid world-cup-grid">
        {worldCupGroups.map(letter => renderGroup('WC', letter, 4))}
      </div>
    </div>
  );

  const renderEuroCopaAmerica = () => (
    <div className="tournament-section dual-tournament">
      <div className="euro-section">
        <h2 className="tournament-title">Eurocopa</h2>
        <div className="groups-grid euro-grid">
          {euroGroups.map(letter => renderGroup('EURO', letter, 4))}
        </div>
      </div>
      <div className="copa-america-section">
        <h2 className="tournament-title">Copa América</h2>
        <div className="groups-grid copa-america-grid">
          {copaAmericaGroups.map(letter => renderGroup('CA', letter, 5))}
        </div>
      </div>
    </div>
  );

  // Search filter for unassigned teams
  const unassignedTeams = nationalTeams.filter(t => {
    // Check if team is in ANY group in the current tournament type
    let inGroup = false;
    Object.values(tournamentData).forEach(group => {
      if (group.includes(t.id)) inGroup = true;
    });
    return !inGroup && t.name.toLowerCase().includes(searchTerm.toLowerCase());
  }).sort((a,b) => a.name.localeCompare(b.name));

  return (
    <div className="tournaments-wrapper">
      {isAdmin && (
        <div className="admin-toolbar" style={{ marginBottom: '1.5rem' }}>
          <button className="btn-secondary" onClick={() => setAdminModalOpen(true)}>
            ⚙️ Gerenciar Grupos
          </button>
        </div>
      )}

      {!transferWindowOpen && (
        <div className="transfer-window-banner">
          ⚠️ <strong>Janela Fechada!</strong> Contratações e demissões suspensas.
        </div>
      )}

      {type === 'world_cup' ? renderWorldCup() : renderEuroCopaAmerica()}

      {/* Admin Manager Modal */}
      {isAdmin && adminModalOpen && (
        <div className="modal-overlay" style={{ alignItems: 'flex-start', paddingTop: '2rem' }} onClick={() => setAdminModalOpen(false)}>
          <div className="modal-content large-modal" style={{ width: '95%', maxWidth: '1200px', height: '85vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3>Gerenciar Grupos - {type === 'world_cup' ? 'Copa do Mundo' : 'Euro e Copa América'}</h3>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button 
                  className="btn-danger"
                  onClick={() => setResetModalOpen(true)}
                  style={{ marginRight: '1rem' }}
                >
                  🗑️ Limpar Tudo
                </button>
                {hasUnsavedChanges && (
                  <button 
                    className="btn-primary" 
                    onClick={() => saveTournamentData(tournamentData)}
                    disabled={processing}
                  >
                    {processing ? 'Salvando...' : 'Salvar Alterações'}
                  </button>
                )}
                <button className="btn-secondary" onClick={() => {
                  if (hasUnsavedChanges && !window.confirm('Existem alterações não salvas. Deseja realmente fechar?')) return;
                  setAdminModalOpen(false);
                  setUnsaved(false);
                }}>Fechar</button>
              </div>
            </div>
            
            <div className="admin-tourney-manager">
              <div className="admin-tourney-sidebar">
                <input 
                  type="text" 
                  placeholder="Pesquisar seleção..." 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="tourney-search-input"
                />
                <div className="unassigned-teams-list">
                  {unassignedTeams.map(t => (
                    <div 
                      key={t.id} 
                      className="dnd-item"
                      draggable
                      onDragStart={(e) => handleDragStart(e, t.id)}
                    >
                      <img src={t.logoUrl} alt={t.name} style={{width: 20, height: 20, objectFit: 'contain'}} />
                      <span style={{ fontSize: '0.85rem' }}>{t.name}</span>
                    </div>
                  ))}
                  {unassignedTeams.length === 0 && <p style={{fontSize: '0.8rem', color: '#666', textAlign: 'center'}}>Nenhuma seleção encontrada.</p>}
                </div>
              </div>
              
              <div className="admin-tourney-main">
                {type === 'world_cup' ? renderWorldCup() : renderEuroCopaAmerica()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmar Demissão */}
      {confirmDemitirTeam && (
        <div className="modal-overlay" onClick={() => setConfirmDemitirTeam(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Confirmação</h3>
            <p>Tem certeza que deseja se demitir do comando da seleção <strong>{confirmDemitirTeam.name}</strong>?</p>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setConfirmDemitirTeam(null)} disabled={processing}>
                Não
              </button>
              <button className="btn-danger" onClick={executeDemitir} disabled={processing}>
                Sim, quero sair
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Modal */}
      {resetModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 9999 }} onClick={() => setResetModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 style={{ color: '#e74c3c' }}>Limpar Todos os Grupos</h3>
            <p style={{ marginTop: '1rem', fontSize: '0.9rem' }}>
              Tem certeza que deseja apagar a formação de <strong>todos os grupos</strong> deste torneio?
            </p>
            <p style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>
              Digite <strong>sim</strong> para confirmar:
            </p>
            <input 
              type="text" 
              className="modal-input" 
              value={resetConfirmText}
              onChange={e => setResetConfirmText(e.target.value)}
              placeholder="sim"
            />
            <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
              <button className="btn-secondary" onClick={() => {
                setResetModalOpen(false);
                setResetConfirmText('');
              }}>
                Cancelar
              </button>
              <button 
                className="btn-danger" 
                disabled={resetConfirmText.toLowerCase() !== 'sim'}
                onClick={() => {
                  setTournamentData({});
                  setUnsaved(true);
                  setResetModalOpen(false);
                  setResetConfirmText('');
                }}
              >
                Limpar Grupos
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TournamentsView;
