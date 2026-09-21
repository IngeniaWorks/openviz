"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useStore } from "@/store/useStore";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { SceneData, WorkbenchNode, Connection } from "@/types";
import { useShallow } from "zustand/react/shallow";

const Workbench = dynamic(() => import("@/components/workbench/workbench").then(mod => mod.Workbench), { ssr: false });
const Studio = dynamic(() => import("@/components/Studio").then(mod => mod.Studio), { ssr: false });

type ProjectApiResponse = {
    scene: SceneData | null;
    sceneVersion?: number;
};

/**
 * Shared project workspace rendered by both /projects/[id]/studio and
 * /projects/[id]/workbench. The URL segment is the source of truth for the
 * active view; the zustand viewMode is kept in sync so components that read
 * it (e.g. useWorkbenchCenterOnReturn) keep working unchanged.
 */
export function ProjectWorkspace({ id, mode }: { id: string; mode: "STUDIO" | "WORKBENCH" }) {
    const [isHydrated, setIsHydrated] = useState(false);
    const {
        setNodes,
        setConnections,
        setCurrentProjectId,
        setCurrentSceneVersion,
        setSceneHydrated,
        clearCollaborationState,
        setViewMode,
    } = useStore(
        useShallow((state) => ({
            setNodes: state.setWorkbenchNodes,
            setConnections: state.setConnections,
            setCurrentProjectId: state.setCurrentProjectId,
            setCurrentSceneVersion: state.setCurrentSceneVersion,
            setSceneHydrated: state.setSceneHydrated,
            clearCollaborationState: state.clearCollaborationState,
            setViewMode: state.setViewMode,
        }))
    );

    const { data: projectData, isLoading, error } = useQuery<ProjectApiResponse>({
        queryKey: ["projects", id],
        queryFn: async () => {
            const res = await fetch(`/api/projects/${id}`);
            if (!res.ok) throw new Error("Project not found");
            return res.json();
        },
    });

    // Keep the store's viewMode aligned with the URL segment. Runs after child
    // effects on mount, so hooks that detect the STUDIO -> WORKBENCH transition
    // (e.g. center-on-return) still observe the switch.
    useEffect(() => {
        setViewMode(mode);
    }, [mode, setViewMode]);

    useEffect(() => {
        // Set the current project ID in the store
        setCurrentProjectId(id);

        return () => {
            // Clear the project ID when leaving the page
            // Note: We keep workbenchNodes so the dashboard can show previews
            setCurrentProjectId(null);
            setCurrentSceneVersion(0);
            setSceneHydrated(false);
            clearCollaborationState();
        };
    }, [id, setCurrentProjectId, setCurrentSceneVersion, setSceneHydrated, clearCollaborationState]);

    useEffect(() => {
        // Clear workbench nodes and connections first to avoid showing data from previous project
        setNodes([]);
        setConnections([]);

        if (projectData?.scene) {
            // Hydrate the store with the project's scene data
            const scene = projectData.scene;
            // Tag nodes with projectId so dashboard can filter them properly
            const nodesWithProjectId = scene.nodes?.map((node: WorkbenchNode) => ({
                ...node,
                projectId: id
            })) || [];
            if (nodesWithProjectId.length > 0) setNodes(nodesWithProjectId);
            if (scene.connections) setConnections(scene.connections as Connection[]);
            setCurrentSceneVersion(projectData.sceneVersion ?? 0);
            setIsHydrated(true);
        } else if (projectData) {
            // Older projects may predate the database-backed scene record. Restore
            // their locally cached Workbench nodes so the first autosave can migrate
            // them into the current main-scene persistence path instead of dropping
            // them during hydration.
            const cachedNodes = useStore.getState().projectNodes[id] ?? [];
            if (cachedNodes.length > 0) {
                setNodes(cachedNodes);
            }
            setCurrentSceneVersion(projectData.sceneVersion ?? 0);
            setIsHydrated(true);
        }

        if (projectData) {
            // Signals useAutoSaveScene that local state now reflects this fetch, so any
            // interrupted save restored from IndexedDB can be applied on top of it.
            setSceneHydrated(true);
        }
    }, [projectData, setNodes, setConnections, setCurrentSceneVersion, setSceneHydrated, id]);

    if (isLoading || !isHydrated) {
        return (
            <div className="h-screen w-screen bg-[#0F0F0F] flex items-center justify-center text-white">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="animate-spin text-indigo-500" size={48} />
                    <p className="text-sm font-medium text-zinc-400">Loading workspace...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="h-screen w-screen bg-[#0F0F0F] flex items-center justify-center text-white">
                <div className="text-center space-y-4">
                    <h1 className="text-2xl font-bold">Project not found</h1>
                    <p className="text-zinc-500">The project you&apos;re looking for doesn&apos;t exist or you don&apos;t have access.</p>
                    <button
                        onClick={() => window.location.href = '/dashboard'}
                        className="px-6 py-2 bg-indigo-600 rounded-lg text-sm font-medium"
                    >
                        Back to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    return <React.Fragment>{mode === "WORKBENCH" ? <Workbench /> : <Studio />}</React.Fragment>;
}
