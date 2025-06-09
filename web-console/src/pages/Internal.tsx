export default function Internal() {
  return (
    <div className="flex-1 p-6">
      <h1 className="text-2xl font-bold mb-2">Internal Ops</h1>
      <p className="mb-6 text-muted-foreground">For PureCars managers/support only: audit logs, vendor routing, escalations, and impersonation tools.</p>
      <div className="rounded-lg border p-6 bg-background shadow text-muted-foreground">Restricted area. Will display when admin/support user is logged in.</div>
    </div>
  );
}
