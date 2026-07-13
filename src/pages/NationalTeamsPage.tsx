import React, { useEffect, useState } from 'react';
import { collection, addDoc, updateDoc, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

interface NationalTeam {
  id: string;
  name: string;
  logoUrl: string;
  confederation: string;
  ownerId: string | null;
  ownerName: string | null;
  ownerPhoto: string | null;
  isActive?: boolean;
}

const CONFEDERATIONS = ['AFC', 'CAF', 'CONCACAF', 'CONMEBOL', 'OFC', 'UEFA'];

const NationalTeamsPage: React.FC = () => {
  const { user, userData, loading, logout } = useAuth();
  const navigate = useNavigate();
  const [teams, setTeams] = useState<NationalTeam[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  
  // States for Modals
  const [createTeamModalOpen, setCreateTeamModalOpen] = useState(false);
  const [manageTeamsModalOpen, setManageTeamsModalOpen] = useState(false);
  const [manageUsersModalOpen, setManageUsersModalOpen] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamLogo, setNewTeamLogo] = useState('');
  const [newTeamConfederation, setNewTeamConfederation] = useState(CONFEDERATIONS[0]);
  
  const [editingTeam, setEditingTeam] = useState<NationalTeam | null>(null);
  const [editTeamName, setEditTeamName] = useState('');
  const [editTeamLogo, setEditTeamLogo] = useState('');
  const [editTeamConfederation, setEditTeamConfederation] = useState(CONFEDERATIONS[0]);
  
  const [confirmDemitirTeam, setConfirmDemitirTeam] = useState<NationalTeam | null>(null);
  const [editNameModalOpen, setEditNameModalOpen] = useState(false);
  const [customName, setCustomName] = useState('');

  // Drag and Drop Local State
  const [dndTeams, setDndTeams] = useState<NationalTeam[]>([]);
  const [draggingTeam, setDraggingTeam] = useState<NationalTeam | null>(null);
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 });

  // Global Settings state
  const [transferWindowOpen, setTransferWindowOpen] = useState(true);

  const [processing, setProcessing] = useState(false);

  const isAdmin = user?.email === 'gnferreira2000@gmail.com';

  useEffect(() => {
    if (!loading) {
      if (!user || user.email !== 'gnferreira2000@gmail.com') {
        navigate('/teams');
      }
    }
  }, [user, loading, userData, navigate]);

  useEffect(() => {
    const teamsCollectionRef = collection(db, 'national_teams');
    const unsubscribeTeams = onSnapshot(teamsCollectionRef, (snapshot) => {
      const teamsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as NationalTeam));
      teamsList.sort((a, b) => a.name.localeCompare(b.name));
      setTeams(teamsList);
    });

    const settingsRef = doc(db, 'settings', 'global');
    const unsubscribeSettings = onSnapshot(settingsRef, (docSnap) => {
      if (docSnap.exists()) {
        setTransferWindowOpen(docSnap.data().transferWindowOpen);
      }
    });

    return () => {
      unsubscribeTeams();
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
    if (!newTeamName.trim() || !newTeamLogo.trim() || !newTeamConfederation) return;
    setProcessing(true);
    try {
      const teamsCollectionRef = collection(db, 'national_teams');
      await addDoc(teamsCollectionRef, {
        name: newTeamName,
        logoUrl: newTeamLogo,
        confederation: newTeamConfederation,
        ownerId: null,
        ownerName: null,
        ownerPhoto: null,
        isActive: true
      });
      setNewTeamName('');
      setNewTeamLogo('');
      setNewTeamConfederation(CONFEDERATIONS[0]);
      setCreateTeamModalOpen(false);
    } catch (error) {
      console.error(error);
    }
    setProcessing(false);
  };

  const handleUpdateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeam || !editTeamName.trim() || !editTeamLogo.trim() || !editTeamConfederation) return;
    setProcessing(true);
    try {
      const teamRef = doc(db, 'national_teams', editingTeam.id);
      await updateDoc(teamRef, {
        name: editTeamName,
        logoUrl: editTeamLogo,
        confederation: editTeamConfederation
      });
      closeEditModal();
    } catch (error) {
      console.error(error);
    }
    setProcessing(false);
  };
  
  const openEditModal = (team: NationalTeam) => {
    setEditingTeam(team);
    setEditTeamName(team.name);
    setEditTeamLogo(team.logoUrl);
    setEditTeamConfederation(team.confederation || CONFEDERATIONS[0]);
  };
  
  const closeEditModal = () => {
    setEditingTeam(null);
    setEditTeamName('');
    setEditTeamLogo('');
    setEditTeamConfederation(CONFEDERATIONS[0]);
  };

  const toggleTransferWindow = async () => {
    setProcessing(true);
    try {
      const settingsRef = doc(db, 'settings', 'global');
      try {
        await updateDoc(settingsRef, { transferWindowOpen: !transferWindowOpen });
      } catch (err) {
        await setDoc(settingsRef, { transferWindowOpen: !transferWindowOpen });
      }
    } catch (e) {
      console.error(e);
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

  const handleAssumir = async (team: NationalTeam) => {
    if (processing || !userData) return;
    if (team.ownerId) return;
    if (!transferWindowOpen) return;

    try {
      const teamRef = doc(db, 'national_teams', team.id);
      const userRef = doc(db, 'users', userData.uid);
      updateDoc(teamRef, {
        ownerId: userData.uid,
        ownerName: userData.name,
        ownerPhoto: userData.photoURL || null
      });
      updateDoc(userRef, { nationalTeamId: team.id });
    } catch (error) {
      console.error(error);
    }
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

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim() || !userData) return;
    setProcessing(true);
    try {
      const userRef = doc(db, 'users', userData.uid);
      await updateDoc(userRef, { name: customName.trim() });
      
      if (userData.nationalTeamId) {
        const teamRef = doc(db, 'national_teams', userData.nationalTeamId);
        await updateDoc(teamRef, { ownerName: customName.trim() });
      }
      if (userData.teamId) {
          const clubRef = doc(db, 'teams', userData.teamId);
          await updateDoc(clubRef, { ownerName: customName.trim() });
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

  const handleDragStart = (e: React.DragEvent, team: NationalTeam) => {
    e.dataTransfer.setData('teamId', team.id);
    e.dataTransfer.effectAllowed = 'move';
    
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

  const saveManagedTeams = async () => {
    setProcessing(true);
    try {
      for (const t of dndTeams) {
        const original = teams.find(x => x.id === t.id);
        const originalIsActive = original?.isActive !== false;
        const newIsActive = t.isActive !== false;
        
        if (originalIsActive !== newIsActive) {
          const teamRef = doc(db, 'national_teams', t.id);
          await updateDoc(teamRef, { isActive: newIsActive });
          
          if (!newIsActive && t.ownerId) {
             const uRef = doc(db, 'users', t.ownerId);
             await updateDoc(teamRef, { ownerId: null, ownerName: null, ownerPhoto: null });
             await updateDoc(uRef, { nationalTeamId: null });
          }
        }
      }
      setManageTeamsModalOpen(false);
    } catch(e) {
      console.error(e);
    }
    setProcessing(false);
  };

  const handleDeleteUser = async (userId: string, currentTeamId: string | null) => {
    if (!isAdmin) return;
    const confirmDelete = window.confirm('Tem certeza que deseja excluir este usuário permanentemente do sistema?');
    if (!confirmDelete) return;
    
    setProcessing(true);
    try {
      if (currentTeamId) {
        await updateDoc(doc(db, 'national_teams', currentTeamId), { ownerId: null, ownerName: null, ownerPhoto: null });
      }
      const u = allUsers.find(u => u.id === userId);
      if (u?.teamId) {
          await updateDoc(doc(db, 'teams', u.teamId), { ownerId: null, ownerName: null, ownerPhoto: null });
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
      for (const userId of selectedUsers) {
        const u = allUsers.find(x => x.id === userId);
        if (u && u.nationalTeamId) {
          await updateDoc(doc(db, 'national_teams', u.nationalTeamId), { ownerId: null, ownerName: null, ownerPhoto: null });
        }
        if (u && u.teamId) {
          await updateDoc(doc(db, 'teams', u.teamId), { ownerId: null, ownerName: null, ownerPhoto: null });
        }
        await deleteDoc(doc(db, 'users', userId));
      }
      setSelectedUsers([]);
    } catch (e) {
      console.error(e);
    }
    setProcessing(false);
  };

  const handleSeedFIFATeams = async () => {
      const confirmSeed = window.confirm('Isso adicionará seleções da FIFA ao banco de dados. Deseja continuar?');
      if (!confirmSeed) return;

      setProcessing(true);
      const fifaTeams = [
          { name: 'Brasil', logoUrl: 'https://upload.wikimedia.org/wikipedia/pt/2/2b/Confedera%C3%A7%C3%A3o_Brasileira_de_Futebol_2019.svg', confederation: 'CONMEBOL' },
          { name: 'Argentina', logoUrl: 'https://upload.wikimedia.org/wikipedia/pt/7/7b/Asociaci%C3%B3n_del_F%C3%BAtbol_Argentino.svg', confederation: 'CONMEBOL' },
          { name: 'França', logoUrl: 'https://upload.wikimedia.org/wikipedia/pt/4/4e/F%C3%A9d%C3%A9ration_Fran%C3%A7aise_de_Football.svg', confederation: 'UEFA' },
          { name: 'Inglaterra', logoUrl: 'https://upload.wikimedia.org/wikipedia/pt/thumb/d/d3/The_Football_Association_crest.svg/1200px-The_Football_Association_crest.svg.png', confederation: 'UEFA' },
          { name: 'Espanha', logoUrl: 'https://upload.wikimedia.org/wikipedia/pt/3/30/Escudo_da_Sele%C3%A7%C3%A3o_Espanhola_de_Futebol.svg', confederation: 'UEFA' },
          { name: 'Itália', logoUrl: 'https://upload.wikimedia.org/wikipedia/pt/0/07/Federazione_Italiana_Giuoco_Calcio.svg', confederation: 'UEFA' },
          { name: 'Alemanha', logoUrl: 'https://upload.wikimedia.org/wikipedia/pt/thumb/e/e3/Deutscher_Fu%C3%9Fball-Bund_logo.svg/1200px-Deutscher_Fu%C3%9Fball-Bund_logo.svg.png', confederation: 'UEFA' },
          { name: 'Uruguai', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/d/df/Uruguay_football_association.svg', confederation: 'CONMEBOL' },
          { name: 'Portugal', logoUrl: 'https://upload.wikimedia.org/wikipedia/pt/f/f3/FPF_logo_2014.svg', confederation: 'UEFA' },
          { name: 'Holanda', logoUrl: 'https://upload.wikimedia.org/wikipedia/pt/c/c1/Royal_Dutch_Football_Association_logo.svg', confederation: 'UEFA' },
          { name: 'Estados Unidos', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/1/18/US_Soccer_Logo.svg', confederation: 'CONCACAF' },
          { name: 'México', logoUrl: 'https://upload.wikimedia.org/wikipedia/pt/5/53/Selecci%C3%B3n_de_f%C3%BAtbol_de_M%C3%A9xico.svg', confederation: 'CONCACAF' },
          { name: 'Japão', logoUrl: 'https://upload.wikimedia.org/wikipedia/en/e/e4/Japan_national_football_team_crest.svg', confederation: 'AFC' },
          { name: 'Senegal', logoUrl: 'https://upload.wikimedia.org/wikipedia/pt/8/87/F%C3%A9d%C3%A9ration_S%C3%A9n%C3%A9galaise_de_Football.svg', confederation: 'CAF' },
          { name: 'Marrocos', logoUrl: 'https://upload.wikimedia.org/wikipedia/en/2/23/Royal_Moroccan_Football_Federation_logo.svg', confederation: 'CAF' },
          { name: 'Nova Zelândia', logoUrl: 'https://upload.wikimedia.org/wikipedia/en/b/b3/New_Zealand_Football_logo.svg', confederation: 'OFC' }
      ];

      try {
          const colRef = collection(db, 'national_teams');
          for (const team of fifaTeams) {
              await addDoc(colRef, {
                  ...team,
                  ownerId: null,
                  ownerName: null,
                  ownerPhoto: null,
                  isActive: true
              });
          }
          alert('Seleções cadastradas com sucesso!');
      } catch (err) {
          console.error(err);
          alert('Erro ao cadastrar seleções.');
      }
      setProcessing(false);
  }

  if (loading || !userData) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
      </div>
    );
  }

  const hasTeam = !!userData.nationalTeamId;

  // Filter visible teams
  const visibleTeams = teams.filter(t => t.isActive !== false);

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="brand">
          <h1>Brasfoot FutNews</h1>
        </div>
        
        <div className="main-nav">
          <button className="nav-tab" onClick={() => navigate('/teams')}>Clubes</button>
          <button className="nav-tab active">Seleções</button>
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
            <h3>Painel de Controle (Seleções)</h3>
            <div className="admin-toolbar-buttons">
              <button 
                className="btn-secondary"
                onClick={() => setCreateTeamModalOpen(true)}
              >
                + Nova Seleção
              </button>
              <button 
                className="btn-secondary"
                onClick={openManageTeams}
              >
                Gerenciar Seleções
              </button>
              <button 
                className="btn-secondary"
                onClick={() => setManageUsersModalOpen(true)}
              >
                Gerenciar Treinadores
              </button>
              <button 
                className={transferWindowOpen ? "btn-danger" : "btn-primary"}
                onClick={toggleTransferWindow}
                disabled={processing}
              >
                {transferWindowOpen ? "Fechar Janela" : "Abrir Janela"}
              </button>
            </div>
          </div>
        </section>
      )}

      {!transferWindowOpen && (
        <div className="transfer-window-banner">
          ⚠️ <strong>Janela de Transferências Fechada!</strong> Contratações e demissões estão temporariamente suspensas.
        </div>
      )}

      <main className="teams-grid">
        {visibleTeams.map(team => {
          const isMyTeam = team.ownerId === userData.uid;
          const canInteractWithMarket = transferWindowOpen;
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
                  title="Editar Seleção"
                >
                  ✎
                </button>
              )}
              
              <div className="team-logo-container">
                <img src={team.logoUrl} alt={team.name} className="team-logo" />
              </div>
              
              <div className="team-name" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span>{team.name} {team.isActive === false && '(Inativo)'}</span>
                  {team.confederation && (
                    <span className={`confederation-badge confed-${team.confederation.toLowerCase()}`} style={{ marginTop: '4px' }}>
                      {team.confederation}
                    </span>
                  )}
              </div>
              
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
                  <div className="lock-icon" title={!transferWindowOpen ? "Janela de transferências fechada" : "Bloqueado"}>
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

      {/* --- MODALS --- */}

      {/* Modal Cadastrar Clube */}
      {createTeamModalOpen && (
        <div className="modal-overlay" onClick={() => setCreateTeamModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Cadastrar Nova Seleção</h3>
            <form onSubmit={handleCreateTeam} className="modal-form">
              <div className="input-group">
                <label>Nome da Seleção</label>
                <input 
                  type="text" 
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  disabled={processing}
                />
              </div>
              <div className="input-group">
                <label>URL do Escudo/Bandeira</label>
                <input 
                  type="text" 
                  value={newTeamLogo}
                  onChange={(e) => setNewTeamLogo(e.target.value)}
                  disabled={processing}
                />
              </div>
              <div className="input-group">
                <label>Confederação</label>
                <select 
                  value={newTeamConfederation} 
                  onChange={(e) => setNewTeamConfederation(e.target.value)}
                  disabled={processing}
                  className="confed-select"
                >
                  {CONFEDERATIONS.map(conf => (
                    <option key={conf} value={conf}>{conf}</option>
                  ))}
                </select>
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

      {/* Modal Edit Name */}
      {editNameModalOpen && (
        <div className="modal-overlay" onClick={() => setEditNameModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Editar Meu Nome</h3>
            <form onSubmit={handleUpdateName} className="modal-form">
              <div className="input-group">
                <label>Novo Nome</label>
                <input 
                  type="text" 
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  disabled={processing}
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setEditNameModalOpen(false)} disabled={processing}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" disabled={processing}>
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Edit Team */}
      {editingTeam && (
        <div className="modal-overlay" onClick={closeEditModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Editar Seleção</h3>
            <form onSubmit={handleUpdateTeam} className="modal-form">
              <div className="input-group">
                <label>Nome da Seleção</label>
                <input 
                  type="text" 
                  value={editTeamName}
                  onChange={(e) => setEditTeamName(e.target.value)}
                  disabled={processing}
                />
              </div>
              <div className="input-group">
                <label>URL do Escudo/Bandeira</label>
                <input 
                  type="text" 
                  value={editTeamLogo}
                  onChange={(e) => setEditTeamLogo(e.target.value)}
                  disabled={processing}
                />
              </div>
              <div className="input-group">
                <label>Confederação</label>
                <select 
                  value={editTeamConfederation} 
                  onChange={(e) => setEditTeamConfederation(e.target.value)}
                  disabled={processing}
                  className="confed-select"
                >
                  {CONFEDERATIONS.map(conf => (
                    <option key={conf} value={conf}>{conf}</option>
                  ))}
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={closeEditModal} disabled={processing}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" disabled={processing}>
                  Salvar Alterações
                </button>
              </div>
            </form>
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

      {/* Modal Gerenciar Seleções (Ativo/Inativo) */}
      {manageTeamsModalOpen && (
        <div className="modal-overlay" onClick={() => setManageTeamsModalOpen(false)}>
          <div className="modal-content large-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Gerenciar Seleções (Arraste e Solte)</h3>
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
                <h4>Seleções Ativas</h4>
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
                    <span>{team.name} {team.ownerName ? `(${team.ownerName})` : ''}</span>
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
                <h4>Seleções Inativas</h4>
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
                    <span>{team.name}</span>
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
                  left: dragPos.x + 10,
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
            <h3>Gerenciar Treinadores (Seleções)</h3>
            
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
                    <th>Seleção Atual</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {allUsers.map(u => {
                    const currentTeam = teams.find(t => t.id === u.nationalTeamId);
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
                        <td>{currentTeam ? currentTeam.name : 'Sem Seleção'}</td>
                        <td>
                          <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
                            {currentTeam && (
                              <button 
                                className="btn-danger btn-small"
                                onClick={() => handleForceResign(currentTeam)}
                                disabled={processing}
                                title="Remover da seleção"
                              >
                                Demitir
                              </button>
                            )}
                            <button 
                              className="btn-warn btn-small"
                              style={{ padding: '4px 8px', fontSize: '0.75rem', marginLeft: '4px', marginRight: '4px' }}
                              onClick={() => handleDeleteUser(u.id, u.nationalTeamId)}
                              disabled={processing}
                              title="Excluir Usuário"
                            >
                              Excluir
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {selectedUsers.length > 0 && (
              <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-start' }}>
                <button 
                  className="btn-warn"
                  onClick={handleBulkDeleteUsers}
                  disabled={processing}
                >
                  Excluir Selecionados ({selectedUsers.length})
                </button>
              </div>
            )}

            <div className="modal-actions" style={{ marginTop: '24px' }}>
              <button className="btn-primary" onClick={() => setManageUsersModalOpen(false)} disabled={processing}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NationalTeamsPage;
