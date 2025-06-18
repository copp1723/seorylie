// File: /client/src/components/TaskDashboard.tsx
// Purpose: A React component to display a list of tasks for admin or agency users in the RylieSEO platform.
// Fetches tasks from the /api/tasks endpoint and renders them in a table format using Tailwind CSS for styling.
// Deployment Note for Render: Ensure this component is included in your React build process with Vite. Render will bundle this automatically.
// If backend API is on a separate Render service, update fetch URLs with the correct domain (e.g., use environment variable for API base URL).
// No specific Render config needed beyond ensuring frontend connects to backend API.

import { useEffect, useState } from 'react';

interface Task {
  id: string;
  type: string;
  status: string;
  agency_id: string;
  dealership_id: string;
  priority: string;
  created_at: string;
  updated_at?: string;
}

const TaskDashboard = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch tasks from API on component mount
  useEffect(() => {
    const fetchTasks = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/tasks');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setTasks(data);
        setError(null);
      } catch (err) {
        console.error('Error fetching tasks:', err);
        setError('Failed to load tasks. Please try again later.');
        setTasks([]);
      } finally {
        setLoading(false);
      }
    };
    fetchTasks();
  }, []);

  // Handle loading state
  if (loading) {
    return <div className="p-6 text-center">Loading tasks...</div>;
  }

  // Handle error state
  if (error) {
    return <div className="p-6 text-center text-red-500">{error}</div>;
  }

  // Render task table
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Task Dashboard</h2>
      {tasks.length === 0 ? (
        <p className="text-gray-500">No tasks found. Create a new task to get started.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-gray-300">
            <thead>
              <tr className="bg-gray-200">
                <th className="p-2 text-left text-sm font-semibold">Type</th>
                <th className="p-2 text-left text-sm font-semibold">Status</th>
                <th className="p-2 text-left text-sm font-semibold">Agency ID</th>
                <th className="p-2 text-left text-sm font-semibold">Dealership ID</th>
                <th className="p-2 text-left text-sm font-semibold">Priority</th>
                <th className="p-2 text-left text-sm font-semibold">Created</th>
                <th className="p-2 text-left text-sm font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id} className="border-b hover:bg-gray-50">
                  <td className="p-2 text-sm">{task.type}</td>
                  <td className="p-2 text-sm">{task.status}</td>
                  <td className="p-2 text-sm truncate">{task.agency_id}</td>
                  <td className="p-2 text-sm truncate">{task.dealership_id}</td>
                  <td className="p-2 text-sm">{task.priority}</td>
                  <td className="p-2 text-sm">{new Date(task.created_at).toLocaleDateString()}</td>
                  <td className="p-2 text-sm">
                    <button className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600">
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default TaskDashboard;