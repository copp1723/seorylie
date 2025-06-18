// File: /client/src/components/AgencyDownloadPortal.tsx
// Purpose: A basic React component for agencies to view and download deliverables associated with their tasks in the RylieSEO platform.
// This supports Agent 2's Week 5 deliverables by providing a starting UI for deliverable access.
// Deployment Note for Render: Ensure this component is included in your React build process with Vite. Render will bundle this automatically.
// Route to this component (e.g., /deliverables) using Wouter. Ensure backend API is accessible for fetching deliverable data.

import { useEffect, useState } from 'react';

interface DeliverableTask {
  id: string;
  type: string;
  status: string;
  deliverable_url?: string;
  created_at: string;
  updated_at?: string;
}

const AgencyDownloadPortal = () => {
  const [tasks, setTasks] = useState<DeliverableTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch tasks with deliverables from API on component mount
  // Placeholder: Filters for tasks with deliverables; actual filter to be implemented based on agency context
  useEffect(() => {
    const fetchTasks = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/tasks');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        // Filter for tasks with deliverables (placeholder logic until agency-specific endpoint is available)
        const deliverableTasks = data.filter((task: DeliverableTask) => task.deliverable_url && task.status === 'completed');
        setTasks(deliverableTasks);
        setError(null);
      } catch (err) {
        console.error('Error fetching tasks with deliverables:', err);
        setError('Failed to load deliverables. Please try again later.');
        setTasks([]);
      } finally {
        setLoading(false);
      }
    };
    fetchTasks();
  }, []);

  // Handle download action (opens deliverable URL in new tab)
  const handleDownload = (url: string) => {
    window.open(url, '_blank');
  };

  // Handle loading state
  if (loading) {
    return <div className="p-6 text-center">Loading deliverables...</div>;
  }

  // Handle error state
  if (error) {
    return <div className="p-6 text-center text-red-500">{error}</div>;
  }

  // Render deliverables table
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Deliverables Download Portal</h2>
      {tasks.length === 0 ? (
        <p className="text-gray-500">No deliverables available. Check back later or contact support.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-gray-300">
            <thead>
              <tr className="bg-gray-200">
                <th className="p-2 text-left text-sm font-semibold">Task Type</th>
                <th className="p-2 text-left text-sm font-semibold">Status</th>
                <th className="p-2 text-left text-sm font-semibold">Created</th>
                <th className="p-2 text-left text-sm font-semibold">Updated</th>
                <th className="p-2 text-left text-sm font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id} className="border-b hover:bg-gray-50">
                  <td className="p-2 text-sm">{task.type}</td>
                  <td className="p-2 text-sm">{task.status}</td>
                  <td className="p-2 text-sm">{new Date(task.created_at).toLocaleDateString()}</td>
                  <td className="p-2 text-sm">{task.updated_at ? new Date(task.updated_at).toLocaleDateString() : 'N/A'}</td>
                  <td className="p-2 text-sm">
                    <button
                      onClick={() => task.deliverable_url && handleDownload(task.deliverable_url)}
                      className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
                    >
                      Download
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

export default AgencyDownloadPortal;