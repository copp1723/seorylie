import { Card } from "@/components/ui/card";

interface ApiEndpoint {
  path: string;
  status: "operational" | "degraded" | "down";
  uptime: string;
}

interface ApiStatusProps {
  endpoints: ApiEndpoint[];
}

export default function ApiStatus({ endpoints }: ApiStatusProps) {
  const getStatusColor = (status: ApiEndpoint["status"]) => {
    switch (status) {
      case "operational":
        return "text-success";
      case "degraded":
        return "text-warning";
      case "down":
        return "text-error";
      default:
        return "text-neutral-500";
    }
  };

  return (
    <Card className="bg-white shadow card">
      <div className="p-4 border-b">
        <h2 className="text-lg font-medium">API Endpoints</h2>
      </div>
      <div className="p-4 space-y-4">
        {endpoints.map((endpoint) => (
          <div key={endpoint.path} className="p-3 rounded-md bg-neutral-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <span className={`material-icons ${getStatusColor(endpoint.status)} mr-2`}>
                  circle
                </span>
                <code className="text-sm font-mono">{endpoint.path}</code>
              </div>
              <span className="text-xs text-neutral-500">{endpoint.uptime}</span>
            </div>
          </div>
        ))}

        <a
          href="#"
          className="block px-4 py-2 text-sm font-medium text-center text-primary bg-primary/5 rounded-md hover:bg-primary/10"
        >
          View API Documentation
        </a>
      </div>
    </Card>
  );
}
