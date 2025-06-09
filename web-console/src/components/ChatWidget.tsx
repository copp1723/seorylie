export default function ChatWidget() {
  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col p-4 border rounded-lg shadow">
      <div className="flex-1 overflow-y-auto" style={{ minHeight: 200 }}>Conversation will appear here.</div>
      <form className="flex mt-4">
        <input 
          className="flex-1 border rounded px-3 py-2 mr-2 bg-background" 
          placeholder="Type your message..." />
        <button className="bg-primary text-primary-foreground px-4 py-2 rounded" type="submit">Send</button>
      </form>
    </div>
  );
}
