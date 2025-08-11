import type { Meta, StoryObj } from '@storybook/react';
import { AvailabilitySelector } from './AvailabilitySelector';

const meta: Meta<typeof AvailabilitySelector> = {
  title: 'Design System/AvailabilitySelector',
  component: AvailabilitySelector,
};
export default meta;

type Story = StoryObj<typeof AvailabilitySelector>;

export const Default: Story = {
  args: {
    slots: [
      { time: '9:00 AM', available: true },
      { time: '10:00 AM', available: true },
      { time: '11:00 AM', available: false },
      { time: '1:00 PM', available: true },
    ],
  },
};
