// src/components/UserInput.tsx
import React from 'react';

interface UserInputProps {
  name: string;
  setName: React.Dispatch<React.SetStateAction<string>>;
  criarUser: () => Promise<void>;
}

const UserInput: React.FC<UserInputProps> = ({ name, setName, criarUser }) => {
  return (
    <div>
      <h1>Brasfoot FutNews</h1>
      <p>Escreva seu nome</p>
      <input
        type="text"
        placeholder='Nome...'
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <button onClick={criarUser}>Entrar</button>
    </div>
  );
};

export default UserInput;
