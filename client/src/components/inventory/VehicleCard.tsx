import React from "react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { formatCurrency } from "@/lib/utils";

interface VehicleCardProps {
  vehicle: {
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
  };
  onViewDetails: (vehicleId: string) => void;
}

export function VehicleCard({ vehicle, onViewDetails }: VehicleCardProps) {
  const {
    id,
    year,
    make,
    model,
    trim,
    price,
    mileage,
    exteriorColor,
    condition,
    imageUrl,
    stockNumber,
  } = vehicle;

  const vehicleTitle = `${year} ${make} ${model}${trim ? ` ${trim}` : ""}`;

  return (
    <Card className="overflow-hidden">
      <div className="aspect-video relative overflow-hidden bg-muted">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={vehicleTitle}
            className="object-cover w-full h-full"
          />
        ) : (
          <div className="flex items-center justify-center h-full bg-muted">
            <span className="text-muted-foreground">No image available</span>
          </div>
        )}
        <Badge
          className="absolute top-2 right-2"
          variant={
            condition === "new"
              ? "default"
              : condition === "cpo"
                ? "secondary"
                : "outline"
          }
        >
          {condition === "cpo" ? "Certified Pre-Owned" : condition}
        </Badge>
      </div>

      <CardHeader>
        <CardTitle className="text-lg">{vehicleTitle}</CardTitle>
        <div className="text-sm text-muted-foreground">
          Stock# {stockNumber}
        </div>
      </CardHeader>

      <CardContent>
        <div className="text-2xl font-bold mb-2">{formatCurrency(price)}</div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          {mileage !== undefined && (
            <div>
              <span className="text-muted-foreground">Mileage:</span>{" "}
              {mileage.toLocaleString()} mi
            </div>
          )}
          {exteriorColor && (
            <div>
              <span className="text-muted-foreground">Color:</span>{" "}
              {exteriorColor}
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="flex justify-between">
        <Button variant="outline" size="sm" onClick={() => onViewDetails(id)}>
          View Details
        </Button>
        <Button size="sm">Contact Us</Button>
      </CardFooter>
    </Card>
  );
}
