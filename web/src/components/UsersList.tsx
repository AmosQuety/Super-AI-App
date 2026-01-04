import React from "react";
import { useQuery } from "@apollo/client/react";
import { GET_USERS } from "../graphql/users";

// --- TYPE DEFINITIONS ---
interface Message {
  role: string;
  content: string;
}

interface Chat {
  id: string;
  messages: Message[];
}

interface User {
  id: string;
  email: string;
  chats: Chat[];
}

interface GetUsersData {
  users: User[];
}

export const UsersList: React.FC = () => {
  const { data, loading, error } = useQuery<GetUsersData>(GET_USERS);

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error.message}</p>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-4">Users</h2>
      {data?.users.map((user: User) => (
        <div
          key={user.id}
          className="mb-4 p-4 border border-gray-300 rounded-lg"
        >
          <p>
            <strong>Email:</strong> {user.email}
          </p>
          <p>
            <strong>Chats:</strong>
          </p>
          <ul>
            {user.chats.map((chat: Chat) => (
              <li key={chat.id} style={{ marginBottom: "0.5rem" }}>
                {chat.messages.map((m: Message, i: number) => (
                  <p key={i}>
                    <strong>{m.role}:</strong> {m.content}
                  </p>
                ))}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
};