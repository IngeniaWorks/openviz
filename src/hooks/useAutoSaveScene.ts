import { useEffect, useRef, useCallback } from "react";
import { useStore } from "@/store/useStore";
import { useShallow } from "zustand/react/shallow";

export function useAutoSaveScene(projectId: string | null) {
    const { workbenchNodes, connections, currentSceneVersion, setCurrentSceneVersion } = useStore(
        useShallow((state) => ({
            workbenchNodes: state.workbenchNodes,
            connections: state.connections,
            currentSceneVersion: state.currentSceneVersion,
            setCurrentSceneVersion: state.setCurrentSceneVersion,
        }))
    );
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastSavedRef = useRef<string>("");
    const versionRef = useRef<number | null>(null);
    const nodesRef = useRef(workbenchNodes);
    const connectionsRef = useRef(connections);

    // Keep refs in sync with latest values
    useEffect(() => {
        nodesRef.current = workbenchNodes;
        connectionsRef.current = connections;
    }, [workbenchNodes, connections]);

    // Extract save logic into a callback
    const saveScene = useCallback(async (currentProjectId: string) => {
        const sceneData = {
            nodes: nodesRef.current,
            connections: connectionsRef.current,
        };

        const sceneDataJson = JSON.stringify(sceneData);

        // Only save if data has changed
        if (sceneDataJson === lastSavedRef.current) return;

        try {
            const response = await fetch(`/api/projects/${currentProjectId}/scenes`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    data: sceneData,
                    expectedVersion: versionRef.current ?? undefined,
                }),
            });

            if (response.ok) {
                const updatedScene = (await response.json()) as { version?: number };
                if (typeof updatedScene.version === "number") {
                    versionRef.current = updatedScene.version;
                    setCurrentSceneVersion(updatedScene.version);
                }
                lastSavedRef.current = sceneDataJson;
                return;
            }

            if (response.status === 409) {
                const conflict = (await response.json()) as {
                    currentVersion?: number;
                };

                if (typeof conflict.currentVersion === "number") {
                    versionRef.current = conflict.currentVersion;
                    setCurrentSceneVersion(conflict.currentVersion);
                }

                const retry = await fetch(`/api/projects/${currentProjectId}/scenes`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        data: sceneData,
                        expectedVersion: versionRef.current ?? undefined,
                    }),
                });

                if (retry.ok) {
                    const retriedScene = (await retry.json()) as { version?: number };
                    if (typeof retriedScene.version === "number") {
                        versionRef.current = retriedScene.version;
                        setCurrentSceneVersion(retriedScene.version);
                    }
                    lastSavedRef.current = sceneDataJson;
                }
            }
        } catch (error) {
            console.error("Failed to auto-save scene:", error);
        }
    }, [setCurrentSceneVersion]);

    useEffect(() => {
        if (!projectId) return;
        if (!projectId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
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
        if (!projectId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
            // Don't auto-save for temporary/local projects (non-UUID IDs)
            return;
        }

        // Debounce the save operation
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }

        saveTimeoutRef.current = setTimeout(() => {
            saveScene(projectId);
        }, 1000); // Save 1 second after last change

        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
                // Save immediately on unmount
                saveScene(projectId);
            }
        };
    }, [workbenchNodes, connections, projectId, saveScene]);
}
