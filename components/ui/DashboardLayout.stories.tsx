import type { Meta, StoryObj } from '@storybook/react';
import { DashboardLayout } from './DashboardLayout';

const meta: Meta<typeof DashboardLayout> = {
  title: 'Design System/DashboardLayout',
  component: DashboardLayout,
};
export default meta;

type Story = StoryObj<typeof DashboardLayout>;

export const Default: Story = {
  args: {
    menu: (
      <ul className="space-y-2">
        <li className="bg-secondary text-secondary-text font-bold p-3 rounded-lg">Dashboard</li>
        <li className="text-text-light p-3 rounded-lg hover:bg-secondary">My Sessions</li>
      </ul>
    ),
    content: (
      <div>
        <h4 className="text-lg font-bold text-text mb-4">Welcome Back</h4>
        <div className="h-48 bg-surface rounded-xl flex items-center justify-center border-2 border-dashed border-border">
          <p className="text-text-light">Your cozy space</p>
        </div>
      </div>
    ),
  },
};
