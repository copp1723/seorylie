import React, { useState } from "react";
import { VehicleCard } from "./VehicleCard";
import { Input } from "../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Button } from "../ui/button";
import { Slider } from "../ui/slider";
import { Label } from "../ui/label";
import { Search, Filter, SlidersHorizontal } from "lucide-react";

interface Vehicle {
  id: string;
  year: number;
  make: string;
  model: string;
  trim?: string;
  price: number;
  mileage?: number;
  exteriorColor?: string;
  fuelType?: string;
  transmission?: string;
  vin: string;
  stockNumber: string;
  condition: "new" | "used" | "cpo";
  imageUrl?: string;
  features?: string[];
}

interface VehicleListProps {
  vehicles: Vehicle[];
  onViewDetails: (vehicleId: string) => void;
}

export function VehicleList({ vehicles, onViewDetails }: VehicleListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState({
    condition: "",
    make: "",
    minPrice: 0,
    maxPrice: 100000,
    minYear: 2010,
    maxYear: new Date().getFullYear() + 1,
  });
  const [showFilters, setShowFilters] = useState(false);

  // Get unique makes for the filter dropdown
  const makes = [...new Set(vehicles.map((vehicle) => vehicle.make))].sort();

  // Filter vehicles based on search and filters
  const filteredVehicles = vehicles.filter((vehicle) => {
    const matchesSearch =
      searchTerm === "" ||
      `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim || ""}`
        .toLowerCase()
        .includes(searchTerm.toLowerCase());

    const matchesCondition =
      filters.condition === "" || vehicle.condition === filters.condition;
    const matchesMake = filters.make === "" || vehicle.make === filters.make;
    const matchesPrice =
      vehicle.price >= filters.minPrice && vehicle.price <= filters.maxPrice;
    const matchesYear =
      vehicle.year >= filters.minYear && vehicle.year <= filters.maxYear;

    return (
      matchesSearch &&
      matchesCondition &&
      matchesMake &&
      matchesPrice &&
      matchesYear
    );
  });

  const handleFilterChange = (key: string, value: string | number) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setFilters({
      condition: "",
      make: "",
      minPrice: 0,
      maxPrice: 100000,
      minYear: 2010,
      maxYear: new Date().getFullYear() + 1,
    });
    setSearchTerm("");
  };

  return (
    <div className="space-y-6">
      {/* Search and Filter Controls */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search vehicles..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border rounded-lg">
            <div>
              <Label htmlFor="condition">Condition</Label>
              <Select
                value={filters.condition}
                onValueChange={(value) =>
                  handleFilterChange("condition", value)
                }
              >
                <SelectTrigger id="condition">
                  <SelectValue placeholder="All Conditions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Conditions</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="used">Used</SelectItem>
                  <SelectItem value="cpo">Certified Pre-Owned</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="make">Make</Label>
              <Select
                value={filters.make}
                onValueChange={(value) => handleFilterChange("make", value)}
              >
                <SelectTrigger id="make">
                  <SelectValue placeholder="All Makes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Makes</SelectItem>
                  {makes.map((make) => (
                    <SelectItem key={make} value={make}>
                      {make}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Price Range</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm">
                  ${filters.minPrice.toLocaleString()}
                </span>
                <Slider
                  min={0}
                  max={100000}
                  step={1000}
                  value={[filters.minPrice, filters.maxPrice]}
                  onValueChange={([min, max]) => {
                    handleFilterChange("minPrice", min);
                    handleFilterChange("maxPrice", max);
                  }}
                  className="flex-1"
                />
                <span className="text-sm">
                  ${filters.maxPrice.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="md:col-span-2">
              <Label>Year Range</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm">{filters.minYear}</span>
                <Slider
                  min={2000}
                  max={new Date().getFullYear() + 1}
                  step={1}
                  value={[filters.minYear, filters.maxYear]}
                  onValueChange={([min, max]) => {
                    handleFilterChange("minYear", min);
                    handleFilterChange("maxYear", max);
                  }}
                  className="flex-1"
                />
                <span className="text-sm">{filters.maxYear}</span>
              </div>
            </div>

            <div className="flex items-end">
              <Button variant="outline" onClick={resetFilters}>
                Reset Filters
              </Button>
            </div>
          </div>
        )}

        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">
            Showing {filteredVehicles.length} of {vehicles.length} vehicles
          </p>
          <Select defaultValue="price_asc">
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="price_asc">Price: Low to High</SelectItem>
              <SelectItem value="price_desc">Price: High to Low</SelectItem>
              <SelectItem value="year_desc">Year: Newest First</SelectItem>
              <SelectItem value="year_asc">Year: Oldest First</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Vehicle Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredVehicles.length > 0 ? (
          filteredVehicles.map((vehicle) => (
            <VehicleCard
              key={vehicle.id}
              vehicle={vehicle}
              onViewDetails={onViewDetails}
            />
          ))
        ) : (
          <div className="col-span-full text-center py-12">
            <p className="text-lg font-medium">
              No vehicles match your search criteria
            </p>
            <p className="text-muted-foreground">
              Try adjusting your filters or search term
            </p>
            <Button variant="outline" className="mt-4" onClick={resetFilters}>
              Reset All Filters
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
