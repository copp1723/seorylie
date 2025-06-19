import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Globe, MapPin, Users, TrendingUp } from 'lucide-react';

interface GeographicData {
  countries: Array<{
    country: string;
    countryCode: string;
    sessions: number;
    users: number;
    newUsers: number;
    bounceRate: number;
    avgSessionDuration: number;
    conversions: number;
    percentage: number;
  }>;
  cities: Array<{
    city: string;
    region: string;
    country: string;
    sessions: number;
    users: number;
    conversions: number;
    percentage: number;
  }>;
  summary: {
    totalCountries: number;
    totalCities: number;
    topCountry: string;
    topCity: string;
  };
}

interface GeographicTrafficProps {
  propertyId: string;
  dateRange: {
    startDate: Date;
    endDate: Date;
  };
}

export function GeographicTraffic({ propertyId, dateRange }: GeographicTrafficProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['geographic-traffic', propertyId, dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        propertyId,
        startDate: dateRange.startDate.toISOString().split('T')[0],
        endDate: dateRange.endDate.toISOString().split('T')[0]
      });

      const response = await fetch(`/api/ga4/geographic?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch geographic data');
      }

      return response.json() as Promise<GeographicData>;
    },
  });

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Geographic Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="animate-pulse">Loading geographic data...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Geographic Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground">
            Geographic data unavailable
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Geographic Distribution
            </CardTitle>
            <CardDescription>
              Traffic breakdown by location
            </CardDescription>
          </div>
          <div className="flex gap-4 text-sm">
            <div className="text-center">
              <p className="text-2xl font-bold">{data.summary.totalCountries}</p>
              <p className="text-muted-foreground">Countries</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{data.summary.totalCities}</p>
              <p className="text-muted-foreground">Cities</p>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="countries" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="countries">Countries</TabsTrigger>
            <TabsTrigger value="cities">Cities</TabsTrigger>
          </TabsList>

          <TabsContent value="countries" className="space-y-4">
            <div className="space-y-3">
              {data.countries.slice(0, 10).map((country, index) => (
                <div key={country.countryCode} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {index + 1}. {country.country}
                      </span>
                      {index === 0 && (
                        <Badge variant="default" className="text-xs">
                          Top Country
                        </Badge>
                      )}
                    </div>
                    <span className="text-sm font-medium">
                      {country.sessions.toLocaleString()} sessions
                    </span>
                  </div>
                  <Progress value={country.percentage} className="h-2" />
                  <div className="grid grid-cols-4 gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      <span>{country.users.toLocaleString()} users</span>
                    </div>
                    <div>
                      <span>{country.newUsers.toLocaleString()} new users</span>
                    </div>
                    <div>
                      <span>{country.bounceRate.toFixed(1)}% bounce rate</span>
                    </div>
                    <div>
                      <span>{formatDuration(country.avgSessionDuration)} avg. duration</span>
                    </div>
                  </div>
                  {country.conversions > 0 && (
                    <div className="flex items-center gap-1 text-sm text-green-600">
                      <TrendingUp className="h-3 w-3" />
                      <span>{country.conversions} conversions</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="cities" className="space-y-4">
            <div className="space-y-3">
              {data.cities.slice(0, 10).map((city, index) => (
                <div key={`${city.city}-${city.region}`} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <span className="font-medium">
                          {city.city}
                        </span>
                        <span className="text-sm text-muted-foreground ml-2">
                          {city.region}, {city.country}
                        </span>
                      </div>
                      {index === 0 && (
                        <Badge variant="default" className="text-xs">
                          Top City
                        </Badge>
                      )}
                    </div>
                    <span className="text-sm font-medium">
                      {city.sessions.toLocaleString()} sessions
                    </span>
                  </div>
                  <Progress value={city.percentage} className="h-2" />
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      <span>{city.users.toLocaleString()} users</span>
                    </div>
                    {city.conversions > 0 && (
                      <div className="flex items-center gap-1 text-green-600">
                        <TrendingUp className="h-3 w-3" />
                        <span>{city.conversions} conversions</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}