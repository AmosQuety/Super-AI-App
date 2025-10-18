// src/pages/UsersPage.tsx
import { useQuery } from "@apollo/client";
import { GET_USERS } from "../graphql/users";

export default function UsersPage() {
  const { loading, error, data } = useQuery(GET_USERS);

  if (loading) return <p className="text-gray-500">Loading...</p>;
  if (error) return <p className="text-red-500">Error: {error.message}</p>;

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">Users</h1>
      <ul className="space-y-2">
        {data.users.map((user: any) => (
          <li
            key={user.id}
            className="p-3 bg-white rounded-lg shadow-sm border"
          >
            <p className="font-semibold">{user.name}</p>
            <p className="text-sm text-gray-600">{user.email}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
