import React, { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { UserData } from '../services/userService';
import { SeasonData, createNewsItem, getRandomRenewalNews, getRandomResignationNews } from '../services/seasonService';
import AlertModal, { AlertMessage } from './AlertModal';

interface RenewalModalProps {
  userData: UserData;
  season: SeasonData;
  onClose: () => void;
}

const RenewalModal: React.FC<RenewalModalProps> = ({ userData, season, onClose }) => {
  const [processing, setProcessing] = useState(false);
  const [alertMsg, setAlertMsg] = useState<AlertMessage | null>(null);
  const pending = userData.pendingRenewal;

  if (!pending) return null;

  const handleAccept = async () => {
    setProcessing(true);
    try {
      const userRef = doc(db, 'users', userData.uid);
      const teamRef = doc(db, 'teams', pending.teamId);

      await updateDoc(userRef, {
        pendingRenewal: null
      });

      await updateDoc(teamRef, {
        contractStartYear: season.currentYear,
        contractYears: pending.years
      });

      await createNewsItem(
        getRandomRenewalNews(userData.name, pending.teamName, season.currentYear, pending.years, {
          coachPhotoUrl: userData.photoURL || '',
          prestige: userData.prestige ?? 70
        })
      );

      setAlertMsg({
        title: 'Contrato Renovado!',
        message: `Parabéns! Você renovou contrato com ${pending.teamName} até ${season.currentYear + pending.years}!`,
        type: 'success',
        onCloseAction: () => onClose()
      });
    } catch (err) {
      console.error('Erro ao aceitar renovação:', err);
      setAlertMsg({ title: 'Erro', message: 'Erro ao aceitar renovação.', type: 'error' });
    }
    setProcessing(false);
  };

  const handleDecline = async () => {
    const confirm = window.confirm(`Tem certeza que deseja recusar a proposta e deixar o cargo no ${pending.teamName}?`);
    if (!confirm) return;

    setProcessing(true);
    try {
      const userRef = doc(db, 'users', userData.uid);
      const teamRef = doc(db, 'teams', pending.teamId);

      await updateDoc(userRef, {
        pendingRenewal: null,
        teamId: null
      });

      await updateDoc(teamRef, {
        ownerId: null,
        ownerName: null,
        ownerPhoto: null,
        interestedUsers: []
      });

      await createNewsItem(
        getRandomResignationNews(userData.name, pending.teamName, season.currentYear, {
          coachPhotoUrl: userData.photoURL || '',
          prestige: userData.prestige ?? 70
        })
      );

      setAlertMsg({
        title: 'Livre no Mercado',
        message: `Você entregou o cargo e agora está livre no mercado.`,
        type: 'info',
        onCloseAction: () => onClose()
      });
    } catch (err) {
      console.error('Erro ao recusar renovação:', err);
      setAlertMsg({ title: 'Erro', message: 'Erro ao recusar renovação.', type: 'error' });
    }
    setProcessing(false);
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1200 }}>
      <div className="modal-content" style={{ maxWidth: '520px', textAlign: 'center', border: '2px solid #10b981', background: 'var(--card-bg)' }}>
        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🤝</div>
        <h3 style={{ color: '#10b981', margin: '0 0 1rem 0', textTransform: 'uppercase' }}>
          Proposta de Renovação de Contrato!
        </h3>
        
        <p style={{ fontSize: '1rem', color: 'var(--text-color)', lineHeight: '1.5', marginBottom: '1.5rem' }}>
          A diretoria do <strong>{pending.teamName}</strong> ficou satisfeita com seu trabalho e enviou uma proposta de renovação automática por mais <strong>{pending.years} {pending.years === 1 ? 'ano' : 'anos'}</strong> de contrato!
        </p>

        <div style={{ background: 'var(--bg-color)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Seu Prestígio Atual</div>
          <strong style={{ fontSize: '1.4rem', color: 'var(--primary-color)' }}>{userData.prestige ?? 100}/100</strong>
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button
            onClick={handleDecline}
            className="btn-danger"
            style={{ flex: 1, padding: '12px' }}
            disabled={processing}
          >
            Recusar e Deixar Clube
          </button>
          <button
            onClick={handleAccept}
            className="btn-primary"
            style={{ flex: 1, padding: '12px', background: '#10b981', color: '#fff', fontWeight: 'bold' }}
            disabled={processing}
          >
            Aceitar Renovação ({pending.years} anos)
          </button>
        </div>
      </div>
      <AlertModal alert={alertMsg} onClose={() => setAlertMsg(null)} />
    </div>
  );
};

export default RenewalModal;
