import { Card } from "@/components/ui/card";

interface DealershipStats {
  conversations: number;
  conversionRate: string;
}

interface FeaturedDealershipProps {
  name: string;
  subtitle: string;
  stats: DealershipStats;
}

export default function FeaturedDealership({
  name,
  subtitle,
  stats,
}: FeaturedDealershipProps) {
  return (
    <Card className="bg-white shadow card">
      <div className="relative h-32 rounded-t-lg">
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent rounded-t-lg"></div>
        <div 
          className="absolute inset-0 rounded-t-lg bg-primary/30"
          style={{
            backgroundImage: "url('https://images.unsplash.com/photo-1606016891133-ec5f2ddcaca4?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=150')",
            backgroundSize: "cover",
            backgroundPosition: "center"
          }}
        ></div>
        <div className="absolute bottom-0 left-0 p-4">
          <h3 className="text-lg font-medium text-white">{name}</h3>
          <p className="text-sm text-white/80">{subtitle}</p>
        </div>
      </div>
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 text-center bg-neutral-50 rounded-md">
            <p className="text-sm text-neutral-500">Conversations</p>
            <p className="text-lg font-medium">{stats.conversations}</p>
          </div>
          <div className="p-3 text-center bg-neutral-50 rounded-md">
            <p className="text-sm text-neutral-500">Conversion Rate</p>
            <p className="text-lg font-medium">{stats.conversionRate}</p>
          </div>
        </div>
        <a
          href="#"
          className="block px-4 py-2 text-sm font-medium text-center text-primary bg-primary/5 rounded-md hover:bg-primary/10"
        >
          View Dealership
        </a>
      </div>
    </Card>
  );
}
