import { StateCreator } from 'zustand';

export interface UIState {
  isLoading: boolean;
  error: string | null;
}

export interface UIActions {
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export type UIStoreSlice = UIState & UIActions;

export const initialUIState: UIState = {
  isLoading: false,
  error: null,
};

export const createUISlice = (set: Parameters<StateCreator<UIStoreSlice>>[0]) => ({
  ...initialUIState,
  setLoading: (isLoading: boolean) => set({ isLoading }),
  setError: (error: string | null) => set({ error }),
}); 