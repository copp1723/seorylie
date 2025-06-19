import { fetchAPI } from '../lib/api';

/**
 * Input for creating a new dealer tenant
 */
export interface CreateDealerInput {
  name: string;
  email: string;
  contactName?: string;
  website?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  parentAgencyId?: string; // only super admin needs to specify
  brand?: {
    primaryColor?: string;
    secondaryColor?: string;
    logoUrl?: string;
  };
}

export interface Dealer {
  id: string;
  name: string;
  slug: string;
  parentId: string;
  brand: {
    name: string;
    primaryColor?: string;
    secondaryColor?: string;
    logoUrl?: string;
  };
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

export interface DealerResponse {
  success: boolean;
  data: Dealer;
}

export interface DealersListResponse {
  success: boolean;
  data: Dealer[];
}

export interface CreateDealerResponse {
  success: boolean;
  data: {
    tenantId: string;
    userId: string;
    name: string;
    slug: string;
    parentAgencyId: string;
  };
}

export const dealersAPI = {
  /** Create dealer tenant (agency/super) */
  async create(input: CreateDealerInput): Promise<CreateDealerResponse> {
    const res = await fetchAPI('/dealers', {
      method: 'POST',
      body: JSON.stringify(input)
    });
    return await res.json();
  },

  /** List dealers under current agency */
  async list(): Promise<DealersListResponse> {
    const res = await fetchAPI('/dealers');
    return await res.json();
  },

  /** Get dealer details by ID */
  async get(id: string): Promise<DealerResponse> {
    const res = await fetchAPI(`/dealers/${id}`);
    return await res.json();
  },

  /** Update dealer information */
  async update(id: string, data: Partial<CreateDealerInput>): Promise<DealerResponse> {
    const res = await fetchAPI(`/dealers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    return await res.json();
  }
};
