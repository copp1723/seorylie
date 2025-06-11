import React from 'react';
import { Card } from '../components/ui/card';

export default function Requests() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Service Requests</h1>
        <p className="text-gray-600 mt-2">Manage and track your service requests</p>
      </div>

      <Card className="p-6">
        <p className="text-gray-500">No requests to display</p>
      </Card>
    </div>
  );
}