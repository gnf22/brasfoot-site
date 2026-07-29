import React, { useEffect, useState } from 'react';
import { collection, addDoc, updateDoc, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import TournamentsView from '../components/TournamentsView';
import { SeasonData, NewsItem, updateSeasonYear, createNewsItem, getRandomTransferNews, getRandomResignationNews, getAdminExpulsionNews, calculateGoalXP, formatGoalName } from '../services/seasonService';
import NewsFeed from '../components/NewsFeed';
import SeasonEndModal from '../components/SeasonEndModal';
import SeasonReportModal from '../components/SeasonReportModal';
import RenewalModal from '../components/RenewalModal';
import ClubDetailsModal from '../components/ClubDetailsModal';
import AlertModal, { AlertMessage } from '../components/AlertModal';
import { teamsCache, nationalTeamsCache, usersCache, globalSettingsCache, seasonCache, newsCache } from '../services/cacheService';

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
  interestedUsers?: string[];
  contractYears?: number; // 1, 2, or 3
  defaultContractYears?: number; // time offered for new contracts
  contractStartYear?: number;
  goals?: {
    serieA?: string;
    serieB?: string;
    copaBrasil?: string;
    internacional?: string;
  };
}

const TeamsPage: React.FC = () => {
  const { user, userData, loading, logout } = useAuth();
  const navigate = useNavigate();
  const [alertMsg, setAlertMsg] = useState<AlertMessage | null>(null);
  const [currentView, setCurrentView] = useState<'clubes' | 'world_cup' | 'euro_copa'>('clubes');
  const [teams, setTeams] = useState<Team[]>([]);
  const [nationalTeams, setNationalTeams] = useState<Team[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  
  // Season and News State
  const [season, setSeason] = useState<SeasonData>({ currentYear: 2026, status: 'ongoing' });
  const [news, setNews] = useState<NewsItem[]>([]);
  const [seasonEndModalOpen, setSeasonEndModalOpen] = useState(false);
  const [globoEsporteModalOpen, setGloboEsporteModalOpen] = useState(false);
  const [selectedNewsArticle, setSelectedNewsArticle] = useState<NewsItem | null>(null);

  // States for Modals
  const [createTeamModalOpen, setCreateTeamModalOpen] = useState(false);
  const [manageTeamsModalOpen, setManageTeamsModalOpen] = useState(false);
  const [manageUsersModalOpen, setManageUsersModalOpen] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [coachSearchTerm, setCoachSearchTerm] = useState('');
  
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamLogo, setNewTeamLogo] = useState('');
  const [newTeamColor, setNewTeamColor] = useState('#334155');
  const [newTeamSecondaryColor, setNewTeamSecondaryColor] = useState('#ffffff');
  
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [editTeamName, setEditTeamName] = useState('');
  const [editTeamLogo, setEditTeamLogo] = useState('');
  const [editTeamColor, setEditTeamColor] = useState('#334155');
  const [editTeamSecondaryColor, setEditTeamSecondaryColor] = useState('#ffffff');
  const [editContractYears, setEditContractYears] = useState<number>(2);
  const [editGoalSerieA, setEditGoalSerieA] = useState<string>('Permanecer');
  const [editGoalSerieB, setEditGoalSerieB] = useState<string>('Subir');
  const [editGoalCopaBrasil, setEditGoalCopaBrasil] = useState<string>('Quartas de Final');
  const [editGoalInternacional, setEditGoalInternacional] = useState<string>('Fase de Grupos');
  const [editClubStatus, setEditClubStatus] = useState<'Grande' | 'Médio' | 'Pequeno'>('Grande');
  const [selectedClubForDetails, setSelectedClubForDetails] = useState<Team | null>(null);

  const getEditOptionLabel = (comp: any, val: string) => {
    if (val === 'Nenhuma') return '- Nenhuma -';
    const res = calculateGoalXP(comp, val, editClubStatus);
    const text = formatGoalName(val);
    return `${text} (${res.xp >= 0 ? '+' : ''}${res.xp} pts)`;
  };
  
  const [confirmDemitirTeam, setConfirmDemitirTeam] = useState<Team | null>(null);
  const [editNameModalOpen, setEditNameModalOpen] = useState(false);
  const [customName, setCustomName] = useState('');

  // Drag and Drop Local State
  const [dndTeams, setDndTeams] = useState<Team[]>([]);
  const [draggingTeam, setDraggingTeam] = useState<Team | null>(null);
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 });

  // Global Settings state
  const [processing, setProcessing] = useState(false);
  const [pendingAssumir, setPendingAssumir] = useState<string | null>(null);
  const [transferWindows, setTransferWindows] = useState<Record<string, boolean>>({});

  const isAdmin = user?.email === 'gnferreira2000@gmail.com';
  const isMarketOpen = transferWindows[currentView] ?? true;

  const getDivision = (team: Team): 'A' | 'B' | 'NONE' => {
    if (team.division) return team.division;
    return team.isActive === false ? 'NONE' : 'A';
  };


  useEffect(() => {
    if (!loading && !user) {
      navigate('/');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    const unsubscribeTeams = teamsCache.subscribe((teamsList) => {
      setTeams(teamsList);
    });

    const unsubscribeNational = nationalTeamsCache.subscribe((list) => {
      setNationalTeams(list);
    });

    const unsubscribeSettings = globalSettingsCache.subscribe((data) => {
      setTransferWindows({
        clubes: data.transferWindowOpen_clubes ?? true,
        world_cup: data.transferWindowOpen_world_cup ?? true,
        euro_copa: data.transferWindowOpen_euro_copa ?? true,
      });
      if (data.activeView) {
        setCurrentView(data.activeView);
      }
    });

    const unsubscribeSeason = seasonCache.subscribe((s) => setSeason(s));
    const unsubscribeNews = newsCache.subscribe((list) => setNews(list));
    const unsubscribeUsers = usersCache.subscribe((list) => {
      setAllUsers(list);
    });

    return () => {
      unsubscribeTeams();
      unsubscribeNational();
      unsubscribeSettings();
      unsubscribeSeason();
      unsubscribeNews();
      unsubscribeUsers();
    };
  }, []);

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim() || !newTeamLogo.trim()) return;
    setProcessing(true);
    try {
      const teamsCollectionRef = collection(db, 'teams');
      await addDoc(teamsCollectionRef, {
        name: newTeamName,
        logoUrl: newTeamLogo,
        color: newTeamColor,
        secondaryColor: newTeamSecondaryColor,
        ownerId: null,
        ownerName: null,
        ownerPhoto: null,
        isActive: true,
        contractYears: 2,
        contractStartYear: season.currentYear,
        clubStatus: 'Grande',
        goals: {
          serieA: 'Permanecer',
          serieB: 'Subir',
          copaBrasil: 'Quartas',
          internacional: 'Fase de Grupos',
        }
      });
      setNewTeamName('');
      setNewTeamLogo('');
      setNewTeamColor('#334155');
      setNewTeamSecondaryColor('#ffffff');
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
      const updateData: any = {
        name: editTeamName,
        logoUrl: editTeamLogo,
        color: editTeamColor,
        secondaryColor: editTeamSecondaryColor,
        defaultContractYears: editContractYears,
        clubStatus: editClubStatus,
        goals: {
          serieA: editGoalSerieA,
          serieB: editGoalSerieB,
          copaBrasil: editGoalCopaBrasil,
          internacional: editGoalInternacional,
        }
      };
      if (!editingTeam.ownerId) {
        updateData.contractYears = editContractYears;
      }
      const teamRef = doc(db, 'teams', editingTeam.id);
      await updateDoc(teamRef, updateData);
      closeEditModal();
    } catch (error) {
      console.error(error);
    }
    setProcessing(false);
  };

  const handleEyeDropper = async (setter: React.Dispatch<React.SetStateAction<string>>) => {
    if ('EyeDropper' in window) {
      try {
        const eyeDropper = new (window as any).EyeDropper();
        const result = await eyeDropper.open();
        setter(result.sRGBHex);
      } catch (e) {
        console.log('EyeDropper cancelled or failed', e);
      }
    } else {
      setAlertMsg({ title: 'Aviso', message: 'Seu navegador não suporta a ferramenta de conta-gotas.', type: 'warning' });
    }
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
    setEditTeamColor(team.color || '#334155');
    setEditTeamSecondaryColor(team.secondaryColor || '#ffffff');
    setEditContractYears(team.defaultContractYears || team.contractYears || 2);
    setEditClubStatus(team.clubStatus || 'Grande');
    setEditGoalSerieA(formatGoalName(team.goals?.serieA || 'Permanecer'));
    setEditGoalSerieB(formatGoalName(team.goals?.serieB || 'Subir'));
    setEditGoalCopaBrasil(formatGoalName(team.goals?.copaBrasil || 'Quartas de Final'));
    setEditGoalInternacional(formatGoalName(team.goals?.internacional || 'Fase de Grupos'));
  };
  
  const closeEditModal = () => {
    setEditingTeam(null);
    setEditTeamName('');
    setEditTeamLogo('');
  };

  const handleResetAllPrestigeAndContracts = async () => {
    if (!isAdmin) return;
    const confirmReset = window.confirm(
      'Deseja redefinir o prestígio de TODOS os treinadores para 100/100 e padronizar o tempo de contrato de TODOS os times com técnico para 2 anos de duração (iniciando em ' + season.currentYear + ')?'
    );
    if (!confirmReset) return;

    setProcessing(true);
    try {
      for (const u of allUsers) {
        if (u.id) {
          const userRef = doc(db, 'users', u.id);
          await updateDoc(userRef, { prestige: 100 });
        }
      }

      for (const t of teams) {
        if (t.ownerId) {
          const teamRef = doc(db, 'teams', t.id);
          await updateDoc(teamRef, {
            contractYears: 2,
            contractStartYear: season.currentYear,
          });
        }
      }

      for (const nt of nationalTeams) {
        if (nt.ownerId) {
          const ntRef = doc(db, 'national_teams', nt.id);
          await updateDoc(ntRef, {
            contractYears: 2,
            contractStartYear: season.currentYear,
          });
        }
      }

      setAlertMsg({
        title: 'Sucesso',
        message: 'O prestígio de todos os treinadores foi redefinido para 100/100 e os contratos de todos os times com técnico foram padronizados para 2 anos!',
        type: 'success',
      });
    } catch (error) {
      console.error('Erro ao padronizar:', error);
      setAlertMsg({
        title: 'Erro',
        message: 'Ocorreu um erro ao padronizar o prestígio e os contratos.',
        type: 'error',
      });
    }
    setProcessing(false);
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

      if (team.ownerName) {
        const ownerObj = allUsers.find(u => u.id === team.ownerId);
        const newsItem = getAdminExpulsionNews(
          team.ownerName,
          team.name,
          season.currentYear,
          {
            coachPhotoUrl: team.ownerPhoto || ownerObj?.photoURL || undefined,
            teamLogoUrl: team.logoUrl,
            prestige: ownerObj?.prestige
          }
        );
        await createNewsItem(newsItem);
      }
    } catch (error) {
      console.error(error);
    }
    setProcessing(false);
  };

  const handleDeclararInteresse = async (team: Team) => {
    if (processing || !userData) return;
    if (team.ownerId || !isMarketOpen) return;
    
    if (userData.teamId) {
      setAlertMsg({ title: 'Atenção', message: 'Você precisa se demitir do seu clube atual antes de declarar interesse em outro.', type: 'warning' });
      return;
    }

    // Check if user already declared interest in another team
    if (userData.declaredInterestTeamId && userData.declaredInterestTeamId !== team.id) {
      setAlertMsg({ title: 'Atenção', message: 'Você já declarou interesse em outro time. Cancele o interesse anterior primeiro.', type: 'warning' });
      return;
    }

    try {
      setPendingAssumir(team.id);
      const coll = currentView === 'clubes' ? 'teams' : 'national_teams';
      const teamRef = doc(db, coll, team.id);
      const userRef = doc(db, 'users', userData.uid);

      // Using transaction or just sequential updates. ArrayUnion would be best but requires import.
      // We'll just fetch latest team or use array spread if we had it, but since we are just adding an ID, let's just append locally and update.
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

  const handleCancelarInteresse = async (team: Team) => {
    if (processing || !userData) return;
    try {
      setPendingAssumir(team.id);
      const coll = currentView === 'clubes' ? 'teams' : 'national_teams';
      const teamRef = doc(db, coll, team.id);
      const userRef = doc(db, 'users', userData.uid);

      const currentInterested = team.interestedUsers || [];
      const updatedInterested = currentInterested.filter(id => id !== userData.uid);
      
      await updateDoc(teamRef, { interestedUsers: updatedInterested });
      await updateDoc(userRef, { declaredInterestTeamId: null });
      setPendingAssumir(null);
    } catch (error) {
      console.error(error);
      setPendingAssumir(null);
    }
  };

  const handleAdminAddInterest = async (team: Team, userId: string) => {
    if (!isAdmin) return;
    setProcessing(true);
    try {
      const coll = currentView === 'clubes' ? 'teams' : 'national_teams';
      const teamRef = doc(db, coll, team.id);
      const userRef = doc(db, 'users', userId);

      const userObj = allUsers.find(u => u.id === userId);
      if (userObj?.declaredInterestTeamId && userObj.declaredInterestTeamId !== team.id) {
        const oldTeamRef = doc(db, coll, userObj.declaredInterestTeamId);
        const oldTeam = currentView === 'clubes' ? teams.find(t => t.id === userObj.declaredInterestTeamId) : nationalTeams.find(t => t.id === userObj.declaredInterestTeamId);
        if (oldTeam) {
          const oldList = oldTeam.interestedUsers || [];
          await updateDoc(oldTeamRef, { interestedUsers: oldList.filter(id => id !== userId) });
        }
      }

      const currentInterested = team.interestedUsers || [];
      if (!currentInterested.includes(userId)) {
        await updateDoc(teamRef, { interestedUsers: [...currentInterested, userId] });
      }
      await updateDoc(userRef, { declaredInterestTeamId: team.id });
    } catch (error) {
      console.error(error);
      setAlertMsg({ title: 'Erro', message: 'Erro ao adicionar interesse.', type: 'error' });
    }
    setProcessing(false);
  };

  const handleAprovarUnico = async (team: Team) => {
    if (!isAdmin || !team.interestedUsers || team.interestedUsers.length !== 1) return;
    
    setProcessing(true);
    try {
      const coll = currentView === 'clubes' ? 'teams' : 'national_teams';
      const userField = currentView === 'clubes' ? 'teamId' : 'nationalTeamId';
      const teamRef = doc(db, coll, team.id);
      
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
            interestedUsers: [],
            contractStartYear: season.currentYear,
            contractYears: team.defaultContractYears || team.contractYears || 2
        }),
        updateDoc(userRef, { 
          [userField]: team.id,
          declaredInterestTeamId: null
        })
      ]);

      try {
        const newsItem = getRandomTransferNews(
          winnerUserObj.name || 'Treinador',
          team.name || 'Clube',
          season?.currentYear || new Date().getFullYear() || 2026,
          {
            coachPhotoUrl: winnerUserObj.photoURL || undefined,
            teamLogoUrl: team.logoUrl || undefined,
            prestige: winnerUserObj.prestige ?? 70
          }
        );
        await createNewsItem(newsItem);
        console.log("Notícia de transferência criada com sucesso:", newsItem);
      } catch (newsError) {
        console.error("Erro ao criar notícia de assinar (TeamsPage handleAprovarUnico):", newsError);
      }
    } catch (error: any) {
      console.error(error);
      setAlertMsg({ title: 'Erro', message: 'Erro ao aprovar treinador.', type: 'error' });
    }
    setProcessing(false);
  };

  const handleIniciarSorteio = async (team: Team) => {
    if (!isAdmin || !team.interestedUsers || team.interestedUsers.length < 2) return;
    setProcessing(true);
    try {
      const participants = team.interestedUsers.map(uid => {
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
        collectionType: currentView === 'clubes' ? 'teams' : 'national_teams'
      });
    } catch (error) {
      console.error(error);
    }
    setProcessing(false);
  };

  const executeDemitir = async () => {
    if (!userData || !confirmDemitirTeam) return;
    if (!isMarketOpen) return;

    setProcessing(true);
    try {
      const coll = currentView === 'clubes' ? 'teams' : 'national_teams';
      const userField = currentView === 'clubes' ? 'teamId' : 'nationalTeamId';
      const teamRef = doc(db, coll, confirmDemitirTeam.id);
      const userRef = doc(db, 'users', userData.uid);
      
      await Promise.all([
        updateDoc(teamRef, {
          ownerId: null,
          ownerName: null,
          ownerPhoto: null
        }),
        updateDoc(userRef, { [userField]: null })
      ]);

      if (currentView === 'clubes') {
        createNewsItem(
          getRandomResignationNews(userData.name, confirmDemitirTeam.name, season.currentYear, {
            coachPhotoUrl: userData.photoURL || '',
            teamLogoUrl: confirmDemitirTeam.logoUrl || '',
            prestige: userData.prestige ?? 70
          })
        );
      }
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

  const handleDrop = (e: React.DragEvent, division: 'A' | 'B' | 'NONE') => {
    e.preventDefault();
    const teamId = e.dataTransfer.getData('teamId');
    setDndTeams(prev => prev.map(t => t.id === teamId ? { ...t, division } : t));
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
        const originalDiv = original ? getDivision(original) : 'NONE';
        const newDiv = getDivision(t);
        
        if (originalDiv !== newDiv) {
          const teamRef = doc(db, 'teams', t.id);
          const isActive = newDiv !== 'NONE';
          await updateDoc(teamRef, { division: newDiv, isActive });
          
          if (!isActive && t.ownerId) {
             // Forçar demissão se inativar o time ocupado
             const uRef = doc(db, 'users', t.ownerId);
             await updateDoc(teamRef, { ownerId: null, ownerName: null, ownerPhoto: null, isActive: false, division: newDiv });
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
          try {
            const newsItem = getRandomTransferNews(
              userObj.name || 'Treinador',
              targetTeam.name || 'Clube',
              season?.currentYear || new Date().getFullYear() || 2026,
              {
                coachPhotoUrl: userObj.photoURL || undefined,
                teamLogoUrl: targetTeam.logoUrl || undefined,
                prestige: userObj.prestige ?? 70
              }
            );
            await createNewsItem(newsItem);
          } catch (ne) {
            console.error("Erro ao gerar notícia de transferência no reassign:", ne);
          }
          await updateDoc(doc(db, coll, newTeamId), { ownerId: userId, ownerName: userObj.name, ownerPhoto: userObj.photoURL || null });
          await updateDoc(userRef, { [userField]: newTeamId });
       } else if (newTeamId === 'remove') {
          if (currentTeamId && userObj) {
            const sourceTeam = sourceTeams.find(t => t.id === currentTeamId);
            try {
              const newsItem = getRandomResignationNews(
                userObj.name || 'Treinador',
                sourceTeam?.name || 'Clube',
                season?.currentYear || new Date().getFullYear() || 2026,
                {
                  coachPhotoUrl: userObj.photoURL || undefined,
                  teamLogoUrl: sourceTeam?.logoUrl || undefined,
                  prestige: userObj.prestige ?? 70
                }
              );
              await createNewsItem(newsItem);
            } catch (ne) {
              console.error("Erro ao gerar notícia de saída no reassign:", ne);
            }
          }
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
      const allTeamsList = [...teams, ...nationalTeams];
      if (currentTeamId) {
        const t = allTeamsList.find((tm: Team) => tm.id === currentTeamId);
        const u = allUsers.find(x => x.id === userId);
        await updateDoc(doc(db, coll, currentTeamId), { ownerId: null, ownerName: null, ownerPhoto: null });
        if (t && u) {
          const newsItem = getAdminExpulsionNews(
            u.name,
            t.name,
            season.currentYear,
            {
              coachPhotoUrl: u.photoURL || undefined,
              teamLogoUrl: t.logoUrl,
              prestige: u.prestige
            }
          );
          await createNewsItem(newsItem);
        }
      }
      await deleteDoc(doc(db, 'users', userId));
      setSelectedUsers(prev => prev.filter(id => id !== userId));
    } catch (e) {
      console.error(e);
    }
    setProcessing(false);
  };

  const handleBulkFireUsers = async () => {
    if (!isAdmin || selectedUsers.length === 0) return;
    const confirmFire = window.confirm(`Tem certeza que deseja demitir os ${selectedUsers.length} treinadores selecionados?`);
    if (!confirmFire) return;
    
    setProcessing(true);
    try {
      const coll = currentView === 'clubes' ? 'teams' : 'national_teams';
      const userField = currentView === 'clubes' ? 'teamId' : 'nationalTeamId';
      const allTeamsList = [...teams, ...nationalTeams];
      for (const userId of selectedUsers) {
        const u = allUsers.find(x => x.id === userId);
        if (u && u[userField]) {
          const t = allTeamsList.find((tm: Team) => tm.id === u[userField]);
          await updateDoc(doc(db, coll, u[userField]), { ownerId: null, ownerName: null, ownerPhoto: null });
          await updateDoc(doc(db, 'users', userId), { [userField]: null });
          if (t) {
            const newsItem = getAdminExpulsionNews(
              u.name,
              t.name,
              season.currentYear,
              {
                coachPhotoUrl: u.photoURL || undefined,
                teamLogoUrl: t.logoUrl,
                prestige: u.prestige
              }
            );
            await createNewsItem(newsItem);
          }
        }
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

      {currentView === 'clubes' && (
        <div className="season-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--card-bg)', padding: '0.75rem 1.5rem', borderBottom: '1px solid var(--border-color)', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>
              🏆 Temporada {season.currentYear}
            </span>
            {isAdmin && (
              <div style={{ display: 'flex', gap: '4px' }}>
                <button 
                  className="btn-secondary btn-small"
                  onClick={() => updateSeasonYear(season.currentYear - 1)}
                  title="Ano anterior"
                >
                  -1 Ano
                </button>
                <button 
                  className="btn-secondary btn-small"
                  onClick={() => updateSeasonYear(season.currentYear + 1)}
                  title="Próximo ano"
                >
                  +1 Ano
                </button>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-color)', padding: '4px 12px', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Meu Prestígio:</span>
              <strong style={{ color: (userData.prestige ?? 100) < 70 ? 'var(--danger-color)' : 'var(--primary-color)' }}>
                {userData.prestige ?? 100}/100
              </strong>
            </div>

            {isAdmin && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <button 
                  className="btn-primary"
                  style={{ background: '#3b82f6', color: '#fff', fontWeight: 'bold', padding: '6px 14px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontSize: '0.85rem' }}
                  onClick={handleResetAllPrestigeAndContracts}
                  title="Redefinir prestígio de todos para 100/100 e contrato dos clubes para 2 anos"
                  disabled={processing}
                >
                  🔄 Padronizar Prestígio e Contratos
                </button>
                <button 
                  className="btn-primary"
                  style={{ background: '#eab308', color: '#000', fontWeight: 'bold', padding: '6px 16px', borderRadius: '20px', border: 'none', cursor: 'pointer' }}
                  onClick={() => setSeasonEndModalOpen(true)}
                >
                  Encerrar Temporada
                </button>
              </div>
            )}
          </div>
        </div>
      )}

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
        <div className="divisions-container">
          {(['A', 'B'] as const).map(division => {
            const divisionTeams = teams.filter(t => getDivision(t) === division);
            if (divisionTeams.length === 0 && !isAdmin) return null;
            
            return (
              <div key={division} className="division-section">
                <h2 className="division-title" style={{ marginTop: division === 'A' ? '1rem' : '2rem', marginBottom: '1rem', color: 'var(--primary-color)' }}>
                  Série {division}
                </h2>
                <main className="teams-grid">
                  {divisionTeams.map(team => {
                    const isMyTeam = team.ownerId === userData.uid;
                    const canInteractWithMarket = isMarketOpen;
                    const hasDeclaredInterest = userData.declaredInterestTeamId === team.id;
                    const hasDeclaredInterestAny = !!userData.declaredInterestTeamId;
                    const isAvailable = !team.ownerId && !hasDeclaredInterestAny && canInteractWithMarket && !userData.teamId;
                    const isTakenByOther = team.ownerId && !isMyTeam;
                    const interestedList = team.interestedUsers || [];
                    
                    let cardClass = 'team-card';
                    if (isAvailable || hasDeclaredInterest) cardClass += ' available';
                    if (isMyTeam) cardClass += ' my-team';
                    if (isTakenByOther) cardClass += ' taken-other';
                    if (!team.ownerId && !isAvailable && !hasDeclaredInterest) cardClass += ' unavailable'; 
                    if (isAdmin && team.isActive === false) cardClass += ' inactive-team';

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
                        onClick={() => setSelectedClubForDetails(team)}
                        style={{ ...dynamicStyle, cursor: 'pointer' }}
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
                        {team.clubStatus && (
                          <div style={{ marginTop: '3px', marginBottom: '4px' }}>
                            <span style={{
                              background: team.clubStatus === 'Grande' ? '#3b82f6' : (team.clubStatus === 'Médio' ? '#10b981' : '#64748b'),
                              color: '#fff',
                              padding: '2px 8px',
                              borderRadius: '10px',
                              fontSize: '0.65rem',
                              fontWeight: 'bold',
                              textTransform: 'uppercase'
                            }}>
                              {team.clubStatus}
                            </span>
                          </div>
                        )}
                        
                        <div className="team-status-area">
                          {!team.ownerId && isAvailable && (
                            <button 
                              className="btn-secondary" 
                              style={{ padding: '6px 16px', fontSize: '0.85rem', marginTop: '4px', borderRadius: '20px' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeclararInteresse(team);
                              }}
                            >
                              Declarar Interesse
                            </button>
                          )}

                          {!team.ownerId && hasDeclaredInterest && (
                            <button 
                              className="btn-danger" 
                              style={{ padding: '8px 16px', borderRadius: '24px', fontSize: '0.85rem' }}
                              onClick={(e) => { e.stopPropagation(); handleCancelarInteresse(team); }}
                            >
                              Cancelar Interesse
                            </button>
                          )}
                          
                          {!team.ownerId && !isAvailable && !hasDeclaredInterest && !isAdmin && (
                            <div className="lock-icon" title={!isMarketOpen ? "Janela de transferências fechada" : "Bloqueado"}>
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                            </div>
                          )}
                          
                          {team.ownerId && (
                            <>
                              <div className="owner-pill" style={ownerPillStyle}>
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
                              {currentView === 'clubes' && (
                                <div style={{ display: 'flex', gap: '6px', marginTop: '4px', fontSize: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                                  {(() => {
                                    const startYear = team.contractStartYear || season.currentYear;
                                    const years = team.contractYears || 2;
                                    const yearsLeft = Math.max(0, startYear + years - season.currentYear);
                                    const ownerObj = allUsers.find(u => u.id === team.ownerId);
                                    const xp = ownerObj?.prestige ?? 100;
                                    return (
                                      <>
                                        <span style={{ background: 'var(--bg-color)', padding: '2px 8px', borderRadius: '10px', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                                          Contrato: <strong style={{ color: yearsLeft === 0 ? 'var(--danger-color)' : 'var(--primary-color)' }}>{yearsLeft === 0 ? 'Expirado' : `${yearsLeft} ${yearsLeft === 1 ? 'ano' : 'anos'}`}</strong>
                                        </span>
                                        <span style={{ background: 'var(--bg-color)', padding: '2px 8px', borderRadius: '10px', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                                          Prestígio: <strong style={{ color: xp < 70 ? 'var(--danger-color)' : 'var(--primary-color)' }}>{xp}/100</strong>
                                        </span>
                                      </>
                                    );
                                  })()}
                                </div>
                              )}
                            </>
                          )}
                          
                          {isMyTeam && (
                            canInteractWithMarket ? (
                              pendingAssumir === team.id ? (
                                <span style={{ marginTop: '8px', fontSize: '0.8rem', color: '#888' }}>Processando...</span>
                              ) : (
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
                              )
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

                          {!team.ownerId && interestedList.length > 0 && (
                            <div style={{ marginTop: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '8px', width: '100%' }}>
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '8px', textAlign: 'center' }}>
                                Interessados ({interestedList.length}):
                              </div>
                              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: isAdmin ? '8px' : '0' }}>
                                {interestedList.map(uid => {
                                  const u = allUsers.find(x => x.id === uid);
                                  if (!u) return null;
                                  return (
                                    <div key={uid} title={u.name} style={{ display: 'flex', alignItems: 'center' }}>
                                      {u.photoURL ? (
                                        <img src={u.photoURL} alt={u.name} style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
                                      ) : (
                                        <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--primary-color)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem' }}>
                                          {u.name.charAt(0).toUpperCase()}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                              
                              {isAdmin && (
                                <>
                                  {interestedList.length === 1 ? (
                                    <button 
                                      className="btn-primary btn-small" 
                                      onClick={(e) => { e.stopPropagation(); handleAprovarUnico(team); }}
                                      style={{ width: '100%', fontSize: '0.8rem', padding: '6px' }}
                                    >
                                      Aprovar Treinador
                                    </button>
                                  ) : (
                                    <button 
                                      className="btn-primary btn-small" 
                                      onClick={(e) => { e.stopPropagation(); handleIniciarSorteio(team); }}
                                      style={{ width: '100%', fontSize: '0.8rem', padding: '6px', backgroundColor: '#eab308', color: '#000' }}
                                    >
                                      Definir treinador
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </main>
              </div>
            );
          })}

          <NewsFeed
            news={news}
            isAdmin={isAdmin}
            onOpenReport={(item) => {
              setSelectedNewsArticle(item);
              setGloboEsporteModalOpen(true);
            }}
          />
        </div>
      ) : (
        <TournamentsView type={currentView as 'world_cup' | 'euro_copa'} />
      )}

      {/* --- MODALS --- */}

      <ClubDetailsModal
        team={selectedClubForDetails}
        currentYear={season.currentYear}
        allUsers={allUsers}
        isAdmin={isAdmin}
        isMyTeam={!!selectedClubForDetails && selectedClubForDetails.ownerId === userData?.uid}
        isAvailable={!!selectedClubForDetails && !selectedClubForDetails.ownerId && selectedClubForDetails.isActive !== false && isMarketOpen && !userData?.teamId && !userData?.declaredInterestTeamId}
        hasDeclaredInterest={!!selectedClubForDetails && userData?.declaredInterestTeamId === selectedClubForDetails.id}
        canInteractWithMarket={isMarketOpen}
        onClose={() => setSelectedClubForDetails(null)}
        onDeclareInterest={handleDeclararInteresse}
        onCancelInterest={handleCancelarInteresse}
        onAdminAddInterest={handleAdminAddInterest}
        onResign={(t) => setConfirmDemitirTeam(t)}
        onEdit={(t) => { setSelectedClubForDetails(null); openEditModal(t); }}
      />

      {seasonEndModalOpen && (
        <SeasonEndModal
          teams={teams}
          allUsers={allUsers}
          season={season}
          onClose={() => setSeasonEndModalOpen(false)}
          onSeasonClosed={(report) => {
            setSelectedNewsArticle(report);
            setGloboEsporteModalOpen(true);
          }}
        />
      )}

      {globoEsporteModalOpen && (
        <SeasonReportModal
          report={selectedNewsArticle}
          teams={teams}
          allUsers={allUsers}
          onClose={() => {
            setGloboEsporteModalOpen(false);
            setSelectedNewsArticle(null);
          }}
        />
      )}

      {userData && (
        <RenewalModal
          userData={userData}
          season={season}
          onClose={() => {}}
        />
      )}

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
                {newTeamLogo && (
                  <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <img src={newTeamLogo} alt="Preview" style={{ width: 60, height: 60, objectFit: 'contain' }} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Cor Primária</label>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <input 
                          type="color" 
                          value={newTeamColor} 
                          onChange={(e) => setNewTeamColor(e.target.value)} 
                          style={{ width: '40px', height: '40px', padding: '0', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                        />
                        <button 
                          type="button" 
                          className="btn-secondary btn-small" 
                          onClick={() => handleEyeDropper(setNewTeamColor)}
                          title="Usar conta-gotas"
                        >
                          Puxar
                        </button>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Cor Secundária</label>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <input 
                          type="color" 
                          value={newTeamSecondaryColor} 
                          onChange={(e) => setNewTeamSecondaryColor(e.target.value)} 
                          style={{ width: '40px', height: '40px', padding: '0', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                        />
                        <button 
                          type="button" 
                          className="btn-secondary btn-small" 
                          onClick={() => handleEyeDropper(setNewTeamSecondaryColor)}
                          title="Usar conta-gotas"
                        >
                          Puxar
                        </button>
                      </div>
                    </div>
                  </div>
                )}
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
              {/* Coluna Série A */}
              <div 
                className="dnd-column dnd-column-active"
                onDrop={(e) => handleDrop(e, 'A')}
                onDragOver={handleDragOver}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
              >
                <h4>Série A</h4>
                {dndTeams.filter(t => getDivision(t) === 'A').map(team => (
                  <div 
                    key={team.id} 
                    className="dnd-item"
                    draggable
                    onDragStart={(e) => handleDragStart(e, team)}
                    onDrag={handleDrag}
                    onDragEnd={handleDragEnd}
                  >
                    <img src={team.logoUrl} alt={team.name} />
                    <span style={{flex: 1}}>
                      {team.name}
                      {team.ownerName && <small>{team.ownerName}</small>}
                    </span>
                  </div>
                ))}
              </div>

              {/* Coluna Série B */}
              <div 
                className="dnd-column dnd-column-active"
                onDrop={(e) => handleDrop(e, 'B')}
                onDragOver={handleDragOver}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
              >
                <h4>Série B</h4>
                {dndTeams.filter(t => getDivision(t) === 'B').map(team => (
                  <div 
                    key={team.id} 
                    className="dnd-item"
                    draggable
                    onDragStart={(e) => handleDragStart(e, team)}
                    onDrag={handleDrag}
                    onDragEnd={handleDragEnd}
                  >
                    <img src={team.logoUrl} alt={team.name} />
                    <span style={{flex: 1}}>
                      {team.name}
                      {team.ownerName && <small>{team.ownerName}</small>}
                    </span>
                  </div>
                ))}
              </div>

              {/* Coluna Inativos */}
              <div 
                className="dnd-column dnd-column-inactive"
                onDrop={(e) => handleDrop(e, 'NONE')}
                onDragOver={handleDragOver}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
              >
                <h4>Não Exibidos</h4>
                {dndTeams.filter(t => getDivision(t) === 'NONE').map(team => (
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
      {manageUsersModalOpen && (() => {
        const filteredUsers = allUsers.filter(u => 
          (u.name || '').toLowerCase().includes(coachSearchTerm.toLowerCase()) || 
          (u.email || '').toLowerCase().includes(coachSearchTerm.toLowerCase())
        );

        return (
        <div className="modal-overlay" onClick={() => { setManageUsersModalOpen(false); setCoachSearchTerm(''); }}>
          <div className="modal-content large-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Gerenciar Treinadores</h3>
            
            <div style={{ marginBottom: '15px' }}>
              <input
                type="text"
                placeholder="Buscar treinador..."
                value={coachSearchTerm}
                onChange={(e) => setCoachSearchTerm(e.target.value)}
                className="modal-input"
                style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}
              />
            </div>

            <div className="user-list">
              <div className="user-list-header">
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={filteredUsers.length > 0 && selectedUsers.length === filteredUsers.length}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedUsers(filteredUsers.map(u => u.id));
                      else setSelectedUsers([]);
                    }}
                  />
                  Selecionar Todos
                </label>
              </div>
              
              {filteredUsers.map(u => {
                const userTeamId = currentView === 'clubes' ? u.teamId : u.nationalTeamId;
                const sourceTeams = currentView === 'clubes' ? teams : nationalTeams;
                const currentTeam = sourceTeams.find(t => t.id === userTeamId);
                
                return (
                  <div key={u.id} className="user-list-card">
                    <div className="user-card-header">
                      <input 
                        type="checkbox" 
                        checked={selectedUsers.includes(u.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedUsers(prev => [...prev, u.id]);
                          else setSelectedUsers(prev => prev.filter(id => id !== u.id));
                        }}
                      />
                      <div className="user-row-avatar">
                        {u.photoURL ? <img src={u.photoURL} referrerPolicy="no-referrer" /> : <div className="default-avatar">{u.name.charAt(0)}</div>}
                        <div className="user-card-info">
                          <strong>{u.name}</strong>
                          <span>{u.email}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="user-card-body">
                      <div className="user-card-team">
                        <strong>Time Atual:</strong> {currentTeam ? currentTeam.name : (currentView === 'clubes' ? 'Sem Clube' : 'Sem Seleção')}
                      </div>
                      
                      <div style={{ display: 'flex', gap: '15px', alignItems: 'center', marginTop: '6px', fontSize: '0.85rem', flexWrap: 'wrap' }}>
                        <div>
                          <strong>Prestígio:</strong>{' '}
                          <input
                            type="number"
                            value={u.prestige ?? 100}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              updateDoc(doc(db, 'users', u.id), { prestige: val });
                            }}
                            style={{ width: '70px', padding: '2px 6px', borderRadius: '4px', border: '1px solid #ccc', background: 'var(--bg-color)', color: 'var(--text-color)' }}
                          />
                        </div>
                        {currentTeam && (
                          <div>
                            <strong>Contrato:</strong>{' '}
                            <select
                              value={currentTeam.contractYears || 2}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                const teamRef = doc(db, currentView === 'clubes' ? 'teams' : 'national_teams', currentTeam.id);
                                updateDoc(teamRef, { contractYears: val, contractStartYear: season.currentYear });
                              }}
                              style={{ padding: '2px 6px', borderRadius: '4px', border: '1px solid #ccc', background: 'var(--bg-color)', color: 'var(--text-color)' }}
                            >
                              {Array.from({ length: 10 }, (_, i) => i + 1).map(num => (
                                <option key={num} value={num}>{num} {num === 1 ? 'Ano' : 'Anos'}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                      
                      <div className="user-card-actions">
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
                        
                        <div className="user-card-buttons">
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
                            onClick={() => handleDeleteUser(u.id, userTeamId)}
                            disabled={processing}
                            title="Excluir Usuário"
                          >
                            Excluir
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="modal-actions" style={{ justifyContent: 'space-between' }}>
              <div>
                {selectedUsers.length > 0 && (
                  <button 
                    type="button" 
                    className="btn-warn" 
                    onClick={handleBulkFireUsers} 
                    disabled={processing}
                  >
                    Demitir ({selectedUsers.length}) Selecionados
                  </button>
                )}
              </div>
              <button type="button" className="btn-secondary" style={{ flex: 'none', minWidth: '120px' }} onClick={() => { setManageUsersModalOpen(false); setCoachSearchTerm(''); }}>
                Fechar
              </button>
            </div>
          </div>
        </div>
        );
      })()}

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
                {editTeamLogo && (
                  <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <img src={editTeamLogo} alt="Preview" style={{ width: 60, height: 60, objectFit: 'contain' }} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Cor Primária</label>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <input 
                          type="color" 
                          value={editTeamColor} 
                          onChange={(e) => setEditTeamColor(e.target.value)} 
                          style={{ width: '40px', height: '40px', padding: '0', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                        />
                        <button 
                          type="button" 
                          className="btn-secondary btn-small" 
                          onClick={() => handleEyeDropper(setEditTeamColor)}
                          title="Usar conta-gotas"
                        >
                          Puxar
                        </button>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Cor Secundária</label>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <input 
                          type="color" 
                          value={editTeamSecondaryColor} 
                          onChange={(e) => setEditTeamSecondaryColor(e.target.value)} 
                          style={{ width: '40px', height: '40px', padding: '0', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                        />
                        <button 
                          type="button" 
                          className="btn-secondary btn-small" 
                          onClick={() => handleEyeDropper(setEditTeamSecondaryColor)}
                          title="Usar conta-gotas"
                        >
                          Puxar
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {currentView === 'clubes' && (
                <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                  <h4 style={{ margin: '0 0 0.75rem 0', color: 'var(--primary-color)', fontSize: '0.95rem' }}>Contrato, Porte & Metas</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div className="input-group">
                      <label>Contrato Oferecido</label>
                      <select
                        value={editContractYears}
                        onChange={(e) => setEditContractYears(Number(e.target.value))}
                        disabled={processing}
                        style={{ width: '100%', padding: '8px', borderRadius: '4px', background: 'var(--bg-color)', color: 'var(--text-color)', border: '1px solid var(--border-color)' }}
                      >
                        <option value={1}>1 Ano</option>
                        <option value={2}>2 Anos</option>
                        <option value={3}>3 Anos</option>
                        <option value={4}>4 Anos</option>
                        <option value={5}>5 Anos</option>
                        <option value={6}>6 Anos</option>
                        <option value={7}>7 Anos</option>
                        <option value={8}>8 Anos</option>
                        <option value={9}>9 Anos</option>
                        <option value={10}>10 Anos</option>
                      </select>
                    </div>

                    <div className="input-group">
                      <label>Porte do Clube</label>
                      <select
                        value={editClubStatus}
                        onChange={(e: any) => setEditClubStatus(e.target.value)}
                        disabled={processing}
                        style={{ width: '100%', padding: '8px', borderRadius: '4px', background: 'var(--bg-color)', color: 'var(--text-color)', border: '1px solid var(--border-color)' }}
                      >
                        <option value="Grande">Grande</option>
                        <option value="Médio">Médio</option>
                        <option value="Pequeno">Pequeno</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
                    {editingTeam?.division === 'B' ? (
                      <div className="input-group">
                        <label>Meta - Série B</label>
                        <select
                          value={editGoalSerieB}
                          onChange={(e) => setEditGoalSerieB(e.target.value)}
                          disabled={processing}
                          style={{ width: '100%', padding: '8px', borderRadius: '4px', background: 'var(--bg-color)', color: 'var(--text-color)', border: '1px solid var(--border-color)' }}
                        >
                          <option value="Nenhuma">- Nenhuma -</option>
                          <option value="Subir">{getEditOptionLabel('serieB', 'Subir')}</option>
                          <option value="Campeão">{getEditOptionLabel('serieB', 'Campeão')}</option>
                        </select>
                      </div>
                    ) : (
                      <div className="input-group">
                        <label>Meta - Série A</label>
                        <select
                          value={editGoalSerieA}
                          onChange={(e) => setEditGoalSerieA(e.target.value)}
                          disabled={processing}
                          style={{ width: '100%', padding: '8px', borderRadius: '4px', background: 'var(--bg-color)', color: 'var(--text-color)', border: '1px solid var(--border-color)' }}
                        >
                          <option value="Nenhuma">- Nenhuma -</option>
                          <option value="Permanecer">{getEditOptionLabel('serieA', 'Permanecer')}</option>
                          <option value="Quartas de Final">{getEditOptionLabel('serieA', 'Quartas de Final')}</option>
                          <option value="Semi Final">{getEditOptionLabel('serieA', 'Semi Final')}</option>
                          <option value="Final">{getEditOptionLabel('serieA', 'Final')}</option>
                          <option value="Campeão">{getEditOptionLabel('serieA', 'Campeão')}</option>
                        </select>
                      </div>
                    )}

                    <div className="input-group">
                      <label>Meta - Copa do Brasil</label>
                      <select
                        value={editGoalCopaBrasil}
                        onChange={(e) => setEditGoalCopaBrasil(e.target.value)}
                        disabled={processing}
                        style={{ width: '100%', padding: '8px', borderRadius: '4px', background: 'var(--bg-color)', color: 'var(--text-color)', border: '1px solid var(--border-color)' }}
                      >
                        <option value="Nenhuma">- Nenhuma -</option>
                        <option value="Primeira Fase">{getEditOptionLabel('copaBrasil', 'Primeira Fase')}</option>
                        <option value="Segunda Fase">{getEditOptionLabel('copaBrasil', 'Segunda Fase')}</option>
                        <option value="Terceira Fase">{getEditOptionLabel('copaBrasil', 'Terceira Fase')}</option>
                        <option value="Oitavas de Final">{getEditOptionLabel('copaBrasil', 'Oitavas de Final')}</option>
                        <option value="Quartas de Final">{getEditOptionLabel('copaBrasil', 'Quartas de Final')}</option>
                        <option value="Semi Final">{getEditOptionLabel('copaBrasil', 'Semi Final')}</option>
                        <option value="Final">{getEditOptionLabel('copaBrasil', 'Final')}</option>
                        <option value="Campeão">{getEditOptionLabel('copaBrasil', 'Campeão')}</option>
                      </select>
                    </div>

                    <div className="input-group" style={{ gridColumn: '1 / -1' }}>
                      <label>Meta - Internacional</label>
                      <select
                        value={editGoalInternacional}
                        onChange={(e) => setEditGoalInternacional(e.target.value)}
                        disabled={processing}
                        style={{ width: '100%', padding: '8px', borderRadius: '4px', background: 'var(--bg-color)', color: 'var(--text-color)', border: '1px solid var(--border-color)' }}
                      >
                        <option value="Nenhuma">- Nenhuma -</option>
                        <option value="Pré Libertadores">{getEditOptionLabel('internacional', 'Pré Libertadores')}</option>
                        <option value="Fase de Grupos">{getEditOptionLabel('internacional', 'Fase de Grupos')}</option>
                        <option value="Oitavas de Final">{getEditOptionLabel('internacional', 'Oitavas de Final')}</option>
                        <option value="Quartas de Final">{getEditOptionLabel('internacional', 'Quartas de Final')}</option>
                        <option value="Semi Final">{getEditOptionLabel('internacional', 'Semi Final')}</option>
                        <option value="Final">{getEditOptionLabel('internacional', 'Final')}</option>
                        <option value="Campeão">{getEditOptionLabel('internacional', 'Campeão')}</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

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

      <AlertModal alert={alertMsg} onClose={() => setAlertMsg(null)} />
    </div>
  );
};

export default TeamsPage;
