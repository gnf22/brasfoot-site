import React, { useEffect, useState } from 'react';
import { collection, addDoc, updateDoc, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import TournamentsView from '../components/TournamentsView';

interface Team {
  id: string;
  name: string;
  logoUrl: string;
  ownerId: string | null;
  ownerName: string | null;
  ownerPhoto: string | null;
  isActive?: boolean;
}

const TeamsPage: React.FC = () => {
  const { user, userData, loading, logout } = useAuth();
  const navigate = useNavigate();
  const [currentView, setCurrentView] = useState<'clubes' | 'world_cup' | 'euro_copa'>('clubes');
  const [teams, setTeams] = useState<Team[]>([]);
  const [nationalTeams, setNationalTeams] = useState<Team[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  
  // States for Modals
  const [createTeamModalOpen, setCreateTeamModalOpen] = useState(false);
  const [manageTeamsModalOpen, setManageTeamsModalOpen] = useState(false);
  const [manageUsersModalOpen, setManageUsersModalOpen] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamLogo, setNewTeamLogo] = useState('');
  
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [editTeamName, setEditTeamName] = useState('');
  const [editTeamLogo, setEditTeamLogo] = useState('');
  
  const [confirmDemitirTeam, setConfirmDemitirTeam] = useState<Team | null>(null);
  const [editNameModalOpen, setEditNameModalOpen] = useState(false);
  const [customName, setCustomName] = useState('');

  // Drag and Drop Local State
  const [dndTeams, setDndTeams] = useState<Team[]>([]);
  const [draggingTeam, setDraggingTeam] = useState<Team | null>(null);
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 });

  // Global Settings state
  const [processing, setProcessing] = useState(false);
  const [transferWindows, setTransferWindows] = useState<Record<string, boolean>>({});

  const isAdmin = user?.email === 'gnferreira2000@gmail.com';
  const isMarketOpen = transferWindows[currentView] ?? true;

  useEffect(() => {
    if (!loading && !user) {
      navigate('/');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    const teamsCollectionRef = collection(db, 'teams');
    const unsubscribeTeams = onSnapshot(teamsCollectionRef, (snapshot) => {
      const teamsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team));
      teamsList.sort((a, b) => a.name.localeCompare(b.name));
      setTeams(teamsList);
    });

    const nationalTeamsRef = collection(db, 'national_teams');
    const unsubscribeNational = onSnapshot(nationalTeamsRef, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team));
      list.sort((a, b) => a.name.localeCompare(b.name));
      setNationalTeams(list);
    });

    const settingsRef = doc(db, 'settings', 'global');
    const unsubscribeSettings = onSnapshot(settingsRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setTransferWindows({
          clubes: data.transferWindowOpen_clubes ?? true,
          world_cup: data.transferWindowOpen_world_cup ?? true,
          euro_copa: data.transferWindowOpen_euro_copa ?? true,
        });
        if (data.activeView) {
          setCurrentView(data.activeView);
        }
      }
    });

    return () => {
      unsubscribeTeams();
      unsubscribeNational();
      unsubscribeSettings();
    };
  }, []);

  useEffect(() => {
    let unsubscribeUsers: () => void;
    if (isAdmin) {
      const usersRef = collection(db, 'users');
      unsubscribeUsers = onSnapshot(usersRef, (snap) => {
        setAllUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
    }
    return () => {
      if (unsubscribeUsers) unsubscribeUsers();
    }
  }, [isAdmin]);

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim() || !newTeamLogo.trim()) return;
    setProcessing(true);
    try {
      const teamsCollectionRef = collection(db, 'teams');
      await addDoc(teamsCollectionRef, {
        name: newTeamName,
        logoUrl: newTeamLogo,
        ownerId: null,
        ownerName: null,
        ownerPhoto: null,
        isActive: true
      });
      setNewTeamName('');
      setNewTeamLogo('');
      setCreateTeamModalOpen(false);
    } catch (error) {
      console.error(error);
    }
    setProcessing(false);
  };

  const handleUpdateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeam || !editTeamName.trim() || !editTeamLogo.trim()) return;
    setProcessing(true);
    try {
      const teamRef = doc(db, 'teams', editingTeam.id);
      await updateDoc(teamRef, {
        name: editTeamName,
        logoUrl: editTeamLogo
      });
      closeEditModal();
    } catch (error) {
      console.error(error);
    }
    setProcessing(false);
  };

  const handleDeleteTeam = async () => {
    if (!editingTeam) return;
    const confirm = window.confirm(`Tem certeza que deseja excluir o clube "${editingTeam.name}"? Esta ação não pode ser desfeita.`);
    if (!confirm) return;

    setProcessing(true);
    try {
      if (editingTeam.ownerId) {
        const userField = currentView === 'clubes' ? 'teamId' : 'nationalTeamId';
        const userRef = doc(db, 'users', editingTeam.ownerId);
        await updateDoc(userRef, { [userField]: null });
      }
      const coll = currentView === 'clubes' ? 'teams' : 'national_teams';
      const teamRef = doc(db, coll, editingTeam.id);
      await deleteDoc(teamRef);
      closeEditModal();
    } catch (error) {
      console.error(error);
    }
    setProcessing(false);
  };
  
  const openEditModal = (team: Team) => {
    setEditingTeam(team);
    setEditTeamName(team.name);
    setEditTeamLogo(team.logoUrl);
  };
  
  const closeEditModal = () => {
    setEditingTeam(null);
    setEditTeamName('');
    setEditTeamLogo('');
  };

  const toggleTransferWindow = async () => {
    setProcessing(true);
    try {
      const settingsRef = doc(db, 'settings', 'global');
      const key = `transferWindowOpen_${currentView}`;
      try {
        await updateDoc(settingsRef, { [key]: !isMarketOpen });
      } catch (err) {
        await setDoc(settingsRef, { [key]: !isMarketOpen }, { merge: true });
      }
    } catch (err) {
      console.error(err);
    }
    setProcessing(false);
  };

  const handleSetGlobalView = async (view: 'clubes' | 'world_cup' | 'euro_copa') => {
    if (!isAdmin) return;
    try {
      const settingsRef = doc(db, 'settings', 'global');
      await updateDoc(settingsRef, { activeView: view });
      setCurrentView(view);
    } catch (err) {
      console.error(err);
    }
  };

  const handleForceResign = async (team: Team) => {
    if (!isAdmin || !team.ownerId) return;
    setProcessing(true);
    try {
      const coll = currentView === 'clubes' ? 'teams' : 'national_teams';
      const userField = currentView === 'clubes' ? 'teamId' : 'nationalTeamId';
      const teamRef = doc(db, coll, team.id);
      const userRef = doc(db, 'users', team.ownerId);
      await updateDoc(teamRef, { ownerId: null, ownerName: null, ownerPhoto: null });
      await updateDoc(userRef, { [userField]: null });
    } catch (error) {
      console.error(error);
    }
    setProcessing(false);
  };

  const handleAssumir = async (team: Team) => {
    if (processing || !userData) return;
    if (team.ownerId) return;
    if (!isMarketOpen) return;

    try {
      const teamRef = doc(db, 'teams', team.id);
      const userRef = doc(db, 'users', userData.uid);
      updateDoc(teamRef, {
        ownerId: userData.uid,
        ownerName: userData.name,
        ownerPhoto: userData.photoURL || null
      });
      updateDoc(userRef, { teamId: team.id });
    } catch (error) {
      console.error(error);
    }
  };

  const executeDemitir = async () => {
    if (!userData || !confirmDemitirTeam) return;
    if (!isMarketOpen) return;

    setProcessing(true);
    try {
      const teamRef = doc(db, 'teams', confirmDemitirTeam.id);
      const userRef = doc(db, 'users', userData.uid);
      await updateDoc(teamRef, {
        ownerId: null,
        ownerName: null,
        ownerPhoto: null
      });
      await updateDoc(userRef, { teamId: null });
      setConfirmDemitirTeam(null);
    } catch (error) {
      console.error(error);
    }
    setProcessing(false);
  };

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim() || !userData) return;
    setProcessing(true);
    try {
      const userRef = doc(db, 'users', userData.uid);
      await updateDoc(userRef, { name: customName.trim() });
      
      if (userData.teamId) {
        const teamRef = doc(db, 'teams', userData.teamId);
        await updateDoc(teamRef, { ownerName: customName.trim() });
      }
      setEditNameModalOpen(false);
    } catch (error) {
      console.error(error);
    }
    setProcessing(false);
  };

  // Drag and Drop Handlers
  const openManageTeams = () => {
    setDndTeams([...teams]);
    setManageTeamsModalOpen(true);
  };

  const handleDragStart = (e: React.DragEvent, team: Team) => {
    e.dataTransfer.setData('teamId', team.id);
    e.dataTransfer.effectAllowed = 'move';
    
    // Hide default browser drag ghost
    const img = new Image();
    img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    e.dataTransfer.setDragImage(img, 0, 0);
    
    setDraggingTeam(team);
    setDragPos({ x: e.clientX, y: e.clientY });

    setTimeout(() => {
      if (e.target instanceof HTMLElement) {
        e.target.classList.add('is-dragging');
      }
    }, 0);
  };

  const handleDrag = (e: React.DragEvent) => {
    if (e.clientX === 0 && e.clientY === 0) return;
    setDragPos({ x: e.clientX, y: e.clientY });
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggingTeam(null);
    if (e.target instanceof HTMLElement) {
      e.target.classList.remove('is-dragging');
    }
  };

  const handleDrop = (e: React.DragEvent, isActiveColumn: boolean) => {
    e.preventDefault();
    const teamId = e.dataTransfer.getData('teamId');
    setDndTeams(prev => prev.map(t => t.id === teamId ? { ...t, isActive: isActiveColumn } : t));
    setDraggingTeam(null);
    const target = e.currentTarget as HTMLElement;
    target.classList.remove('drag-over');
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDragEnter = (e: React.DragEvent) => {
    const target = e.currentTarget as HTMLElement;
    target.classList.add('drag-over');
  };

  const handleDragLeave = (e: React.DragEvent) => {
    const target = e.currentTarget as HTMLElement;
    target.classList.remove('drag-over');
  };

  const handleMoveTeam = (team: Team, isActiveColumn: boolean) => {
    setDndTeams(prev => prev.map(t => t.id === team.id ? { ...t, isActive: isActiveColumn } : t));
  };

  const saveManagedTeams = async () => {
    setProcessing(true);
    try {
      for (const t of dndTeams) {
        const original = teams.find(x => x.id === t.id);
        const originalIsActive = original?.isActive !== false;
        const newIsActive = t.isActive !== false;
        
        if (originalIsActive !== newIsActive) {
          const teamRef = doc(db, 'teams', t.id);
          await updateDoc(teamRef, { isActive: newIsActive });
          
          if (!newIsActive && t.ownerId) {
             // Forçar demissão se inativar o time ocupado
             const uRef = doc(db, 'users', t.ownerId);
             await updateDoc(teamRef, { ownerId: null, ownerName: null, ownerPhoto: null });
             await updateDoc(uRef, { teamId: null });
          }
        }
      }
      setManageTeamsModalOpen(false);
    } catch(e) {
      console.error(e);
    }
    setProcessing(false);
  };

  // Reassign User
  const handleReassignUser = async (userId: string, currentTeamId: string | null, newTeamId: string) => {
    if (!newTeamId || currentTeamId === newTeamId) return;
    setProcessing(true);
    try {
       const userRef = doc(db, 'users', userId);
       const sourceTeams = currentView === 'clubes' ? teams : nationalTeams;
       const targetTeam = sourceTeams.find(t => t.id === newTeamId);
       const userObj = allUsers.find(u => u.id === userId);
       
       const coll = currentView === 'clubes' ? 'teams' : 'national_teams';
       const userField = currentView === 'clubes' ? 'teamId' : 'nationalTeamId';
       
       if (currentTeamId) {
          await updateDoc(doc(db, coll, currentTeamId), { ownerId: null, ownerName: null, ownerPhoto: null });
       }
       
       if (newTeamId && targetTeam && userObj) {
          await updateDoc(doc(db, coll, newTeamId), { ownerId: userId, ownerName: userObj.name, ownerPhoto: userObj.photoURL || null });
          await updateDoc(userRef, { [userField]: newTeamId });
       } else if (newTeamId === 'remove') {
          await updateDoc(userRef, { [userField]: null });
       }
    } catch(e){
      console.error(e);
    }
    setProcessing(false);
  };

  // Delete User
  const handleDeleteUser = async (userId: string, currentTeamId: string | null) => {
    if (!isAdmin) return;
    const confirmDelete = window.confirm('Tem certeza que deseja excluir este usuário permanentemente do sistema?');
    if (!confirmDelete) return;
    
    setProcessing(true);
    try {
      const coll = currentView === 'clubes' ? 'teams' : 'national_teams';
      if (currentTeamId) {
        await updateDoc(doc(db, coll, currentTeamId), { ownerId: null, ownerName: null, ownerPhoto: null });
      }
      await deleteDoc(doc(db, 'users', userId));
      setSelectedUsers(prev => prev.filter(id => id !== userId));
    } catch (e) {
      console.error(e);
    }
    setProcessing(false);
  };

  const handleBulkDeleteUsers = async () => {
    if (!isAdmin || selectedUsers.length === 0) return;
    const confirmDelete = window.confirm(`Tem certeza que deseja excluir ${selectedUsers.length} usuários permanentemente?`);
    if (!confirmDelete) return;
    
    setProcessing(true);
    try {
      const coll = currentView === 'clubes' ? 'teams' : 'national_teams';
      const userField = currentView === 'clubes' ? 'teamId' : 'nationalTeamId';
      for (const userId of selectedUsers) {
        const u = allUsers.find(x => x.id === userId);
        if (u && u[userField]) {
          await updateDoc(doc(db, coll, u[userField]), { ownerId: null, ownerName: null, ownerPhoto: null });
        }
        await deleteDoc(doc(db, 'users', userId));
      }
      setSelectedUsers([]);
    } catch (e) {
      console.error(e);
    }
    setProcessing(false);
  };

  if (loading || !userData) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
      </div>
    );
  }

  const hasTeam = !!userData.teamId;

  // Filter visible teams
  const visibleTeams = teams.filter(t => t.isActive !== false);

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="brand">
          <h1>Brasfoot FutNews</h1>
        </div>
        
        <div className="main-nav">
          {isAdmin ? (
            <>
              <button className={`nav-tab ${currentView === 'clubes' ? 'active' : ''}`} onClick={() => handleSetGlobalView('clubes')}>Clubes</button>
              <button className={`nav-tab ${currentView === 'world_cup' ? 'active' : ''}`} onClick={() => handleSetGlobalView('world_cup')}>Copa do Mundo</button>
              <button className={`nav-tab ${currentView === 'euro_copa' ? 'active' : ''}`} onClick={() => handleSetGlobalView('euro_copa')}>Euro & Copa América</button>
              <button className="nav-tab" onClick={() => navigate('/national-teams')}>Painel de Seleções</button>
            </>
          ) : (
            <h2 style={{ color: 'var(--primary-color)', margin: 0, paddingLeft: '1rem', fontSize: '1.2rem' }}>
              {currentView === 'clubes' && 'Ligas'}
              {currentView === 'world_cup' && 'Copa do Mundo'}
              {currentView === 'euro_copa' && 'Eurocopa & Copa América'}
            </h2>
          )}
        </div>

        <div className="user-controls">
          <div 
            className="user-profile clickable-profile" 
            onClick={() => {
              setCustomName(userData.name);
              setEditNameModalOpen(true);
            }}
            title="Editar meu perfil"
          >
            {userData.photoURL ? (
              <>
                <img 
                  src={userData.photoURL} 
                  alt="Perfil" 
                  className="user-avatar" 
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const sibling = e.currentTarget.nextElementSibling as HTMLElement;
                    if (sibling) sibling.style.display = 'flex';
                  }}
                />
                <div className="default-avatar default-avatar-large" style={{ display: 'none' }}>
                  {userData.name.charAt(0).toUpperCase()}
                </div>
              </>
            ) : (
              <div className="default-avatar default-avatar-large">
                {userData.name.charAt(0).toUpperCase()}
              </div>
            )}
            <span><strong>{userData.name}</strong></span>
            <span className="edit-icon">✎</span>
          </div>
          <button className="btn-secondary" style={{padding: '6px 12px'}} onClick={logout}>Sair</button>
        </div>
      </header>

      {isAdmin && (
        <section className="admin-section">
          <div className="admin-toolbar">
            <h3>Painel de Controle</h3>
            <div className="admin-toolbar-buttons">
              {currentView === 'clubes' && (
                <>
                  <button 
                    className="btn-secondary"
                    onClick={() => setCreateTeamModalOpen(true)}
                  >
                    + Novo Clube
                  </button>
                  <button 
                    className="btn-secondary"
                    onClick={openManageTeams}
                  >
                    Gerenciar Clubes
                  </button>
                </>
              )}
              <button 
                className="btn-secondary"
                onClick={() => setManageUsersModalOpen(true)}
              >
                Gerenciar Treinadores
              </button>
              <button 
                className={isMarketOpen ? "btn-danger" : "btn-primary"} 
                onClick={toggleTransferWindow}
                disabled={processing}
                style={{ marginLeft: '1rem' }}
              >
                {isMarketOpen ? "Fechar Janela deste Torneio" : "Abrir Janela deste Torneio"}
              </button>
            </div>
          </div>
        </section>
      )}

      {!isMarketOpen && currentView === 'clubes' && (
        <div className="transfer-window-banner">
          ⚠️ <strong>Janela de Transferências Fechada!</strong> Contratações e demissões estão temporariamente suspensas.
        </div>
      )}

      {currentView === 'clubes' ? (
        <main className="teams-grid">
        {visibleTeams.map(team => {
          const isMyTeam = team.ownerId === userData.uid;
          const canInteractWithMarket = isMarketOpen;
          const isAvailable = !team.ownerId && !hasTeam && canInteractWithMarket;
          const isTakenByOther = team.ownerId && !isMyTeam;
          
          let cardClass = 'team-card';
          if (isAvailable) cardClass += ' available';
          if (isMyTeam) cardClass += ' my-team';
          if (isTakenByOther) cardClass += ' taken-other';
          if (!team.ownerId && !isAvailable) cardClass += ' unavailable'; 
          if (isAdmin && team.isActive === false) cardClass += ' inactive-team';

          return (
            <div 
              key={team.id} 
              className={cardClass} 
              onClick={() => isAvailable && handleAssumir(team)}
            >
              {isAdmin && (
                <button 
                  className="btn-edit-absolute"
                  onClick={(e) => { e.stopPropagation(); openEditModal(team); }}
                  title="Editar Clube"
                >
                  ✎
                </button>
              )}
              
              <div className="team-logo-container">
                <img src={team.logoUrl} alt={team.name} className="team-logo" />
              </div>
              
              <div className="team-name">{team.name} {team.isActive === false && '(Inativo)'}</div>
              
              <div className="team-status-area">
                {!team.ownerId && isAvailable && (
                  <button 
                    className="btn-secondary" 
                    style={{ padding: '6px 16px', fontSize: '0.85rem', marginTop: '4px', borderRadius: '20px' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAssumir(team);
                    }}
                  >
                    Assumir
                  </button>
                )}
                
                {!team.ownerId && !isAvailable && (
                  <div className="lock-icon" title={!isMarketOpen ? "Janela de transferências fechada" : "Bloqueado"}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                  </div>
                )}
                
                {team.ownerId && (
                  <div className="owner-pill">
                    {team.ownerPhoto ? (
                      <>
                        <img 
                          src={team.ownerPhoto} 
                          alt={team.ownerName!} 
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const sibling = e.currentTarget.nextElementSibling as HTMLElement;
                            if (sibling) sibling.style.display = 'flex';
                          }}
                        />
                        <div className="default-avatar" style={{ display: 'none' }}>
                          {team.ownerName?.charAt(0).toUpperCase()}
                        </div>
                      </>
                    ) : (
                      <div className="default-avatar">
                        {team.ownerName?.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span>{team.ownerName}</span>
                  </div>
                )}
                
                {isMyTeam && (
                  canInteractWithMarket ? (
                    <button 
                      className="btn-danger" 
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDemitirTeam(team);
                      }}
                      style={{ marginTop: '8px' }}
                    >
                      Demitir-se
                    </button>
                  ) : (
                    <div className="lock-icon" style={{ marginTop: '8px' }} title="Janela de transferências fechada">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                    </div>
                  )
                )}

                {isAdmin && isTakenByOther && (
                  <button 
                    className="btn-danger btn-small" 
                    onClick={(e) => { e.stopPropagation(); handleForceResign(team); }}
                    style={{ marginTop: '8px', padding: '4px 8px', fontSize: '0.7rem' }}
                    title="Remover Treinador"
                  >
                    Expulsar
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </main>
      ) : (
        <TournamentsView type={currentView as 'world_cup' | 'euro_copa'} />
      )}

      {/* --- MODALS --- */}

      {/* Modal Cadastrar Clube */}
      {createTeamModalOpen && (
        <div className="modal-overlay" onClick={() => setCreateTeamModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Cadastrar Novo Clube</h3>
            <form onSubmit={handleCreateTeam} className="modal-form">
              <div className="input-group">
                <label>Nome do Clube</label>
                <input 
                  type="text" 
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  disabled={processing}
                />
              </div>
              <div className="input-group">
                <label>URL do Escudo</label>
                <input 
                  type="text" 
                  value={newTeamLogo}
                  onChange={(e) => setNewTeamLogo(e.target.value)}
                  disabled={processing}
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setCreateTeamModalOpen(false)} disabled={processing}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" disabled={processing}>
                  Registrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Gerenciar Clubes (Ativo/Inativo) */}
      {manageTeamsModalOpen && (
        <div className="modal-overlay" onClick={() => setManageTeamsModalOpen(false)}>
          <div className="modal-content large-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Gerenciar Clubes (Arraste e Solte)</h3>
            <p style={{fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem'}}>
              Times inativos são ocultados. Se inativar um time ocupado, o treinador será demitido.
            </p>
            
            <div className="dnd-container">
              {/* Coluna Ativos */}
              <div 
                className="dnd-column dnd-column-active"
                onDrop={(e) => handleDrop(e, true)}
                onDragOver={handleDragOver}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
              >
                <h4>Times Ativos</h4>
                {dndTeams.filter(t => t.isActive !== false).map(team => (
                  <div 
                    key={team.id} 
                    className="dnd-item"
                    draggable
                    onDragStart={(e) => handleDragStart(e, team)}
                    onDrag={handleDrag}
                    onDragEnd={handleDragEnd}
                  >
                    <img src={team.logoUrl} alt={team.name} />
                    <span style={{flex: 1}}>{team.name} {team.ownerName ? `(${team.ownerName})` : ''}</span>
                    <button 
                      type="button" 
                      className="btn-danger"
                      style={{ padding: '2px 8px', fontSize: '1.2rem' }}
                      onClick={() => handleMoveTeam(team, false)}
                      title="Desativar"
                    >
                      ↓
                    </button>
                  </div>
                ))}
              </div>

              {/* Coluna Inativos */}
              <div 
                className="dnd-column dnd-column-inactive"
                onDrop={(e) => handleDrop(e, false)}
                onDragOver={handleDragOver}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
              >
                <h4>Times Inativos</h4>
                {dndTeams.filter(t => t.isActive === false).map(team => (
                  <div 
                    key={team.id} 
                    className="dnd-item"
                    draggable
                    onDragStart={(e) => handleDragStart(e, team)}
                    onDrag={handleDrag}
                    onDragEnd={handleDragEnd}
                  >
                    <img src={team.logoUrl} alt={team.name} />
                    <span style={{flex: 1}}>{team.name}</span>
                    <button 
                      type="button" 
                      className="btn-primary"
                      style={{ padding: '2px 8px', fontSize: '1.2rem' }}
                      onClick={() => handleMoveTeam(team, true)}
                      title="Ativar"
                    >
                      ↑
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Custom Drag Overlay */}
            {draggingTeam && (
              <div 
                className="dnd-item"
                style={{
                  position: 'fixed',
                  left: dragPos.x + 10, // offset so it doesn't block drop target
                  top: dragPos.y + 10,
                  pointerEvents: 'none',
                  zIndex: 9999,
                  width: '250px',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2)',
                  margin: 0
                }}
              >
                <img src={draggingTeam.logoUrl} alt={draggingTeam.name} />
                <span>{draggingTeam.name} {draggingTeam.ownerName ? `(${draggingTeam.ownerName})` : ''}</span>
              </div>
            )}

            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setManageTeamsModalOpen(false)} disabled={processing}>
                Cancelar
              </button>
              <button type="button" className="btn-primary" onClick={saveManagedTeams} disabled={processing}>
                Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Gerenciar Treinadores */}
      {manageUsersModalOpen && (
        <div className="modal-overlay" onClick={() => setManageUsersModalOpen(false)}>
          <div className="modal-content large-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Gerenciar Treinadores</h3>
            
            <div className="user-table-container">
              <table className="user-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px', textAlign: 'center' }}>
                      <input 
                        type="checkbox" 
                        checked={allUsers.length > 0 && selectedUsers.length === allUsers.length}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedUsers(allUsers.map(u => u.id));
                          else setSelectedUsers([]);
                        }}
                      />
                    </th>
                    <th>Treinador</th>
                    <th>Email</th>
                    <th>Time Atual</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {allUsers.map(u => {
                    const userTeamId = currentView === 'clubes' ? u.teamId : u.nationalTeamId;
                    const sourceTeams = currentView === 'clubes' ? teams : nationalTeams;
                    const currentTeam = sourceTeams.find(t => t.id === userTeamId);
                    
                    return (
                      <tr key={u.id}>
                        <td style={{ textAlign: 'center' }}>
                          <input 
                            type="checkbox" 
                            checked={selectedUsers.includes(u.id)}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedUsers(prev => [...prev, u.id]);
                              else setSelectedUsers(prev => prev.filter(id => id !== u.id));
                            }}
                          />
                        </td>
                        <td>
                          <div className="user-row-avatar">
                            {u.photoURL ? <img src={u.photoURL} referrerPolicy="no-referrer" /> : <div className="default-avatar">{u.name.charAt(0)}</div>}
                            <span>{u.name}</span>
                          </div>
                        </td>
                        <td>{u.email}</td>
                        <td>{currentTeam ? currentTeam.name : (currentView === 'clubes' ? 'Sem Clube' : 'Sem Seleção')}</td>
                        <td>
                          <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
                            {currentTeam && (
                              <button 
                                className="btn-danger btn-small"
                                onClick={() => handleForceResign(currentTeam)}
                                disabled={processing}
                                title="Remover do clube"
                              >
                                Demitir
                              </button>
                            )}
                            <button 
                              className="btn-warn btn-small"
                              style={{ padding: '4px 8px', fontSize: '0.75rem', marginLeft: '4px', marginRight: '4px' }}
                              onClick={() => handleDeleteUser(u.id, userTeamId)}
                              disabled={processing}
                              title="Excluir Usuário"
                            >
                              Excluir
                            </button>
                            <select 
                              className="reassign-select"
                              value={userTeamId || ''}
                              onChange={(e) => handleReassignUser(u.id, userTeamId, e.target.value)}
                              disabled={processing}
                            >
                              <option value="">-- {currentView === 'clubes' ? 'Remover Clube' : 'Remover Seleção'} --</option>
                              {sourceTeams.filter(t => !t.ownerId || t.id === userTeamId).map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                              ))}
                            </select>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            <div className="modal-actions" style={{ justifyContent: 'space-between' }}>
              <div>
                {selectedUsers.length > 0 && (
                  <button 
                    type="button" 
                    className="btn-warn" 
                    onClick={handleBulkDeleteUsers} 
                    disabled={processing}
                  >
                    Excluir ({selectedUsers.length}) Selecionados
                  </button>
                )}
              </div>
              <button type="button" className="btn-secondary" style={{ flex: 'none', minWidth: '120px' }} onClick={() => setManageUsersModalOpen(false)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Clube */}
      {editingTeam && (
        <div className="modal-overlay" onClick={closeEditModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Editar Clube</h3>
            <form onSubmit={handleUpdateTeam} className="modal-form">
              <div className="input-group">
                <label>Nome do Clube</label>
                <input 
                  type="text" 
                  value={editTeamName}
                  onChange={(e) => setEditTeamName(e.target.value)}
                  disabled={processing}
                />
              </div>
              <div className="input-group">
                <label>URL do Escudo</label>
                <input 
                  type="text" 
                  value={editTeamLogo}
                  onChange={(e) => setEditTeamLogo(e.target.value)}
                  disabled={processing}
                />
              </div>
              <div className="modal-actions" style={{ justifyContent: 'space-between' }}>
                <button type="button" className="btn-danger" onClick={handleDeleteTeam} disabled={processing}>
                  Excluir
                </button>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="button" className="btn-secondary" onClick={closeEditModal} disabled={processing}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn-primary" disabled={processing}>
                    Salvar
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirmar Demissão (Treinador Normal) */}
      {confirmDemitirTeam && (
        <div className="modal-overlay" onClick={() => setConfirmDemitirTeam(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Confirmação de Demissão</h3>
            <p style={{marginBottom: '1.5rem', color: 'var(--text-secondary)'}}>
              Você tem certeza que deseja entregar o cargo de treinador do <strong>{confirmDemitirTeam.name}</strong>? Esta ação não pode ser desfeita e o clube ficará livre no mercado.
            </p>
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setConfirmDemitirTeam(null)} disabled={processing}>
                Cancelar
              </button>
              <button type="button" className="btn-danger" onClick={executeDemitir} disabled={processing}>
                Sim, Quero Sair
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Nome */}
      {editNameModalOpen && (
        <div className="modal-overlay" onClick={() => setEditNameModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Meu Perfil</h3>
            <form onSubmit={handleUpdateName} className="modal-form">
              <div className="input-group">
                <label>Como você quer ser chamado no jogo?</label>
                <input 
                  type="text" 
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  disabled={processing}
                  maxLength={30}
                  placeholder="Seu nome de treinador"
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setEditNameModalOpen(false)} disabled={processing}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" disabled={processing}>
                  Atualizar Nome
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default TeamsPage;
