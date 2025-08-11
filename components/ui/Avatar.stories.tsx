import type { Meta, StoryObj } from '@storybook/react';
import { Avatar } from './Avatar';

const meta: Meta<typeof Avatar> = {
  title: 'Design System/Avatar',
  component: Avatar,
};
export default meta;

type Story = StoryObj<typeof Avatar>;

export const Default: Story = {
  args: {
    src: 'https://placehold.co/128x128/4A55A2/FFFFFF?text=V',
    alt: 'Veteran Avatar',
    size: 'md',
  },
};

export const Large: Story = {
  args: {
    src: 'https://placehold.co/128x128/4A55A2/FFFFFF?text=V',
    alt: 'Veteran Avatar',
    size: 'lg',
  },
};
