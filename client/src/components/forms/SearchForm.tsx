import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";
import { Slider } from "../ui/slider";
import { Search } from "lucide-react";

// Define form schema with validation
const formSchema = z.object({
  condition: z.enum(["all", "new", "used", "cpo"]).default("all"),
  make: z.string().optional(),
  model: z.string().optional(),
  minYear: z
    .number()
    .min(1990)
    .max(new Date().getFullYear() + 1),
  maxYear: z
    .number()
    .min(1990)
    .max(new Date().getFullYear() + 1),
  minPrice: z.number().min(0),
  maxPrice: z.number().min(0),
  keywords: z.string().optional(),
});

type SearchFormValues = z.infer<typeof formSchema>;

interface SearchFormProps {
  onSubmit: (data: SearchFormValues) => void;
  makes: string[];
  models?: string[];
  isLoading?: boolean;
  compact?: boolean;
}

export function SearchForm({
  onSubmit,
  makes,
  models = [],
  isLoading = false,
  compact = false,
}: SearchFormProps) {
  // Initialize form with react-hook-form
  const form = useForm<SearchFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      condition: "all",
      make: "",
      model: "",
      minYear: 2010,
      maxYear: new Date().getFullYear() + 1,
      minPrice: 0,
      maxPrice: 100000,
      keywords: "",
    },
  });

  // Handle form submission
  const handleSubmit = (values: SearchFormValues) => {
    onSubmit(values);
  };

  // Get the selected make to filter models
  const selectedMake = form.watch("make");

  // Filter models based on selected make (in a real app, this would be API-driven)
  const filteredModels = selectedMake
    ? models.filter((model) => model.startsWith(selectedMake.charAt(0)))
    : [];

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <div
          className={`grid ${compact ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-4"} gap-4`}
        >
          <FormField
            control={form.control}
            name="condition"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Condition</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select condition" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="all">All Conditions</SelectItem>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="used">Used</SelectItem>
                    <SelectItem value="cpo">Certified Pre-Owned</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="make"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Make</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value || ""}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Any Make" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="">Any Make</SelectItem>
                    {makes.map((make) => (
                      <SelectItem key={make} value={make}>
                        {make}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="model"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Model</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value || ""}
                  disabled={!selectedMake}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          selectedMake ? "Any Model" : "Select Make First"
                        }
                      />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="">Any Model</SelectItem>
                    {filteredModels.map((model) => (
                      <SelectItem key={model} value={model}>
                        {model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="keywords"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Keywords</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., leather, sunroof" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {!compact && (
          <>
            <div className="space-y-2">
              <FormField
                control={form.control}
                name="minPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Price Range: ${field.value.toLocaleString()} - $
                      {form.watch("maxPrice").toLocaleString()}
                    </FormLabel>
                    <FormControl>
                      <Slider
                        min={0}
                        max={150000}
                        step={1000}
                        value={[field.value, form.watch("maxPrice")]}
                        onValueChange={([min, max]) => {
                          field.onChange(min);
                          form.setValue("maxPrice", max);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-2">
              <FormField
                control={form.control}
                name="minYear"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Year Range: {field.value} - {form.watch("maxYear")}
                    </FormLabel>
                    <FormControl>
                      <Slider
                        min={1990}
                        max={new Date().getFullYear() + 1}
                        step={1}
                        value={[field.value, form.watch("maxYear")]}
                        onValueChange={([min, max]) => {
                          field.onChange(min);
                          form.setValue("maxYear", max);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </>
        )}

        <Button type="submit" className="w-full" disabled={isLoading}>
          <Search className="h-4 w-4 mr-2" />
          {isLoading ? "Searching..." : "Search Vehicles"}
        </Button>
      </form>
    </Form>
  );
}
