import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Vehicle {
  id: number;
  make: string;
  model: string;
  year: number;
  trim: string;
  exteriorColor: string;
  interiorColor: string;
  vin: string;
  mileage: number;
  features: string[];
  isActive: boolean;
}

export default function Inventory() {
  const [dealershipFilter, setDealershipFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showActive, setShowActive] = useState(true);

  // Sample inventory data
  const sampleVehicles: Vehicle[] = [
    {
      id: 1,
      make: "Toyota",
      model: "RAV4",
      year: 2023,
      trim: "XLE Premium",
      exteriorColor: "Blueprint",
      interiorColor: "Black",
      vin: "4T3Z1RFX4PU123456",
      mileage: 5,
      features: ["AWD", "Sunroof", "Heated Seats", "Apple CarPlay"],
      isActive: true,
    },
    {
      id: 2,
      make: "Honda",
      model: "Civic",
      year: 2022,
      trim: "Touring",
      exteriorColor: "Sonic Gray",
      interiorColor: "Black",
      vin: "2HGFE1F57NH123456",
      mileage: 15000,
      features: ["Leather Seats", "Navigation", "Android Auto"],
      isActive: true,
    },
    {
      id: 3,
      make: "Ford",
      model: "F-150",
      year: 2023,
      trim: "Lariat",
      exteriorColor: "Oxford White",
      interiorColor: "Tan",
      vin: "1FTFW1E52NFB12345",
      mileage: 2500,
      features: ["4x4", "Tow Package", "360 Camera", "Moonroof"],
      isActive: true,
    },
    {
      id: 4,
      make: "Chevrolet",
      model: "Equinox",
      year: 2022,
      trim: "Premier",
      exteriorColor: "Mosaic Black",
      interiorColor: "Jet Black",
      vin: "3GNAXUEV7NL123456",
      mileage: 8500,
      features: ["AWD", "Leather", "Bose Audio"],
      isActive: false,
    },
    {
      id: 5,
      make: "Tesla",
      model: "Model 3",
      year: 2023,
      trim: "Long Range",
      exteriorColor: "Deep Blue Metallic",
      interiorColor: "White",
      vin: "5YJ3E1EA8PF123456",
      mileage: 1200,
      features: ["Autopilot", "Glass Roof", "Premium Audio"],
      isActive: true,
    },
  ];

  // Filter vehicles based on search query, active status, and dealership
  const filteredVehicles = sampleVehicles.filter((vehicle) => {
    const matchesSearch =
      searchQuery === "" ||
      vehicle.make.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vehicle.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vehicle.vin.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = showActive ? vehicle.isActive : true;
    
    return matchesSearch && matchesStatus;
  });

  return (
    <>
      <div className="flex flex-col space-y-2 md:flex-row md:items-center md:justify-between md:space-y-0 mb-6">
        <h1 className="text-2xl font-medium">Inventory</h1>
        <Button className="inline-flex items-center">
          <span className="material-icons text-sm mr-1">add</span>
          Add Vehicle
        </Button>
      </div>

      <Card className="p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Search by make, model, or VIN..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 pl-10 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <span className="absolute top-2.5 left-3 material-icons text-neutral-400 text-sm">
              search
            </span>
          </div>
          <div className="relative">
            <select
              value={dealershipFilter}
              onChange={(e) => setDealershipFilter(e.target.value)}
              className="w-full px-4 py-2 border rounded-md appearance-none focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="all">All Dealerships</option>
              <option value="florida">Florida Motors</option>
              <option value="texas">Texas Auto Group</option>
              <option value="california">California Cars</option>
            </select>
            <span className="absolute top-2.5 right-3 material-icons text-neutral-400 text-sm pointer-events-none">
              arrow_drop_down
            </span>
          </div>
          <div className="flex items-center">
            <label className="inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={showActive}
                onChange={(e) => setShowActive(e.target.checked)}
              />
              <div className="relative w-11 h-6 bg-neutral-200 rounded-full peer peer-checked:bg-primary">
                <div className="absolute w-4 h-4 bg-white rounded-full left-1 top-1 peer-checked:left-6 transition-all"></div>
              </div>
              <span className="ml-3 text-sm font-medium">Show active vehicles only</span>
            </label>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredVehicles.map((vehicle) => (
          <Card key={vehicle.id} className="overflow-hidden shadow hover:shadow-md transition-shadow">
            <div className="h-40 bg-neutral-200 relative">
              <div className="absolute top-2 right-2">
                {!vehicle.isActive && (
                  <span className="px-2 py-1 text-xs font-medium bg-neutral-800 text-white rounded-md">
                    Inactive
                  </span>
                )}
                {vehicle.mileage < 100 && (
                  <span className="px-2 py-1 text-xs font-medium bg-green-600 text-white rounded-md ml-2">
                    New
                  </span>
                )}
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="material-icons text-5xl text-neutral-400">
                  directions_car
                </span>
              </div>
            </div>
            <div className="p-4">
              <h3 className="text-lg font-medium mb-1">
                {vehicle.year} {vehicle.make} {vehicle.model}
              </h3>
              <p className="text-sm text-neutral-500 mb-2">{vehicle.trim}</p>
              <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
                <div>
                  <span className="text-neutral-500">Color:</span>{" "}
                  {vehicle.exteriorColor}
                </div>
                <div>
                  <span className="text-neutral-500">Interior:</span>{" "}
                  {vehicle.interiorColor}
                </div>
                <div>
                  <span className="text-neutral-500">Mileage:</span>{" "}
                  {vehicle.mileage.toLocaleString()}
                </div>
                <div>
                  <span className="text-neutral-500">VIN:</span>{" "}
                  {vehicle.vin.slice(-6)}
                </div>
              </div>
              <div className="mb-3">
                <p className="text-sm font-medium mb-1">Features:</p>
                <div className="flex flex-wrap gap-1">
                  {vehicle.features.map((feature, index) => (
                    <span
                      key={index}
                      className="px-2 py-0.5 text-xs bg-neutral-100 rounded"
                    >
                      {feature}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs flex items-center"
                >
                  <span className="material-icons text-xs mr-1">edit</span>
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs flex items-center text-error border-error hover:bg-error/10"
                >
                  <span className="material-icons text-xs mr-1">
                    {vehicle.isActive ? "visibility_off" : "visibility"}
                  </span>
                  {vehicle.isActive ? "Deactivate" : "Activate"}
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
