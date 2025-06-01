import type { Meta, StoryObj } from '@storybook/react';
import PageHeading from './page-heading';
import { Button } from './ui/button';

const meta: Meta<typeof PageHeading> = {
  title: 'Components/PageHeading',
  component: PageHeading,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'A reusable page heading component with title, description, and action slots.',
      },
    },
  },
  argTypes: {
    title: {
      description: 'The main title of the page',
      control: 'text',
    },
    description: {
      description: 'Optional description text below the title',
      control: 'text',
    },
    actions: {
      description: 'Action buttons or elements to display on the right side',
      control: false,
    },
    children: {
      description: 'Alternative to actions prop for right-side content',
      control: false,
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: 'Dashboard',
    description: 'Overview of your automotive dealership performance',
  },
};

export const WithDescription: Story = {
  args: {
    title: 'Vehicle Inventory',
    description: 'Manage your dealership\'s vehicle inventory, pricing, and availability. Track sales performance and optimize your stock levels.',
  },
};

export const WithActions: Story = {
  args: {
    title: 'Lead Management',
    description: 'Manage and track customer leads from various sources',
    children: (
      <div className="flex gap-2">
        <Button variant="outline">Export</Button>
        <Button>Add Lead</Button>
      </div>
    ),
  },
};

export const WithMultipleActions: Story = {
  args: {
    title: 'Analytics Dashboard',
    description: 'Comprehensive analytics and reporting for your dealership performance',
    children: (
      <div className="flex gap-2">
        <Button variant="ghost" size="sm">Refresh</Button>
        <Button variant="outline" size="sm">Settings</Button>
        <Button variant="outline" size="sm">Export PDF</Button>
        <Button size="sm">Generate Report</Button>
      </div>
    ),
  },
};

export const LongTitle: Story = {
  args: {
    title: 'Advanced Customer Relationship Management and Lead Tracking System',
    description: 'Comprehensive tools for managing customer relationships, tracking leads through the sales funnel, and optimizing your dealership\'s customer acquisition process.',
  },
};

export const MinimalNoDescription: Story = {
  args: {
    title: 'Settings',
  },
};