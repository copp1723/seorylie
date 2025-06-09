export default function Requests() {
  return (
    <div className="flex-1 p-6">
      <h1 className="text-2xl font-bold mb-2">All Requests</h1>
      <p className="mb-6 text-muted-foreground">Every SEO, blog, GBP, and maintenance request you’ve submitted or managed will show here.</p>
      {/* Table or timeline of requests will go here */}
      <div className="rounded-lg border p-6 bg-background shadow text-muted-foreground">No requests yet! Start from the chat.</div>
    </div>
  );
}
