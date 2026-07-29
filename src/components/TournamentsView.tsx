import React, { useEffect, useState, useRef } from 'react';
import { updateDoc, doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../hooks/useAuth';
import AlertModal, { AlertMessage } from './AlertModal';
import { nationalTeamsCache, usersCache, globalSettingsCache } from '../services/cacheService';

export interface NationalTeam {
  id: string;
  name: string;
  logoUrl: string;
  confederation: string;
  ownerId: string | null;
  ownerName: string | null;
  ownerPhoto: string | null;
  color?: string;
  secondaryColor?: string;
  isActive?: boolean;
  interestedUsers?: string[];
}

interface TournamentsViewProps {
  type: 'world_cup' | 'euro_copa';
}

interface TournamentData {
  [groupName: string]: string[]; // Array of NationalTeam IDs
}

const EmptySlot = ({ 
  slotId, 
  slotIndex, 
  maxTeams, 
  unassignedTeams, 
  onAdd 
}: { 
  slotId: string, 
  slotIndex: number, 
  maxTeams: number, 
  unassignedTeams: NationalTeam[], 
  onAdd: (teamId: string) => void 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);

  const searchResults = isFocused && searchTerm 
    ? unassignedTeams
        .filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()))
        .slice(0, 8)
    : [];

  return (
    <div className="tourney-slot empty inline-group-search" style={{ position: 'relative', marginTop: '0.2rem' }}>
      <input 
        id={`group-search-${slotId}`}
        type="text" 
        placeholder={`Adicionar... (${slotIndex + 1}/${maxTeams})`}
        value={searchTerm}
        onChange={e => {
          setSearchTerm(e.target.value);
          setFocusedIndex(0);
        }}
        onFocus={() => {
          setIsFocused(true);
          setFocusedIndex(0);
        }}
        onBlur={() => {
          setTimeout(() => setIsFocused(false), 200);
        }}
        onKeyDown={e => {
          if (!isFocused) return;
          
          if (e.key === 'ArrowDown') {
            if (searchResults.length > 0) {
                e.preventDefault();
                setFocusedIndex(prev => Math.min(prev + 1, searchResults.length - 1));
            }
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setFocusedIndex(prev => Math.max(prev - 1, 0));
          } else if ((e.key === 'Enter' || e.key === 'Tab') && searchResults.length > 0) {
            e.preventDefault();
            const selected = searchResults[focusedIndex];
            if (selected) {
              setSearchTerm('');
              onAdd(selected.id);
            }
          }
        }}
        className="tourney-search-input"
        style={{ padding: '6px', fontSize: '0.8rem', width: '100%', boxSizing: 'border-box' }}
      />
      {isFocused && searchTerm && (
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
                  backgroundColor: idx === focusedIndex ? '#e0e0e0' : 'transparent'
                }}
                onMouseDown={(e) => {
                  e.preventDefault(); 
                  setSearchTerm('');
                  onAdd(t.id);
                }}
                onMouseEnter={() => setFocusedIndex(idx)}
              >
                <img src={t.logoUrl} alt={t.name} style={{ width: 16, height: 16, objectFit: 'contain' }} /> {t.name}
              </div>
            ))
          }
        </div>
      )}
    </div>
  );
};
// DEBUG: track focus globally
if (typeof window !== 'undefined') {
  (window as any).focusLog = (window as any).focusLog || [];
  if (!(window as any).focusTrackerAttached) {
    (window as any).focusTrackerAttached = true;
    document.addEventListener('focusin', (e) => {
      (window as any).focusLog.push(`focusin: ${(e.target as Element)?.id || (e.target as Element)?.tagName}`);
    });
    document.addEventListener('focusout', (e) => {
      (window as any).focusLog.push(`focusout: ${(e.target as Element)?.id || (e.target as Element)?.tagName}`);
    });
  }
}

const TournamentsView: React.FC<TournamentsViewProps> = ({ type }) => {
  const { user, userData } = useAuth();
  const [alertMsg, setAlertMsg] = useState<AlertMessage | null>(null);
  const [nationalTeams, setNationalTeams] = useState<NationalTeam[]>([]);
  const [tournamentData, setTournamentData] = useState<TournamentData>({});
  const [allUsers, setAllUsers] = useState<any[]>([]);
  
  // Admin Management Modal State
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [, setDraggedTeamId] = useState<string | null>(null);
  
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const hasUnsavedChangesRef = useRef(false);

  const setUnsaved = (val: boolean) => {
    setHasUnsavedChanges(val);
    hasUnsavedChangesRef.current = val;
  };

  // Global Settings state
  const [transferWindowOpen, setTransferWindowOpen] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [pendingAssumir, setPendingAssumir] = useState<string | null>(null);
  const [confirmDemitirTeam, setConfirmDemitirTeam] = useState<NationalTeam | null>(null);

  const isAdmin = user?.email === 'gnferreira2000@gmail.com';
  const hasNationalTeam = !!userData?.nationalTeamId;

  // Define Groups based on type
  const worldCupGroups = ['A','B','C','D','E','F','G','H','I','J','K','L']; // 12 groups, 4 each
  const euroGroups = ['A','B','C','D','E','F']; // 6 groups, 4 each
  const copaAmericaGroups = ['A','B']; // 2 groups, 5 each

  useEffect(() => {
    // Fetch Teams from Shared Cache
    const unsubTeams = nationalTeamsCache.subscribe((teamsList) => {
      let list = [...(teamsList as NationalTeam[])];
      if (type === 'euro_copa') {
        list = list.filter(t => t.confederation === 'UEFA' || t.confederation === 'CONMEBOL');
      }
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

    // Fetch Transfer Window Settings from Shared Cache
    const unsubSettings = globalSettingsCache.subscribe((data) => {
      if (data) {
        setTransferWindowOpen(data[`transferWindowOpen_${type}`] ?? true);
      }
    });

    // Fetch all users from Shared Cache
    const unsubUsers = usersCache.subscribe((snapList) => {
      setAllUsers(snapList);
    });

    return () => {
      unsubTeams();
      unsubTourney();
      unsubSettings();
      unsubUsers();
    };
  }, [type]);



  const handleDeclararInteresse = async (team: NationalTeam) => {
    if (processing || !userData) return;
    if (team.ownerId || !transferWindowOpen) return;
    
    if (userData.declaredInterestTeamId && userData.declaredInterestTeamId !== team.id) {
      setAlertMsg({ title: 'Atenção', message: 'Você já declarou interesse em outro time/seleção. Cancele o interesse anterior primeiro.', type: 'warning' });
      return;
    }

    try {
      setPendingAssumir(team.id);
      const teamRef = doc(db, 'national_teams', team.id);
      const userRef = doc(db, 'users', userData.uid);

      const currentInterested = team.interestedUsers || [];
      if (!currentInterested.includes(userData.uid)) {
        await updateDoc(teamRef, { interestedUsers: [...currentInterested, userData.uid] });
      }
      await updateDoc(userRef, { declaredInterestTeamId: team.id });
      setPendingAssumir(null);
    } catch (error: any) {
      console.error(error);
      setAlertMsg({ title: 'Erro', message: 'Erro ao declarar interesse.', type: 'error' });
      setPendingAssumir(null);
    }
  };

  const handleCancelarInteresse = async (team: NationalTeam) => {
    if (processing || !userData) return;
    try {
      setPendingAssumir(team.id);
      const teamRef = doc(db, 'national_teams', team.id);
      const userRef = doc(db, 'users', userData.uid);

      const currentInterested = team.interestedUsers || [];
      const updatedInterested = currentInterested.filter((id: string) => id !== userData.uid);
      
      await updateDoc(teamRef, { interestedUsers: updatedInterested });
      await updateDoc(userRef, { declaredInterestTeamId: null });
      setPendingAssumir(null);
    } catch (error) {
      console.error(error);
      setPendingAssumir(null);
    }
  };

  const handleAprovarUnico = async (team: NationalTeam) => {
    if (!isAdmin || !team.interestedUsers || team.interestedUsers.length !== 1) return;
    
    setProcessing(true);
    try {
      const teamRef = doc(db, 'national_teams', team.id);
      
      const winnerId = team.interestedUsers[0];
      const winnerUserObj = allUsers.find(u => u.id === winnerId);
      if (!winnerUserObj) {
        setProcessing(false);
        return;
      }
      
      const userRef = doc(db, 'users', winnerId);

      await Promise.all([
        updateDoc(teamRef, {
            ownerId: winnerId,
            ownerName: winnerUserObj.name,
            ownerPhoto: winnerUserObj.photoURL || null,
            interestedUsers: []
        }),
        updateDoc(userRef, { 
          nationalTeamId: team.id,
          declaredInterestTeamId: null
        })
      ]);
    } catch (error: any) {
      console.error(error);
      setAlertMsg({ title: 'Erro', message: 'Erro ao aprovar treinador.', type: 'error' });
    }
    setProcessing(false);
  };

  const handleIniciarSorteio = async (team: NationalTeam) => {
    if (!isAdmin || !team.interestedUsers || team.interestedUsers.length < 2) return;
    setProcessing(true);
    try {
      const participants = team.interestedUsers.map((uid: string) => {
        const u = allUsers.find(user => user.id === uid);
        return {
          uid,
          name: u?.name || 'Desconhecido',
          photoURL: u?.photoURL || '',
          dice1: null,
          dice2: null,
          total: null,
          eliminated: false
        };
      });

      const diceEventRef = doc(db, 'settings', 'dice_event');
      await setDoc(diceEventRef, {
        active: true,
        teamId: team.id,
        teamName: team.name,
        teamLogoUrl: team.logoUrl,
        participants,
        status: 'waiting',
        winner: null,
        round: 1,
        collectionType: 'national_teams'
      });
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
      
      await Promise.all([
        updateDoc(teamRef, {
          ownerId: null,
          ownerName: null,
          ownerPhoto: null
        }),
        updateDoc(userRef, { nationalTeamId: null })
      ]);
      
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
      await setDoc(tourneyRef, newData);
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

  const focusNextAvailableSlot = (currentGroupKey: string, newData: TournamentData, maxTeams: number) => {
    const allGroups: string[] = [];
    if (type === 'world_cup') {
      worldCupGroups.forEach(l => allGroups.push(`WC_${l}`));
    } else {
      euroGroups.forEach(l => allGroups.push(`EURO_${l}`));
      copaAmericaGroups.forEach(l => allGroups.push(`CA_${l}`));
    }

    const currentIndex = allGroups.indexOf(currentGroupKey);
    if (currentIndex === -1) return;

    for (let i = currentIndex + 1; i < allGroups.length; i++) {
      const nextGroup = allGroups[i];
      const teams = newData[nextGroup] || [];
      if (teams.length < maxTeams) {
        const nextSlotId = `${nextGroup}-${teams.length}`;
        let attempts = 0;
        const tryFocus = () => {
          const el = document.getElementById(`group-search-${nextSlotId}`);
          if (el) {
            el.focus({ preventScroll: true });
            if (document.activeElement === el) return;
          }
          if (attempts < 8) {
            attempts++;
            setTimeout(tryFocus, 100);
          }
        };
        // Wait 300ms before first attempt to ensure React has completely settled all DOM updates and animations
        setTimeout(tryFocus, 300);
        return;
      }
    }
  };

  const handleAddToGroup = (teamId: string, groupKey: string, maxTeams: number, autoFocusNext: boolean = false) => {
    const currentGroupTeams = tournamentData[groupKey] || [];
    if (currentGroupTeams.length >= maxTeams && !currentGroupTeams.includes(teamId)) {
        setAlertMsg({ title: 'Grupo Cheio', message: `O grupo ${groupKey} já está cheio!`, type: 'warning' });
        return;
    }

    const newData = { ...tournamentData };
    Object.keys(newData).forEach(key => {
      newData[key] = (newData[key] || []).filter(id => id !== teamId);
    });

    newData[groupKey] = [...(newData[groupKey] || []), teamId];
    setTournamentData(newData);
    setUnsaved(true);

    if (autoFocusNext && newData[groupKey].length >= maxTeams) {
      focusNextAvailableSlot(groupKey, newData, maxTeams);
    }
  };

  const handleDropToGroup = (e: React.DragEvent, groupKey: string, maxTeams: number) => {
    e.preventDefault();
    const teamId = e.dataTransfer.getData('teamId');
    setDraggedTeamId(null);
    if (!teamId) return;
    handleAddToGroup(teamId, groupKey, maxTeams, false);
    setUnsaved(true);
  };

  const handleAddFromSlot = (teamId: string, groupKey: string, maxTeams: number) => {
    handleAddToGroup(teamId, groupKey, maxTeams, true);
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
    const hasDeclaredInterest = userData?.declaredInterestTeamId === team.id;
    const hasDeclaredInterestAny = !!userData?.declaredInterestTeamId;
    const isAvailable = !team.ownerId && !hasNationalTeam && !hasDeclaredInterestAny && canInteractWithMarket;
    const isTakenByOther = team.ownerId && !isMyTeam;
    const interestedList = team.interestedUsers || [];

    let cardClass = 'team-card tourney-team-card';
    if (isAvailable || hasDeclaredInterest) cardClass += ' available';
    if (isMyTeam) cardClass += ' my-team';
    if (isTakenByOther) cardClass += ' taken-other';
    if (!team.ownerId && !isAvailable && !hasDeclaredInterest) cardClass += ' unavailable';

    const color1 = team.color;
    const color2 = team.secondaryColor || team.color;
    
    const dynamicStyle = color1 ? {
      '--team-color-1': color1,
      '--team-color-2': color2,
      border: `1px solid ${color1}40`,
    } as React.CSSProperties : {};

    const ownerPillStyle = color1 ? {
      border: `1px solid ${color1}40`,
      background: 'var(--card-bg)',
    } : {};

    return (
      <div 
        key={team.id} 
        className={cardClass}
        onClick={() => isAvailable ? handleDeclararInteresse(team) : (hasDeclaredInterest ? handleCancelarInteresse(team) : null)}
        style={dynamicStyle}
      >
        <div className="tourney-team-left">
          <div className="tourney-team-logo-container">
            <img src={team.logoUrl} alt={team.name} className="team-logo" style={{ maxHeight: '20px' }} />
          </div>
          <div className="tourney-team-name">
            {team.name}
          </div>
        </div>
        
        <div className="tourney-team-right">
          {/* Owner Pill (if owned) */}
          {team.ownerId && (
            <div className="owner-pill" style={{ ...ownerPillStyle, padding: '2px 6px', margin: 0 }}>
              {team.ownerPhoto ? (
                <img src={team.ownerPhoto} alt={team.ownerName!} referrerPolicy="no-referrer" style={{ width: 16, height: 16 }} />
              ) : (
                <div className="default-avatar" style={{ width: 16, height: 16, fontSize: '0.5rem' }}>
                  {team.ownerName?.charAt(0).toUpperCase()}
                </div>
              )}
              <span style={{ fontSize: '0.65rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '60px' }}>
                {team.ownerName}
              </span>
            </div>
          )}

          {/* Admin Remove from Group */}
          {isAdmin && adminModalOpen && groupKey && (
            <button 
              className="icon-action-btn btn-remove"
              onClick={(e) => { e.stopPropagation(); handleRemoveFromGroup(team.id); }}
              title="Remover do Grupo"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          )}

          {/* Sair da seleção (if my team) */}
          {team.ownerId && isMyTeam && canInteractWithMarket && (
             pendingAssumir === team.id ? (
               <span style={{ fontSize: '0.75rem', color: '#888' }}>...</span>
             ) : (
               <button 
                 className="icon-action-btn btn-cancel" 
                 onClick={(e) => { e.stopPropagation(); setConfirmDemitirTeam(team); }}
                 title="Sair da Seleção"
               >
                 <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
               </button>
             )
          )}

          {isAdmin && isTakenByOther && (
            <button 
              className="icon-action-btn btn-cancel" 
              onClick={(e) => { e.stopPropagation(); handleForceResign(team); }}
              title="Expulsar Treinador"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          )}

          {/* User actions on available team */}
          {!team.ownerId && isAvailable && (
            <button 
              className="icon-action-btn btn-interest" 
              onClick={(e) => { e.stopPropagation(); handleDeclararInteresse(team); }}
              title="Declarar Interesse"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5c-1.1 0-2 .9-2 2v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>
            </button>
          )}

          {!team.ownerId && hasDeclaredInterest && (
            <button 
              className="icon-action-btn btn-cancel" 
              onClick={(e) => { e.stopPropagation(); handleCancelarInteresse(team); }}
              title="Cancelar Interesse"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5c-1.1 0-2 .9-2 2v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="23" y1="11" x2="17" y2="11"></line></svg>
            </button>
          )}

          {!team.ownerId && !isAvailable && !hasDeclaredInterest && interestedList.length === 0 && (
            <div title={!transferWindowOpen ? "Mercado Fechado" : "Bloqueado"} style={{ display: 'flex', alignItems: 'center', opacity: 0.5, paddingRight: '4px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
            </div>
          )}

          {/* Admin / Interested Users Stack */}
          {!team.ownerId && interestedList.length > 0 && (
            <>
              <div className="avatar-stack">
                {interestedList.slice(0, 3).map((uid: string) => {
                   const u = allUsers.find(x => x.id === uid);
                   if (!u) return null;
                   return (
                     <div key={uid} className="avatar-stack-item" title={u.name}>
                       {u.photoURL ? (
                         <img src={u.photoURL} alt={u.name} referrerPolicy="no-referrer" />
                       ) : (
                         u.name.charAt(0).toUpperCase()
                       )}
                     </div>
                   );
                })}
                {interestedList.length > 3 && (
                  <div className="avatar-stack-item" style={{ background: '#333' }}>
                    +{interestedList.length - 3}
                  </div>
                )}
              </div>
              
              {isAdmin && (
                interestedList.length === 1 ? (
                  <button 
                    className="icon-action-btn btn-approve" 
                    onClick={(e) => { e.stopPropagation(); handleAprovarUnico(team); }}
                    title="Aprovar Único Candidato"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  </button>
                ) : (
                  <button 
                    className="icon-action-btn btn-draw" 
                    onClick={(e) => { e.stopPropagation(); handleIniciarSorteio(team); }}
                    title="Realizar Sorteio"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><circle cx="15.5" cy="15.5" r="1.5"></circle></svg>
                  </button>
                )
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  const renderGroup = (prefix: string, letter: string, maxTeams: number) => {
    const groupKey = `${prefix}_${letter}`;
    const teamsInGroup = tournamentData[groupKey] || [];
    const emptyCount = Math.max(0, maxTeams - teamsInGroup.length);

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
          {teamsInGroup.map(tid => (
             <div key={tid} className="tourney-slot filled">
               {renderTeamCard(tid, groupKey)}
             </div>
          ))}
          
          {isAdmin && adminModalOpen && Array.from({ length: emptyCount }).map((_, idx) => {
             const slotIndex = teamsInGroup.length + idx;
             const slotId = `${groupKey}-${slotIndex}`;
             
             let groupUnassignedTeams = unassignedTeams;
             if (prefix === 'EURO') {
               groupUnassignedTeams = unassignedTeams.filter(t => t.confederation === 'UEFA');
             } else if (prefix === 'CA') {
               groupUnassignedTeams = unassignedTeams.filter(t => t.confederation === 'CONMEBOL');
             }

             return (
               <EmptySlot 
                 key={`empty-idx-${idx}`}
                 slotId={slotId}
                 slotIndex={slotIndex}
                 maxTeams={maxTeams}
                 unassignedTeams={groupUnassignedTeams}
                 onAdd={(teamId) => handleAddFromSlot(teamId, groupKey, maxTeams)}
               />
             );
          })}

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
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <h3>Gerenciar Grupos - {type === 'world_cup' ? 'Copa do Mundo' : 'Euro e Copa América'}</h3>
              </div>
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
                disabled={resetConfirmText.toLowerCase() !== 'sim' || processing}
                onClick={async () => {
                  setTournamentData({});
                  await saveTournamentData({});
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
      <AlertModal alert={alertMsg} onClose={() => setAlertMsg(null)} />
    </div>
  );
};

export default TournamentsView;
