import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const HomePage: React.FC = () => {
  const { user, loading, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate('/teams');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="home-container">
      <div className="glass-card login-card">
        <h1>Brasfoot FutNews</h1>
        <p>Gerencie o seu time e acompanhe a liga.</p>
        <button className="btn-social" onClick={loginWithGoogle}>
          <img src="https://img.icons8.com/color/24/000000/google-logo.png" alt="Google logo" />
          Entrar com Google
        </button>
      </div>
    </div>
  );
};

export default HomePage;
