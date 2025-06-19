// Updated TaskCreationForm with proper context usage
import { useState } from 'react';
import { useBranding } from '../contexts/AgencyBrandingContext';
import { useAuth } from '../contexts/AuthContext';

const TaskCreationForm = ({ initialType, initialData, onSuccess }) => {
  const { branding } = useBranding(); // From Agent 2
  const { user } = useAuth();
  
  // Get agency_id from branding context
  const agency_id = branding?.agency_id || user?.agency_id;
  const dealership_id = user?.dealership_id; // Assumes user context has this
  
  // ... rest of Agent 1's form code with proper IDs
}