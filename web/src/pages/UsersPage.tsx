// src/pages/UsersPage.tsx
import { useQuery } from "@apollo/client/react";
import { GET_USERS } from "../graphql/users";
import type { GetUsersResponse } from "../types/user"; // Type-only import

export default function UsersPage() {
  const { loading, error, data } = useQuery<GetUsersResponse>(GET_USERS);

  if (loading) return <p className="text-gray-500">Loading...</p>;
  if (error) return <p className="text-red-500">Error: {error.message}</p>;

  // Optional: Handle undefined data
  const users = data?.users || [];

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">Users</h1>
      {users.length === 0 ? (
        <p className="text-gray-500">No users found</p>
      ) : (
        <ul className="space-y-2">
          {users.map((user) => (
            <li
              key={user.id}
              className="p-3 bg-white rounded-lg shadow-sm border"
            >
              <p className="font-semibold">{user.name}</p>
              <p className="text-sm text-gray-600">{user.email}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}