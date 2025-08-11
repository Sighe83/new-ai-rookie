import type { Meta, StoryObj } from '@storybook/react';
import { Select } from './Select';

const meta: Meta<typeof Select> = {
  title: 'Design System/Select',
  component: Select,
};
export default meta;

type Story = StoryObj<typeof Select>;

export const Default: Story = {
  args: {
    label: 'Choose an option',
    children: [
      <option key="1">Option 1</option>,
      <option key="2">Option 2</option>,
    ],
  },
};

export const Error: Story = {
  args: {
    label: 'With Error',
    error: 'This field is required',
    children: [
      <option key="1">Option 1</option>,
      <option key="2">Option 2</option>,
    ],
  },
};
