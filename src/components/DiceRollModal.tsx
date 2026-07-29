import React, { useEffect, useState } from 'react';
import { doc, onSnapshot, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../hooks/useAuth';

export interface DiceParticipant {
  uid: string;
  name: string;
  photoURL: string;
  dice1: number | null;
  dice2: number | null;
  total: number | null;
  eliminated?: boolean;
}

export interface DiceEvent {
  active: boolean;
  teamId: string;
  teamName: string;
  participants: DiceParticipant[];
  status: 'waiting' | 'rolling' | 'finished';
  winner: string | null;
  round: number;
  collectionType: 'teams' | 'national_teams';
  teamLogoUrl?: string;
}

const DiceRollModal: React.FC = () => {
  const { user } = useAuth();
  const [diceEvent, setDiceEvent] = useState<DiceEvent | null>(null);
  const [isRollingAnim, setIsRollingAnim] = useState(false);
  const [assigningWinner, setAssigningWinner] = useState(false);
  const [animDice, setAnimDice] = useState<{ [key: string]: { d1: number, d2: number } }>({});

  const isAdmin = user?.email === 'gnferreira2000@gmail.com';

  useEffect(() => {
    const diceEventRef = doc(db, 'settings', 'dice_event');
    const unsubscribe = onSnapshot(diceEventRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as DiceEvent;
        setDiceEvent(data);
        
        if (data.status === 'rolling') {
          setIsRollingAnim(true);
        } else {
          setIsRollingAnim(false);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isRollingAnim && diceEvent) {
      interval = setInterval(() => {
        const newAnim: { [key: string]: { d1: number, d2: number } } = {};
        diceEvent.participants.forEach(p => {
          if (!p.eliminated) {
            newAnim[p.uid] = {
              d1: Math.floor(Math.random() * 6) + 1,
              d2: Math.floor(Math.random() * 6) + 1
            };
          }
        });
        setAnimDice(newAnim);
      }, 100); // Speed of number change
    }
    return () => clearInterval(interval);
  }, [isRollingAnim, diceEvent]);

  if (!diceEvent || !diceEvent.active) return null;

  const handleRollDice = async () => {
    if (!isAdmin || assigningWinner) return;

    const diceEventRef = doc(db, 'settings', 'dice_event');
    await updateDoc(diceEventRef, { status: 'rolling' });

    setTimeout(async () => {
      let updatedParticipants = [...diceEvent.participants];
      let maxScore = -1;

      updatedParticipants = updatedParticipants.map(p => {
        if (p.eliminated) return p;
        
        const d1 = Math.floor(Math.random() * 6) + 1;
        const d2 = Math.floor(Math.random() * 6) + 1;
        const total = d1 + d2;
        
        if (total > maxScore) maxScore = total;
        
        return { ...p, dice1: d1, dice2: d2, total };
      });

      const topPlayers = updatedParticipants.filter(p => !p.eliminated && p.total === maxScore);
      
      if (topPlayers.length === 1) {
        const winner = topPlayers[0];
        updatedParticipants = updatedParticipants.map(p => ({
          ...p,
          eliminated: p.uid !== winner.uid
        }));

        await updateDoc(diceEventRef, {
          participants: updatedParticipants,
          status: 'finished',
          winner: winner.uid
        });

        // Automatically assign winner to team and free up others
        setAssigningWinner(true);
        try {
          const teamRef = doc(db, diceEvent.collectionType, diceEvent.teamId);
          const winnerRef = doc(db, 'users', winner.uid);
          
          const teamDoc = await getDoc(teamRef);
          if (teamDoc.exists()) {
             const userField = diceEvent.collectionType === 'teams' ? 'teamId' : 'nationalTeamId';
             
             // Update team
             await updateDoc(teamRef, {
                ownerId: winner.uid,
                ownerName: winner.name,
                ownerPhoto: winner.photoURL || null,
                interestedUsers: [] // clear interested
             });
             
             // Update winner user doc
             await updateDoc(winnerRef, {
                [userField]: diceEvent.teamId,
                declaredInterestTeamId: null
             });
             
             // Update losers user docs (clear declaredInterestTeamId)
             const losers = updatedParticipants.filter(p => p.uid !== winner.uid);
             for(const loser of losers) {
                const loserRef = doc(db, 'users', loser.uid);
                await updateDoc(loserRef, { declaredInterestTeamId: null });
             }
          }
        } catch (error) {
          console.error("Error assigning winner:", error);
        } finally {
          setAssigningWinner(false);
        }

      } else {
        // Tie
        updatedParticipants = updatedParticipants.map(p => {
          if (!p.eliminated && p.total !== maxScore) {
            return { ...p, eliminated: true };
          }
          return p;
        });

        await updateDoc(diceEventRef, {
          participants: updatedParticipants,
          status: 'waiting',
          round: (diceEvent.round || 1) + 1
        });
      }
    }, 2000);
  };

  const handleClose = async () => {
    if (!isAdmin) return;
    const diceEventRef = doc(db, 'settings', 'dice_event');
    await updateDoc(diceEventRef, { active: false });
  };

  return (
    <div className="modal-overlay dice-modal-overlay" style={{ zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.85)' }}>
      <div className="modal-content dice-modal-content" style={{ maxWidth: '800px', width: '90%', textAlign: 'center', background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '2rem' }}>
        <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem', color: 'var(--primary-color)' }}>Sorteio de Treinador</h2>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', marginBottom: '2rem' }}>
          {diceEvent.teamLogoUrl && (
            <img src={diceEvent.teamLogoUrl} alt={diceEvent.teamName} style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
          )}
          <p className="dice-team-name" style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', margin: 0 }}>
            {diceEvent.teamName} - Rodada {diceEvent.round}
          </p>
        </div>
        
        {diceEvent.status === 'finished' && diceEvent.winner && (
          <div className="dice-winner-banner" style={{ backgroundColor: '#22c55e20', color: '#22c55e', padding: '1rem', borderRadius: '8px', fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '2rem', border: '1px solid #22c55e40' }}>
            Temos um Vencedor!
          </div>
        )}

        <div className="dice-participants-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
          {diceEvent.participants.map(p => (
            <div key={p.uid} className={`dice-participant-card ${p.eliminated ? 'eliminated' : ''} ${diceEvent.winner === p.uid ? 'winner-card' : ''}`}
                 style={{ 
                   position: 'relative',
                   padding: '1.5rem', 
                   borderRadius: '8px', 
                   background: p.eliminated ? 'var(--bg-color)' : 'var(--card-hover)',
                   border: diceEvent.winner === p.uid ? '2px solid #22c55e' : '1px solid var(--border-color)',
                   opacity: p.eliminated ? 0.5 : 1,
                   transition: 'all 0.3s ease'
                 }}>
              <div className="dice-participant-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                {p.photoURL ? (
                  <img src={p.photoURL} alt={p.name} className="dice-avatar" referrerPolicy="no-referrer" style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <div className="dice-avatar-default" style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--primary-color)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 'bold' }}>
                    {p.name.charAt(0)}
                  </div>
                )}
                <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{p.name}</span>
              </div>
              
              <div className="dice-area" style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '1rem' }}>
                  <>
                    <div className={`dice-box ${isRollingAnim && !p.eliminated ? 'spinning3d' : ''}`} style={{ width: '50px', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'white', color: 'black', borderRadius: '8px', fontSize: '1.5rem', fontWeight: 'bold', border: '2px solid #ccc', boxShadow: isRollingAnim && !p.eliminated ? '0 0 10px rgba(255,255,255,0.5)' : 'none' }}>
                      {isRollingAnim && !p.eliminated ? (animDice[p.uid]?.d1 || 1) : (p.dice1 || '-')}
                    </div>
                    <div className={`dice-box ${isRollingAnim && !p.eliminated ? 'spinning3d' : ''}`} style={{ width: '50px', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'white', color: 'black', borderRadius: '8px', fontSize: '1.5rem', fontWeight: 'bold', border: '2px solid #ccc', boxShadow: isRollingAnim && !p.eliminated ? '0 0 10px rgba(255,255,255,0.5)' : 'none' }}>
                      {isRollingAnim && !p.eliminated ? (animDice[p.uid]?.d2 || 1) : (p.dice2 || '-')}
                    </div>
                  </>
              </div>
              <div className="dice-total" style={{ fontSize: '1.2rem' }}>
                Total: <strong>{isRollingAnim && !p.eliminated ? '?' : (p.total || 0)}</strong>
              </div>
              
              {p.eliminated && <div className="eliminated-stamp" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%) rotate(-15deg)', color: '#ef4444', border: '3px solid #ef4444', padding: '0.5rem 1rem', fontSize: '1.5rem', fontWeight: 'bold', borderRadius: '8px', textTransform: 'uppercase', letterSpacing: '2px', background: 'rgba(0,0,0,0.8)' }}>Eliminado</div>}
              {diceEvent.winner === p.uid && <div className="winner-stamp" style={{ position: 'absolute', top: '-15px', right: '-15px', background: '#22c55e', color: 'white', padding: '0.5rem', borderRadius: '50%', fontSize: '1.5rem' }}>👑</div>}
            </div>
          ))}
        </div>

        {isAdmin && (
          <div className="dice-admin-controls" style={{ marginTop: '2rem' }}>
            {diceEvent.status !== 'finished' ? (
              <button 
                className="btn-primary" 
                style={{ padding: '1rem 2rem', fontSize: '1.2rem' }}
                onClick={handleRollDice}
                disabled={diceEvent.status === 'rolling'}
              >
                {diceEvent.status === 'rolling' ? 'Sorteando...' : 'Girar Dados'}
              </button>
            ) : (
              <button className="btn-secondary" style={{ padding: '1rem 2rem', fontSize: '1.2rem' }} onClick={handleClose} disabled={assigningWinner}>
                {assigningWinner ? 'Atribuindo Time...' : 'Fechar Janela'}
              </button>
            )}
          </div>
        )}
      </div>
      <style>{`
        @keyframes spin3d {
          0% { transform: rotateX(0deg) rotateY(0deg) rotateZ(0deg) scale(1); }
          50% { transform: rotateX(180deg) rotateY(180deg) rotateZ(180deg) scale(1.1); }
          100% { transform: rotateX(360deg) rotateY(360deg) rotateZ(360deg) scale(1); }
        }
        .spinning3d {
          animation: spin3d 0.3s linear infinite;
        }

        @media (max-width: 600px) {
          .dice-modal-content {
            padding: 1rem !important;
            width: 95% !important;
          }
          .dice-participants-grid {
            grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)) !important;
            gap: 0.5rem !important;
          }
          .dice-participant-card {
            padding: 0.5rem !important;
          }
          .dice-avatar {
            width: 40px !important;
            height: 40px !important;
          }
          .dice-avatar-default {
            width: 40px !important;
            height: 40px !important;
            font-size: 1.2rem !important;
          }
          .dice-participant-header span {
            font-size: 0.8rem !important;
          }
          .dice-area {
            gap: 0.5rem !important;
            margin-bottom: 0.5rem !important;
          }
          .dice-box {
            width: 35px !important;
            height: 35px !important;
            font-size: 1rem !important;
            border-width: 1px !important;
          }
          .dice-total {
            font-size: 0.9rem !important;
          }
          .dice-modal-content h2 {
            font-size: 1.4rem !important;
          }
          .dice-team-name {
            font-size: 1rem !important;
          }
          .dice-winner-banner {
            font-size: 1.1rem !important;
            padding: 0.5rem !important;
            margin-bottom: 1rem !important;
          }
          .eliminated-stamp {
            font-size: 0.8rem !important;
            padding: 0.25rem 0.5rem !important;
          }
          .winner-stamp {
            font-size: 1rem !important;
            top: -10px !important;
            right: -10px !important;
            padding: 0.25rem !important;
          }
          .dice-admin-controls button {
            padding: 0.75rem 1rem !important;
            font-size: 1rem !important;
          }
        }
      `}</style>
    </div>
  );
};

export default DiceRollModal;
