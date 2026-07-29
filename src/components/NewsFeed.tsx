import React, { useState, useMemo, useEffect } from 'react';
import { NewsItem } from '../services/seasonService';
import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';

interface NewsFeedProps {
  news: NewsItem[];
  isAdmin: boolean;
  onOpenReport?: (item: NewsItem) => void;
}

const NewsFeed: React.FC<NewsFeedProps> = ({ news, isAdmin, onOpenReport }) => {
  const [selectedYear, setSelectedYear] = useState<string>('');

  const availableYears = useMemo(() => {
    const yearsSet = new Set<string>();
    news.forEach((item) => {
      const str = `${item.date || ''} ${item.title || ''}`;
      const match = str.match(/\b(20\d{2})\b/);
      if (match) {
        yearsSet.add(match[1]);
      }
    });
    const sorted = Array.from(yearsSet).sort((a, b) => Number(b) - Number(a));
    return sorted.length > 0 ? sorted : ['2026'];
  }, [news]);

  useEffect(() => {
    if (availableYears.length > 0 && !availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears[0]);
    }
  }, [availableYears, selectedYear]);

  const filteredNews = useMemo(() => {
    if (!selectedYear) return news;
    return news.filter((item) => {
      const str = `${item.date || ''} ${item.title || ''}`;
      const match = str.match(/\b(20\d{2})\b/);
      return match && match[1] === selectedYear;
    });
  }, [news, selectedYear]);

  const handleYearChange = (yr: string) => {
    setSelectedYear(yr);
  };

  const handleDeleteNews = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Excluir esta notícia?')) return;
    try {
      await deleteDoc(doc(db, 'news', id));
    } catch (err) {
      console.error('Erro ao excluir notícia:', err);
    }
  };

  const getTypeBadge = (type: NewsItem['type']) => {
    switch (type) {
      case 'season_end':
        return <span style={{ background: '#334155', color: '#fff', fontWeight: 'bold', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem' }}>GLOBO ESPORTE</span>;
      case 'transfer':
        return <span style={{ background: '#3b82f6', color: '#fff', fontWeight: 'bold', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem' }}>MERCADO</span>;
      case 'resignation':
        return <span style={{ background: '#ef4444', color: '#fff', fontWeight: 'bold', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem' }}>DEMISSÃO</span>;
      case 'renewal':
        return <span style={{ background: '#10b981', color: '#fff', fontWeight: 'bold', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem' }}>RENOVAÇÃO</span>;
      default:
        return null;
    }
  };

  if (news.length === 0) {
    return (
      <div style={{ background: 'var(--card-bg)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)', textAlign: 'center', color: 'var(--text-secondary)' }}>
        Nenhuma notícia publicada nesta temporada ainda.
      </div>
    );
  }

  return (
    <div className="news-feed-container" style={{ background: 'var(--card-bg)', borderRadius: '10px', border: '1px solid var(--border-color)', padding: '1rem', marginTop: '2rem', marginBottom: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '1.25rem', borderBottom: '2px solid var(--border-color)', paddingBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.4rem' }}>📰</span>
          <h3 style={{ margin: 0, color: 'var(--text-color)', fontSize: '1.1rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Últimas Notícias - Plantão Esportivo
          </h3>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
            Temporada:
          </label>
          <select
            value={selectedYear}
            onChange={(e) => handleYearChange(e.target.value)}
            style={{
              background: 'var(--bg-color)',
              color: 'var(--text-color)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              padding: '5px 10px',
              fontSize: '0.85rem',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            {availableYears.map((yr) => (
              <option key={yr} value={yr}>
                {yr}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filteredNews.length === 0 ? (
        <div style={{ background: 'var(--bg-color)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border-color)', textAlign: 'center', color: 'var(--text-secondary)' }}>
          Nenhuma notícia encontrada para a Temporada {selectedYear}.
        </div>
      ) : (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
            {filteredNews.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  if (onOpenReport) {
                    onOpenReport(item);
                  }
                }}
                style={{
                  background: 'var(--bg-color)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  position: 'relative'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.2)';
                  e.currentTarget.style.borderColor = '#3b82f6';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    {getTypeBadge(item.type)}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{item.date}</span>
                      {isAdmin && item.id && (
                        <button
                          onClick={(e) => handleDeleteNews(item.id!, e)}
                          style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.8rem', padding: '0' }}
                          title="Excluir notícia"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-color)', fontSize: '0.95rem', lineHeight: '1.3' }}>
                    {item.title}
                  </h4>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.82rem', lineHeight: '1.4', whiteSpace: 'pre-line' }}>
                    {item.content}
                  </p>
                </div>

                <div style={{ marginTop: '0.85rem', paddingTop: '0.6rem', borderTop: '1px dashed var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.78rem', color: '#3b82f6', fontWeight: 600 }}>
                    📰 Ler matéria no Globo Esporte
                  </span>
                  <span style={{ color: '#3b82f6', fontWeight: 'bold' }}>➔</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default NewsFeed;
