
import { createRoot } from 'react-dom/client';
import { EmbeddedChat } from './components/embedded-chat';
import './index.css';

function initChat(containerId = 'rylie-chat') {
  // Create container if it doesn't exist
  let container = document.getElementById(containerId);
  if (!container) {
    container = document.createElement('div');
    container.id = containerId;
    document.body.appendChild(container);
  }

  const root = createRoot(container);
  root.render(<EmbeddedChat containerId={containerId} autoOpen={true} />);
}

// Make available globally
(window as any).RylieChat = {
  init: initChat
};

// Auto-initialize if script is loaded with data-auto-init
if (document.currentScript?.getAttribute('data-auto-init') === 'true') {
  initChat();
}
