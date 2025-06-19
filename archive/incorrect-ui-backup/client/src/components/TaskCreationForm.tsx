// File: /client/src/components/TaskCreationForm.tsx
// Purpose: A React component for creating new SEO tasks in the RylieSEO platform.
// Integrates with the task API to create tasks with proper validation and user feedback.
// Deployment Note for Render: Ensure this component is included in your React build process with Vite.

import { useState } from 'react';
import { useNavigate } from 'wouter';

interface TaskFormData {
  type: string;
  parameters: Record<string, any>;
  agency_id: string;
  dealership_id: string;
  priority: string;
  due_date?: string;
}

interface TaskCreationFormProps {
  agencyId?: string;
  dealershipId?: string;
  onSuccess?: (taskId: string) => void;
  onCancel?: () => void;
}

const TaskCreationForm: React.FC<TaskCreationFormProps> = ({
  agencyId = '',
  dealershipId = '',
  onSuccess,
  onCancel
}) => {
  const [, navigate] = useNavigate();
  const [formData, setFormData] = useState<TaskFormData>({
    type: 'landing_page',
    parameters: {},
    agency_id: agencyId,
    dealership_id: dealershipId,
    priority: 'medium',
    due_date: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Task type options
  const taskTypes = [
    { value: 'landing_page', label: 'Landing Page', icon: '📄' },
    { value: 'blog_post', label: 'Blog Post', icon: '✍️' },
    { value: 'gbp_post', label: 'GBP Post', icon: '📍' },
    { value: 'maintenance', label: 'Maintenance', icon: '🔧' }
  ];

  // Priority options
  const priorities = [
    { value: 'high', label: 'High', color: 'text-red-600' },
    { value: 'medium', label: 'Medium', color: 'text-yellow-600' },
    { value: 'low', label: 'Low', color: 'text-green-600' }
  ];

  // Handle form field changes
  const handleChange = (field: keyof TaskFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Handle parameter changes based on task type
  const handleParameterChange = (key: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      parameters: { ...prev.parameters, [key]: value }
    }));
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.agency_id || !formData.dealership_id) {
      setError('Agency ID and Dealership ID are required');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/tasks/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create task');
      }

      const result = await response.json();
      
      if (onSuccess) {
        onSuccess(result.taskId);
      } else {
        // Navigate to task dashboard or detail page
        navigate('/admin/tasks');
      }
    } catch (err) {
      console.error('Error creating task:', err);
      setError(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setLoading(false);
    }
  };

  // Render task-specific parameter fields
  const renderParameterFields = () => {
    switch (formData.type) {
      case 'landing_page':
      case 'blog_post':
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Target Keywords
              </label>
              <input
                type="text"
                placeholder="e.g., ford f-150, best trucks 2024"
                className="w-full p-2 border rounded-md"
                onChange={(e) => handleParameterChange('keywords', e.target.value.split(',').map(k => k.trim()))}
              />
              <p className="text-xs text-gray-500 mt-1">Separate keywords with commas</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Target Vehicle/Topic
              </label>
              <input
                type="text"
                placeholder="e.g., F-150, Maintenance Tips"
                className="w-full p-2 border rounded-md"
                onChange={(e) => handleParameterChange('target', e.target.value)}
              />
            </div>
          </>
        );
      case 'gbp_post':
        return (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Post Content Focus
            </label>
            <textarea
              placeholder="What should this GBP post focus on?"
              className="w-full p-2 border rounded-md"
              rows={3}
              onChange={(e) => handleParameterChange('focus', e.target.value)}
            />
          </div>
        );
      case 'maintenance':
        return (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Maintenance Details
            </label>
            <textarea
              placeholder="Describe what needs to be maintained or updated"
              className="w-full p-2 border rounded-md"
              rows={3}
              onChange={(e) => handleParameterChange('details', e.target.value)}
            />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Create New Task</h2>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {/* Task Type Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Task Type
          </label>
          <div className="grid grid-cols-2 gap-2">
            {taskTypes.map(type => (
              <button
                key={type.value}
                type="button"
                onClick={() => handleChange('type', type.value)}
                className={`p-3 border rounded-md flex items-center gap-2 transition-colors ${
                  formData.type === type.value
                    ? 'bg-blue-50 border-blue-500 text-blue-700'
                    : 'bg-white border-gray-300 hover:bg-gray-50'
                }`}
              >
                <span>{type.icon}</span>
                <span>{type.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Agency and Dealership IDs */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Agency ID <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.agency_id}
              onChange={(e) => handleChange('agency_id', e.target.value)}
              className="w-full p-2 border rounded-md"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Dealership ID <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.dealership_id}
              onChange={(e) => handleChange('dealership_id', e.target.value)}
              className="w-full p-2 border rounded-md"
              required
            />
          </div>
        </div>

        {/* Priority Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Priority
          </label>
          <div className="flex gap-2">
            {priorities.map(priority => (
              <button
                key={priority.value}
                type="button"
                onClick={() => handleChange('priority', priority.value)}
                className={`px-4 py-2 border rounded-md transition-colors ${
                  formData.priority === priority.value
                    ? 'bg-gray-100 border-gray-400'
                    : 'bg-white border-gray-300 hover:bg-gray-50'
                }`}
              >
                <span className={priority.color}>{priority.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Due Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Due Date (Optional)
          </label>
          <input
            type="date"
            value={formData.due_date}
            onChange={(e) => handleChange('due_date', e.target.value)}
            className="w-full p-2 border rounded-md"
            min={new Date().toISOString().split('T')[0]}
          />
        </div>

        {/* Task-specific parameters */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-700">Task Details</h3>
          {renderParameterFields()}
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 justify-end pt-4">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              disabled={loading}
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={loading}
            className={`px-6 py-2 text-white rounded-md ${
              loading
                ? 'bg-blue-300 cursor-not-allowed'
                : 'bg-blue-500 hover:bg-blue-600'
            }`}
          >
            {loading ? 'Creating...' : 'Create Task'}
          </button>
        </div>
      </div>
    </form>
  );
};

export default TaskCreationForm;