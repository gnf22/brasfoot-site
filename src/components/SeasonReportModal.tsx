import React from 'react';
import { NewsItem, CoachSeasonReport } from '../services/seasonService';

interface SeasonReportModalProps {
  report: NewsItem | null;
  teams?: { name: string; logoUrl: string }[];
  allUsers?: { name: string; photoURL?: string; prestige?: number }[];
  onClose: () => void;
}

const SeasonReportModal: React.FC<SeasonReportModalProps> = ({ report, teams, allUsers, onClose }) => {
  if (!report) return null;

  const hasCards = report.seasonReportList && report.seasonReportList.length > 0;

  const matchedUser = allUsers?.find(
    (u) =>
      (report.coachName && u.name === report.coachName) ||
      report.title.includes(u.name) ||
      report.content.includes(u.name)
  );
  const coachName = report.coachName || matchedUser?.name || 'Treinador';
  const coachPhoto = report.coachPhotoUrl || matchedUser?.photoURL || null;
  const coachPrestige = report.prestige ?? matchedUser?.prestige ?? null;

  const matchedTeam = teams?.find(
    (t) =>
      (report.teamName && t.name === report.teamName) ||
      report.title.includes(t.name) ||
      report.content.includes(t.name)
  );
  const teamName = report.teamName || matchedTeam?.name || 'Clube';
  const teamLogo = report.teamLogoUrl || matchedTeam?.logoUrl || null;

  const getStatusBadge = (status: CoachSeasonReport['status'], statusText: string) => {
    switch (status) {
      case 'demitido':
        return {
          bg: 'rgba(239, 68, 68, 0.15)',
          color: '#ef4444',
          border: '1px solid #ef4444',
          label: statusText || '🚨 DEMITIDO PELA DIRETORIA'
        };
      case 'confianca':
        return {
          bg: 'rgba(245, 158, 11, 0.15)',
          color: '#f59e0b',
          border: '1px solid #f59e0b',
          label: statusText || '⚠️ VOTO DE CONFIANÇA'
        };
      case 'renovacao':
        return {
          bg: 'rgba(139, 92, 246, 0.15)',
          color: '#a78bfa',
          border: '1px solid #a78bfa',
          label: statusText || '📝 PROPOSTA DE RENOVAÇÃO'
        };
      case 'permance':
      default:
        return {
          bg: 'rgba(16, 185, 129, 0.15)',
          color: '#10b981',
          border: '1px solid #10b981',
          label: statusText || '✅ PERMANECE NO CARGO'
        };
    }
  };

  const getBarGradient = (pts: number) => {
    if (pts >= 75) return 'linear-gradient(90deg, #10b981, #059669)';
    if (pts >= 51) return 'linear-gradient(90deg, #f59e0b, #d97706)';
    return 'linear-gradient(90deg, #ef4444, #b91c1c)';
  };

  if (!hasCards) {
    const cleanTitle = report.title.replace(
      /^OFICIAL:\s*|^MERCADO DA BOLA:\s*|^FECHADO!\s*|^RENOVAÇÃO DEFINIDA:\s*/i,
      ''
    );
    const displayTitle = report.title.toLowerCase().startsWith('agora é oficial')
      ? report.title
      : `Agora é oficial: ${cleanTitle}`;

    return (
      <div
        className="modal-overlay"
        onClick={onClose}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
          zIndex: 1100,
          background: 'rgba(0, 0, 0, 0.75)'
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            background: '#ffffff',
            color: '#222222',
            maxWidth: '900px',
            width: '96%',
            maxHeight: '92vh',
            overflowY: 'auto',
            borderRadius: '4px',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)',
            fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
            position: 'relative',
            borderTop: '5px solid #00a5db'
          }}
        >
          {/* Top Brand Strip - estilo GloboEsporte.com */}
          <div
            style={{
              padding: '12px 26px',
              borderBottom: '1px solid #eeeeee',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#ffffff'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#00a5db', fontWeight: 900, fontSize: '1.25rem', letterSpacing: '-0.5px' }}>
                globoesporte<span style={{ color: '#222222' }}>.com</span>
              </span>
              <span style={{ color: '#cccccc', fontSize: '0.85rem' }}>|</span>
              <span style={{ color: '#777777', fontSize: '0.82rem', fontWeight: 600, textTransform: 'uppercase' }}>
                futebol • brasfoot
              </span>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#999999',
                fontSize: '1.4rem',
                cursor: 'pointer',
                padding: '0 4px',
                lineHeight: 1
              }}
              title="Fechar matéria"
            >
              ✕
            </button>
          </div>

          {/* Article Headline Section */}
          <div style={{ padding: '24px 30px 16px 30px', background: '#ffffff' }}>
            <div style={{ fontSize: '0.78rem', color: '#888888', marginBottom: '8px', fontWeight: 500 }}>
              Temporada {report.date} - Atualizado há pouco
            </div>
            <h1
              style={{
                fontSize: '2.1rem',
                fontWeight: 800,
                color: '#222222',
                lineHeight: '1.2',
                margin: '0 0 12px 0',
                letterSpacing: '-0.5px',
                fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif'
              }}
            >
              {displayTitle}
            </h1>
            <p
              style={{
                fontSize: '1.18rem',
                color: '#666666',
                lineHeight: '1.45',
                margin: '0 0 20px 0',
                fontWeight: 400
              }}
            >
              {report.type === 'transfer'
                ? `Novo técnico ${coachName} assume o comando oficial do ${teamName} para a disputa da temporada ${report.date}.`
                : report.type === 'resignation'
                ? `Diretoria do ${teamName} e ${coachName} encerram vínculo de forma oficial; clube inicia busca no mercado da bola.`
                : report.type === 'renewal'
                ? `Treinador ${coachName} tem trabalho reconhecido pela diretoria do ${teamName} e assina prorrogação de contrato.`
                : `Fique por dentro de todos os detalhes e movimentações oficiais da temporada ${report.date} no futebol.`}
            </p>

            {/* Author Line & Social Share Buttons */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
                paddingBottom: '16px',
                borderBottom: '1px solid #e5e5e5'
              }}
            >
              <div style={{ fontSize: '0.82rem', color: '#555555', lineHeight: '1.3' }}>
                <div>
                  Por <strong style={{ color: '#222222' }}>GloboEsporte.com</strong>
                </div>
                <div style={{ color: '#888888', fontSize: '0.78rem' }}>Redação FutNews • Plantão Esportivo</div>
              </div>

              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button
                  style={{
                    background: '#3b5998',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '2px',
                    padding: '6px 14px',
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  f FACEBOOK
                </button>
                <button
                  style={{
                    background: '#00aced',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '2px',
                    padding: '6px 14px',
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  TWITTER
                </button>
                <button
                  style={{
                    background: '#dd4b39',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '2px',
                    padding: '6px 10px',
                    fontSize: '0.85rem',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  g+
                </button>
                <button
                  style={{
                    background: '#cb2027',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '2px',
                    padding: '6px 10px',
                    fontSize: '0.85rem',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  P
                </button>
              </div>
            </div>
          </div>

          {/* Main Article Body (Side-by-Side: Photo Card + Text) */}
          <div
            style={{
              padding: '16px 30px 32px 30px',
              background: '#ffffff',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '28px',
              alignItems: 'flex-start'
            }}
          >
            {/* Left Side: Photo Card (News style) */}
            <div style={{ width: '350px', maxWidth: '100%' }}>
              <div
                style={{
                  border: '1px solid #e5e5e5',
                  borderRadius: '2px',
                  overflow: 'hidden',
                  background: '#f8f9fa'
                }}
              >
                <div style={{ position: 'relative', width: '100%', height: '240px', background: '#1e293b' }}>
                  {coachPhoto ? (
                    <img
                      src={coachPhoto}
                      alt={coachName}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block'
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '100%',
                        height: '100%',
                        background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '20px'
                      }}
                    >
                      <div
                        style={{
                          width: 80,
                          height: 80,
                          borderRadius: '50%',
                          background: '#ffffff',
                          color: '#0369a1',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '2.2rem',
                          fontWeight: 'bold',
                          boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
                        }}
                      >
                        {coachName.charAt(0).toUpperCase()}
                      </div>
                      {teamLogo ? (
                        <img
                          src={teamLogo}
                          alt={teamName}
                          style={{
                            width: 80,
                            height: 80,
                            objectFit: 'contain',
                            filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.3))'
                          }}
                        />
                      ) : (
                        <span style={{ fontSize: '3rem' }}>⚽</span>
                      )}
                    </div>
                  )}

                  {/* Escudo do Clube como carimbo na foto */}
                  {teamLogo && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '12px',
                        right: '12px',
                        background: 'rgba(255, 255, 255, 0.95)',
                        padding: '6px',
                        borderRadius: '50%',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <img src={teamLogo} alt={teamName} style={{ width: 44, height: 44, objectFit: 'contain' }} />
                    </div>
                  )}
                </div>

                {/* Caption Bar */}
                <div
                  style={{
                    padding: '10px 12px',
                    background: '#f8f9fa',
                    borderTop: '1px solid #eeeeee',
                    fontSize: '0.8rem',
                    color: '#555555',
                    fontFamily: 'Arial, sans-serif'
                  }}
                >
                  {report.type === 'transfer'
                    ? `${coachName} é o novo comandante do ${teamName} (Foto: Divulgação/${teamName})`
                    : report.type === 'resignation'
                    ? `${coachName} deixa o comando oficial do ${teamName} (Foto: Divulgação/FutNews)`
                    : `${coachName} em coletiva de imprensa no ${teamName} (Foto: Divulgação/FutNews)`}
                </div>
              </div>

              {/* Ficha Técnica / Resumo do Acordo */}
              <div
                style={{
                  marginTop: '16px',
                  border: '1px solid #e5e5e5',
                  background: '#fafafa',
                  padding: '14px',
                  borderRadius: '2px',
                  fontSize: '0.85rem',
                  color: '#444444'
                }}
              >
                <div
                  style={{
                    fontWeight: 'bold',
                    color: '#222222',
                    marginBottom: '10px',
                    borderBottom: '2px solid #00a5db',
                    paddingBottom: '4px',
                    textTransform: 'uppercase',
                    fontSize: '0.75rem',
                    letterSpacing: '0.5px'
                  }}
                >
                  Resumo da Operação
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: '#666666' }}>Clube:</span>
                  <strong style={{ color: '#222222' }}>{teamName}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: '#666666' }}>Treinador:</span>
                  <strong style={{ color: '#222222' }}>{coachName}</strong>
                </div>
                {coachPrestige !== null && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ color: '#666666' }}>Prestígio no Ranking:</span>
                    <strong style={{ color: '#00a5db' }}>{coachPrestige} pts</strong>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#666666' }}>Status:</span>
                  <strong
                    style={{
                      color:
                        report.type === 'resignation'
                          ? '#dc2626'
                          : report.type === 'renewal'
                          ? '#16a34a'
                          : '#0284c7'
                    }}
                  >
                    {report.type === 'transfer'
                      ? 'Contratado / Oficial'
                      : report.type === 'resignation'
                      ? 'Rescisão de Vínculo'
                      : report.type === 'renewal'
                      ? 'Contrato Renovado'
                      : 'Em pauta'}
                  </strong>
                </div>
              </div>
            </div>

            {/* Right Side: Editorial Newspaper Text */}
            <div
              style={{
                flex: 1,
                minWidth: '280px',
                fontSize: '1.08rem',
                color: '#333333',
                lineHeight: '1.75',
                fontFamily: 'Arial, Helvetica, sans-serif'
              }}
            >
              <p style={{ margin: '0 0 18px 0' }}>
                Agora é oficial. A diretoria do <strong style={{ color: '#00a5db' }}>{teamName}</strong> confirmou a {report.type === 'transfer' ? 'contratação do técnico' : report.type === 'resignation' ? 'saída do técnico' : 'prorrogação do contrato de'} <strong style={{ color: '#00a5db' }}>{coachName}</strong> para assumir o comando técnico do clube na disputa da temporada {report.date}.
              </p>

              <p style={{ margin: '0 0 18px 0' }}>
                {report.content}
              </p>

              <p style={{ margin: '0 0 18px 0' }}>
                {report.type === 'transfer'
                  ? `– Teremos nos próximos dias a apresentação oficial do ${coachName}, será nosso treinador. É um profissional competente que terá papel importante no vestiário e no planejamento de todos os departamentos da equipe – anunciou a diretoria do ${teamName}.`
                  : report.type === 'resignation'
                  ? `– Agradecemos o empenho de ${coachName} no comando da equipe. O futebol é feito de ciclos e agora iniciamos um processo rigoroso no mercado para fechar com nosso novo técnico – informou a presidência do ${teamName}.`
                  : `– O trabalho e a dedicação do professor ${coachName} nos trouxeram total confiança para renovar o contrato. Seguimos com nosso projeto ambicioso para a temporada ${report.date} – comemorou a diretoria do ${teamName}.`}
              </p>

              <div
                style={{
                  marginTop: '28px',
                  paddingTop: '16px',
                  borderTop: '1px solid #eeeeee',
                  fontSize: '0.82rem',
                  color: '#777777',
                  fontStyle: 'italic'
                }}
              >
                © {report.date} GloboEsporte.com • Todos os direitos reservados. Sistema oficial de gestão de notícias e prestígio Brasfoot FutNews.
              </div>
            </div>
          </div>

          {/* Footer Close Button */}
          <div
            style={{
              padding: '16px 30px 20px 30px',
              background: '#fcfcfc',
              borderTop: '1px solid #eeeeee',
              display: 'flex',
              justifyContent: 'center'
            }}
          >
            <button
              onClick={onClose}
              style={{
                background: '#00a5db',
                color: '#ffffff',
                border: 'none',
                padding: '10px 36px',
                borderRadius: '3px',
                fontWeight: 'bold',
                fontSize: '0.95rem',
                cursor: 'pointer',
                boxShadow: '0 2px 5px rgba(0,0,0,0.15)'
              }}
            >
              Fechar Matéria
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div
        className="modal-content"
        style={{
          maxWidth: '850px',
          width: '95%',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'var(--card-bg)',
          border: '1px solid var(--border-color)',
          boxShadow: '0 10px 35px rgba(0, 0, 0, 0.25)',
          padding: '0',
          borderRadius: '16px'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header estilo Globo Esporte */}
        <div
          style={{
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.15)',
            padding: '1.5rem',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span style={{ background: 'rgba(255, 255, 255, 0.15)', color: '#fff', fontWeight: 'bold', padding: '3px 10px', borderRadius: '6px', fontSize: '0.75rem', letterSpacing: '0.5px', border: '1px solid rgba(255, 255, 255, 0.25)' }}>
                PLANTÃO GLOBO ESPORTE
              </span>
              <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{report.date}</span>
            </div>
            <h2 style={{ margin: 0, color: '#f8fafc', fontSize: '1.5rem', lineHeight: '1.2' }}>
              {report.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              color: '#fff',
              width: 38,
              height: 38,
              borderRadius: '50%',
              fontSize: '1.2rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ✕
          </button>
        </div>

        {/* Conteúdo */}
        <div style={{ padding: '1.75rem' }}>
          <div>
              <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: '1rem', color: 'var(--text-secondary)' }}>
                  Acompanhe a avaliação de prestígio, o cumprimento de metas e o destino dos treinadores após o fechamento da temporada:
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {report.seasonReportList!.map((coach, idx) => {
                  const badge = getStatusBadge(coach.status, coach.statusText);
                  const newPrestige = Math.min(100, Math.max(0, coach.newPrestige));

                  return (
                    <div
                      key={idx}
                      style={{
                        background: 'var(--bg-color)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '12px',
                        padding: '1.25rem',
                        boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
                      }}
                    >
                      {/* Top Row: Info e Badge */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                          <img
                            src={coach.teamLogoUrl}
                            alt={coach.teamName}
                            style={{ width: 44, height: 44, objectFit: 'contain' }}
                          />
                          {coach.ownerPhoto ? (
                            <img
                              src={coach.ownerPhoto}
                              alt={coach.ownerName}
                              style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border-color)' }}
                            />
                          ) : (
                            <div
                              style={{
                                width: 44,
                                height: 44,
                                borderRadius: '50%',
                                background: '#3b82f6',
                                color: '#fff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 'bold',
                                fontSize: '1.1rem',
                                border: '2px solid var(--border-color)'
                              }}
                            >
                              {coach.ownerName.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--text-color)' }}>
                              {coach.ownerName}
                            </div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                              Comandante • <strong style={{ color: 'var(--text-color)' }}>{coach.teamName}</strong>
                            </div>
                          </div>
                        </div>

                        <div>
                          <span
                            style={{
                              background: badge.bg,
                              color: badge.color,
                              border: badge.border,
                              padding: '6px 12px',
                              borderRadius: '20px',
                              fontSize: '0.8rem',
                              fontWeight: 'bold',
                              display: 'inline-block'
                            }}
                          >
                            {badge.label}
                          </span>
                        </div>
                      </div>

                      {/* Prestige Bar Area */}
                      <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '1rem', marginBottom: '0.75rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '0.9rem' }}>
                          <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                            Prestígio no Ranking: <strong style={{ color: 'var(--text-color)', fontSize: '1.05rem' }}>{newPrestige} / 100 pts</strong>
                          </span>
                          <span
                            style={{
                              fontWeight: 'bold',
                              color: coach.delta >= 0 ? '#10b981' : '#ef4444'
                            }}
                          >
                            {coach.delta >= 0 ? `+${coach.delta}` : coach.delta} pts no ano
                          </span>
                        </div>

                        {/* Barra de progresso */}
                        <div
                          style={{
                            width: '100%',
                            height: '14px',
                            background: 'rgba(255, 255, 255, 0.08)',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            position: 'relative'
                          }}
                        >
                          <div
                            style={{
                              width: `${newPrestige}%`,
                              height: '100%',
                              background: getBarGradient(newPrestige),
                              borderRadius: '8px',
                              transition: 'width 0.8s ease-in-out'
                            }}
                          />
                        </div>
                      </div>

                      {/* Metas vs Resultados Details */}
                      {coach.details && (
                        <div
                          style={{
                            background: 'var(--card-bg)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            padding: '10px 14px',
                            fontSize: '0.85rem',
                            color: 'var(--text-secondary)',
                            lineHeight: '1.5'
                          }}
                        >
                          <strong style={{ color: 'var(--text-color)' }}>Resumo de Metas: </strong>
                          {coach.details}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: '2rem',
              paddingTop: '1.25rem',
              borderTop: '1px solid var(--border-color)',
              textAlign: 'center',
              color: 'var(--text-secondary)',
              fontSize: '0.85rem'
            }}
          >
            Sistema oficial de gestão e prestígio • Brasfoot FutNews
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.5rem' }}>
            <button
              onClick={onClose}
              className="btn-primary"
              style={{ background: '#334155', color: '#fff', fontWeight: 'bold', padding: '10px 30px', borderRadius: '25px', fontSize: '1rem', border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer' }}
            >
              Fechar Matéria
            </button>
          </div>
        </div>
      </div>
    );
  };

export default SeasonReportModal;
