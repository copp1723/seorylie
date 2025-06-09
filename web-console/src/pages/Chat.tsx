import ChatWidget from "../components/ChatWidget";

export default function Chat() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center">
      <h2 className="mb-4 text-3xl font-bold">Welcome to Rylie! 👋</h2>
      <p className="text-muted-foreground mb-8">How can I help with your SEO today?</p>
      <ChatWidget />
    </div>
  );
}
