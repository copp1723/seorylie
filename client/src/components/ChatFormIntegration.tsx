// Enhanced chat-to-form integration
// Add this to SEOWerksChat component

const openTaskForm = (taskType: string, prefillData?: any) => {
  // Store prefill data in sessionStorage for the form to retrieve
  if (prefillData) {
    sessionStorage.setItem('taskFormPrefill', JSON.stringify({
      type: taskType,
      parameters: prefillData,
      source: 'chat'
    }));
  }
  
  // Option 1: Navigate to standalone form (Agent 1's approach)
  // window.location.href = `/tasks/create?type=${taskType}`;
  
  // Option 2: Open in modal (better UX)
  setShowTaskModal(true);
  setModalTaskType(taskType);
  setModalPrefillData(prefillData);
};

// Add this modal component to SEOWerksChat
const TaskCreationModal = ({ isOpen, onClose, taskType, prefillData }) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-90vh overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold">Create {taskType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-5 w-5" />
          </button>
        </div>
        {/* Embed Agent 1's TaskCreationForm here with props */}
        <TaskCreationForm 
          initialType={taskType}
          initialData={prefillData}
          onSuccess={() => {
            onClose();
            addMessageToChat('assistant', `Great! Your ${taskType.replace('_', ' ')} task has been created. You'll receive updates as it progresses.`);
          }}
        />
      </div>
    </div>
  );
};
