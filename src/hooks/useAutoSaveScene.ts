import { useEffect, useRef, useCallback } from "react";
import { useStore } from "@/store/useStore";
import { useShallow } from "zustand/react/shallow";
import { onImmediateSceneSaveRequested } from "@/services/workbench/sceneSyncBus";

const PROJECT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const AUTOSAVE_DEBOUNCE_MS = 1000;
// Browsers cap keepalive request bodies at ~64KB, so only flush small scenes on unload.
const KEEPALIVE_MAX_BODY_BYTES = 60 * 1024;

type SceneSnapshot = {
    data: { nodes: unknown[]; connections: unknown[] };
    json: string;
};

export function useAutoSaveScene(projectId: string | null) {
    const { workbenchNodes, connections, currentSceneVersion, setCurrentSceneVersion } = useStore(
        useShallow((state) => ({
            workbenchNodes: state.workbenchNodes,
            connections: state.connections,
            currentSceneVersion: state.currentSceneVersion,
            setCurrentSceneVersion: state.setCurrentSceneVersion,
        }))
    );
    const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastSavedRef = useRef<string>("");
    const versionRef = useRef<number | null>(null);
    const isSavingRef = useRef(false);
    const retryQueueRef = useRef<Array<() => void>>([]);
    const projectIdRef = useRef(projectId);

    useEffect(() => {
        projectIdRef.current = projectId;
    }, [projectId]);

    // Read the latest scene state at save time so gesture-end flushes never persist stale data.
    const getSceneSnapshot = useCallback((): SceneSnapshot => {
        const { workbenchNodes: nodes, connections: currentConnections } = useStore.getState();
        const data = { nodes, connections: currentConnections };
        return { data, json: JSON.stringify(data) };
    }, []);

    const applySavedVersion = useCallback(
        (version: number) => {
            versionRef.current = version;
            setCurrentSceneVersion(version);
        },
        [setCurrentSceneVersion]
    );

    // Process queued saves after current save completes
    const processQueue = useCallback(() => {
        if (retryQueueRef.current.length > 0) {
            const next = retryQueueRef.current.shift();
            void next?.();
        } else {
            isSavingRef.current = false;
        }
    }, []);

    // Extract save logic into a callback
    const saveScene = useCallback(
        async (currentProjectId: string, isRetry = false) => {
            // If already saving and not a retry, queue the save
            if (isSavingRef.current && !isRetry) {
                retryQueueRef.current.push(() => saveScene(currentProjectId, false));
                return;
            }

            isSavingRef.current = true;

            const snapshot = getSceneSnapshot();

            // Only save if data has changed since the last successful sync
            if (snapshot.json === lastSavedRef.current) {
                processQueue();
                return;
            }

            try {
                const response = await fetch(`/api/projects/${currentProjectId}/scenes`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        data: snapshot.data,
                        expectedVersion: versionRef.current ?? undefined,
                    }),
                });

                if (response.ok) {
                    const updatedScene = (await response.json()) as { version?: number };
                    if (typeof updatedScene.version === "number") {
                        applySavedVersion(updatedScene.version);
                    }
                    lastSavedRef.current = snapshot.json;
                    processQueue();
                    return;
                }

                if (response.status === 409) {
                    const conflict = (await response.json()) as {
                        currentVersion?: number;
                        scene?: unknown;
                    };

                    // Update version to server version
                    if (typeof conflict.currentVersion === "number") {
                        applySavedVersion(conflict.currentVersion);
                    }

                    // If server returned scene data, merge with local (local wins for now)
                    // Then retry with correct expected version
                    const retry = await fetch(`/api/projects/${currentProjectId}/scenes`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            data: snapshot.data,
                            expectedVersion: versionRef.current ?? undefined,
                        }),
                    });

                    if (retry.ok) {
                        const retriedScene = (await retry.json()) as { version?: number };
                        if (typeof retriedScene.version === "number") {
                            applySavedVersion(retriedScene.version);
                        }
                        lastSavedRef.current = snapshot.json;
                    } else if (retry.status === 409) {
                        // Still conflicted - queue another retry
                        retryQueueRef.current.push(() => saveScene(currentProjectId, true));
                    }
                }
            } catch (error) {
                console.error("Failed to auto-save scene:", error);
            }

            processQueue();
        },
        [applySavedVersion, getSceneSnapshot, processQueue]
    );

    const saveSceneRef = useRef(saveScene);
    useEffect(() => {
        saveSceneRef.current = saveScene;
    });

    // Flush the pending debounced save immediately when a gesture finishes
    // (node drag stop, connection created, resize end, stroke finished).
    const flushPendingSave = useCallback(() => {
        const currentProjectId = projectIdRef.current;
        if (!currentProjectId || !PROJECT_ID_PATTERN.test(currentProjectId)) {
            return;
        }

        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
            saveTimeoutRef.current = null;
        }

        void saveSceneRef.current?.(currentProjectId);
    }, []);

    useEffect(() => onImmediateSceneSaveRequested(flushPendingSave), [flushPendingSave]);

    // Best-effort sync when the page is reloaded or closed before the debounce fires.
    useEffect(() => {
        const handlePageHide = () => {
            const currentProjectId = projectIdRef.current;
            if (!currentProjectId || !PROJECT_ID_PATTERN.test(currentProjectId)) {
                return;
            }

            let snapshot: SceneSnapshot;
            try {
                snapshot = getSceneSnapshot();
            } catch {
                return;
            }

            if (snapshot.json === lastSavedRef.current) {
                return;
            }

            const body = JSON.stringify({
                data: snapshot.data,
                expectedVersion: versionRef.current ?? undefined,
            });

            if (new Blob([body]).size > KEEPALIVE_MAX_BODY_BYTES) {
                // Too large for a keepalive request; skip rather than drop the whole page.
                return;
            }

            fetch(`/api/projects/${currentProjectId}/scenes`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body,
                keepalive: true,
            }).catch(() => undefined);
        };

        window.addEventListener("pagehide", handlePageHide);
        return () => window.removeEventListener("pagehide", handlePageHide);
    }, [getSceneSnapshot]);

    useEffect(() => {
        if (!projectId) return;
        if (!PROJECT_ID_PATTERN.test(projectId)) {
            return;
        }

        let mounted = true;

        const bootstrapVersion = async () => {
            try {
                const response = await fetch(`/api/projects/${projectId}/scenes`);
                if (!response.ok || !mounted) return;

                const sceneList = (await response.json()) as Array<{ version?: number; isMain?: boolean }>;
                const mainScene = sceneList.find((scene) => scene.isMain) ?? sceneList[0];
                if (mainScene && typeof mainScene.version === "number") {
                    versionRef.current = mainScene.version;
                    setCurrentSceneVersion(mainScene.version);
                }
            } catch (error) {
                console.error("Failed to load scene version:", error);
            }
        };

        void bootstrapVersion();

        return () => {
            mounted = false;
        };
    }, [projectId, setCurrentSceneVersion]);

    useEffect(() => {
        if (typeof currentSceneVersion === "number" && currentSceneVersion > 0) {
            versionRef.current = currentSceneVersion;
        }
    }, [currentSceneVersion]);

    useEffect(() => {
        if (!projectId) return;
        if (!PROJECT_ID_PATTERN.test(projectId)) {
            // Don't auto-save for temporary/local projects (non-UUID IDs)
            return;
        }

        // Debounce the save operation
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }

        saveTimeoutRef.current = setTimeout(() => {
            saveScene(projectId);
        }, AUTOSAVE_DEBOUNCE_MS); // Save 1 second after last change

        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
                saveTimeoutRef.current = null;
                // Flush immediately on unmount (e.g. client-side navigation away)
                void saveSceneRef.current?.(projectId);
            }
        };
    }, [workbenchNodes, connections, projectId, saveScene]);
}
