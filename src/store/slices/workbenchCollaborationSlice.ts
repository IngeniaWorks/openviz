import { StateCreator } from "zustand";
import { AppState } from "../storeTypes";
import { NodeLockState, PresenceState } from "@/types";

export interface WorkbenchCollaborationSlice {
    currentSceneVersion: number;
    nodeLocks: Record<string, NodeLockState>;
    presenceByUser: Record<string, PresenceState>;
    setCurrentSceneVersion: (version: number) => void;
    setNodeLockState: (lock: NodeLockState) => void;
    clearNodeLockState: (nodeId: string) => void;
    upsertPresenceState: (presence: PresenceState) => void;
    clearPresenceState: (userId: string) => void;
    clearCollaborationState: () => void;
}

export const createWorkbenchCollaborationSlice: StateCreator<AppState, [], [], WorkbenchCollaborationSlice> = (set) => ({
    currentSceneVersion: 0,
    nodeLocks: {},
    presenceByUser: {},
    setCurrentSceneVersion: (version) => set({ currentSceneVersion: version }),
    setNodeLockState: (lock) =>
        set((state: AppState) => ({
            nodeLocks: {
                ...state.nodeLocks,
                [lock.nodeId]: lock,
            },
        })),
    clearNodeLockState: (nodeId) =>
        set((state: AppState) => {
            const nextLocks = { ...state.nodeLocks };
            delete nextLocks[nodeId];
            return { nodeLocks: nextLocks };
        }),
    upsertPresenceState: (presence) =>
        set((state: AppState) => ({
            presenceByUser: {
                ...state.presenceByUser,
                [presence.userId]: presence,
            },
        })),
    clearPresenceState: (userId) =>
        set((state: AppState) => {
            const nextPresence = { ...state.presenceByUser };
            delete nextPresence[userId];
            return { presenceByUser: nextPresence };
        }),
    clearCollaborationState: () =>
        set({
            nodeLocks: {},
            presenceByUser: {},
        }),
});
