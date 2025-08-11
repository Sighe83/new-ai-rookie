import type { Meta, StoryObj } from '@storybook/react';
import { Navigation } from './Navigation';

const meta: Meta<typeof Navigation> = {
  title: 'Design System/Navigation',
  component: Navigation,
};
export default meta;

type Story = StoryObj<typeof Navigation>;

export const Primary: Story = {
  args: {
    items: [
      { label: 'Find a Veteran', active: true },
      { label: 'My Sessions', href: '#' },
    ],
    variant: 'primary',
  },
};

export const Secondary: Story = {
  args: {
    items: [
      { label: 'Dashboard', active: true },
      { label: 'Availability', href: '#' },
    ],
    variant: 'secondary',
  },
};
