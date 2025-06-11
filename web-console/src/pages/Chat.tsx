import React from 'react';
import { Card } from '../components/ui/card';

export default function Chat() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Chat Support</h1>
        <p className="text-gray-600 mt-2">Get help from our support team</p>
      </div>

      <Card className="p-6">
        <p className="text-gray-500">Chat functionality coming soon</p>
      </Card>
    </div>
  );
}