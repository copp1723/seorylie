import type { Meta, StoryObj } from "@storybook/react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./Tabs";

const meta: Meta<typeof Tabs> = {
  title: "Components/UI/Tabs",
  component: Tabs,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A set of layered sections of content—known as tab panels—that are displayed one at a time.",
      },
    },
  },
  argTypes: {
    defaultValue: {
      description:
        "The value of the tab that should be active when initially rendered.",
      control: "text",
    },
    orientation: {
      description: "The orientation of the component.",
      control: "radio",
      options: ["horizontal", "vertical"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    defaultValue: "tab1",
    className: "w-[400px]",
  },
  render: (args) => (
    <Tabs {...args}>
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="tab1">Account</TabsTrigger>
        <TabsTrigger value="tab2">Password</TabsTrigger>
      </TabsList>
      <TabsContent value="tab1" className="space-y-2">
        <h3 className="text-lg font-semibold">Account Settings</h3>
        <p className="text-sm text-muted-foreground">
          Make changes to your account here. Click save when you're done.
        </p>
      </TabsContent>
      <TabsContent value="tab2" className="space-y-2">
        <h3 className="text-lg font-semibold">Password Settings</h3>
        <p className="text-sm text-muted-foreground">
          Change your password here. After saving, you'll be logged out.
        </p>
      </TabsContent>
    </Tabs>
  ),
};

export const Vertical: Story = {
  args: {
    defaultValue: "general",
    orientation: "vertical",
    className: "w-[600px] h-[300px]",
  },
  render: (args) => (
    <Tabs {...args}>
      <div className="flex">
        <TabsList className="grid h-full grid-rows-4 mr-4">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>
        <div className="flex-1">
          <TabsContent value="general">
            <h3 className="text-lg font-semibold mb-2">General Settings</h3>
            <p className="text-sm text-muted-foreground">
              Configure general application settings and preferences.
            </p>
          </TabsContent>
          <TabsContent value="security">
            <h3 className="text-lg font-semibold mb-2">Security Settings</h3>
            <p className="text-sm text-muted-foreground">
              Manage your security preferences and authentication options.
            </p>
          </TabsContent>
          <TabsContent value="integrations">
            <h3 className="text-lg font-semibold mb-2">Integration Settings</h3>
            <p className="text-sm text-muted-foreground">
              Connect and configure third-party integrations.
            </p>
          </TabsContent>
          <TabsContent value="advanced">
            <h3 className="text-lg font-semibold mb-2">Advanced Settings</h3>
            <p className="text-sm text-muted-foreground">
              Advanced configuration options for power users.
            </p>
          </TabsContent>
        </div>
      </div>
    </Tabs>
  ),
};

export const ThreeTabs: Story = {
  args: {
    defaultValue: "overview",
    className: "w-[500px]",
  },
  render: (args) => (
    <Tabs {...args}>
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="analytics">Analytics</TabsTrigger>
        <TabsTrigger value="reports">Reports</TabsTrigger>
      </TabsList>
      <TabsContent value="overview" className="space-y-2">
        <h3 className="text-lg font-semibold">Dashboard Overview</h3>
        <p className="text-sm text-muted-foreground">
          View key metrics and insights at a glance.
        </p>
      </TabsContent>
      <TabsContent value="analytics" className="space-y-2">
        <h3 className="text-lg font-semibold">Analytics Dashboard</h3>
        <p className="text-sm text-muted-foreground">
          Detailed analytics and performance metrics.
        </p>
      </TabsContent>
      <TabsContent value="reports" className="space-y-2">
        <h3 className="text-lg font-semibold">Generated Reports</h3>
        <p className="text-sm text-muted-foreground">
          Download and view generated reports and exports.
        </p>
      </TabsContent>
    </Tabs>
  ),
};

export const Disabled: Story = {
  args: {
    defaultValue: "tab1",
    className: "w-[400px]",
  },
  render: (args) => (
    <Tabs {...args}>
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="tab1">Available</TabsTrigger>
        <TabsTrigger value="tab2" disabled>
          Disabled
        </TabsTrigger>
        <TabsTrigger value="tab3">Also Available</TabsTrigger>
      </TabsList>
      <TabsContent value="tab1" className="space-y-2">
        <h3 className="text-lg font-semibold">Available Content</h3>
        <p className="text-sm text-muted-foreground">
          This tab is available and contains content.
        </p>
      </TabsContent>
      <TabsContent value="tab2" className="space-y-2">
        <h3 className="text-lg font-semibold">Disabled Content</h3>
        <p className="text-sm text-muted-foreground">
          This content should not be accessible.
        </p>
      </TabsContent>
      <TabsContent value="tab3" className="space-y-2">
        <h3 className="text-lg font-semibold">Another Available Tab</h3>
        <p className="text-sm text-muted-foreground">
          This tab is also available and working properly.
        </p>
      </TabsContent>
    </Tabs>
  ),
};
