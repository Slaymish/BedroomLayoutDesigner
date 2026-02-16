import { beforeEach, describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../src/App';
import { createDefaultWorkspaceState, STORAGE_KEY, WORKSPACE_STORAGE_VERSION } from '../../src/utils/workspaceState';

describe('selection and rotate interaction', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  test('keeps edit panel open after rotating selected object', async () => {
    const workspace = createDefaultWorkspaceState();
    const room = workspace.rooms[0];

    room.setup.onboardingComplete = true;
    room.setup.onboardingStep = 'openings';
    room.items = [
      {
        id: 1,
        type: 'Bed',
        width: 180,
        height: 200,
        x: 60,
        y: 50,
        rotate: 0,
      },
    ];
    room.nextItemId = 2;
    room.editingItemId = null;

    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...workspace,
        version: WORKSPACE_STORAGE_VERSION,
      })
    );

    const user = userEvent.setup();
    render(<App />);

    const rotateButtonBeforeSelect = screen.queryByRole('button', { name: 'Rotate 90 degrees' });
    expect(rotateButtonBeforeSelect).toBeNull();

    await user.pointer({
      target: screen.getByText('Bed'),
      keys: '[MouseLeft]',
    });

    const rotateButton = await screen.findByRole('button', { name: 'Rotate 90 degrees' });
    expect(screen.getByRole('heading', { name: 'Edit Bed' })).toBeInTheDocument();

    await user.click(rotateButton);

    expect(await screen.findByRole('button', { name: 'Rotate 90 degrees' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Edit Bed' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('90')).toBeInTheDocument();
  });
});
