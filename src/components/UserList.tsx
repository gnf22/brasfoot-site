// src/components/UserList.tsx
import React from 'react';

interface User {
  id: string;
  name: string;
}

interface UserListProps {
  users: User[];
}

const UserList: React.FC<UserListProps> = ({ users }) => {
  return (
    <ul>
      {users.map(user => (
        <div key={user.id}>
          <li>{user.name}</li>
        </div>
      ))}
    </ul>
  );
};

export default UserList;
