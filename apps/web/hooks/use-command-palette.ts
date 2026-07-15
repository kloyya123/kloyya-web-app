import { create } from 'zustand';

/**
 * Global UI state for the command palette, per KFA's state taxonomy
 * ("Global State: … Sidebar, Theme, Notifications").
 *
 * A store rather than lifted React state because the palette has two owners that
 * never meet in the tree: a global keyboard shortcut, and a button in the top bar.
 */
interface CommandPaletteStore {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  setOpen: (isOpen: boolean) => void;
}

export const useCommandPalette = create<CommandPaletteStore>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
  setOpen: (isOpen) => set({ isOpen }),
}));
