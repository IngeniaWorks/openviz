"use client";

import React from "react";
import { useEffect, useState, use } from "react";
import dynamic from "next/dynamic";
import { useStore } from "@/store/useStore";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { SceneData, WorkbenchNode, Connection } from "@/types";
import { useShallow } from "zustand/react/shallow";

const Workbench = dynamic(() => import("@/components/workbench/workbench").then(mod => mod.Workbench), { ssr: false });
const Studio = dynamic(() => import("@/components/Studio").then(mod => mod.Studio), { ssr: false });

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [isHydrated, setIsHydrated] = useState(false);
    const {
        viewMode,
        setNodes,
        setConnections,
        setCurrentProjectId,
        setCurrentSceneVersion,
        clearCollaborationState,
    } = useStore(
        useShallow((state) => ({
            viewMode: state.viewMode,
            setNodes: state.setWorkbenchNodes,
            setConnections: state.setConnections,
            setCurrentProjectId: state.setCurrentProjectId,
            setCurrentSceneVersion: state.setCurrentSceneVersion,
            clearCollaborationState: state.clearCollaborationState,
        }))
    );

    type ProjectApiResponse = {
        scene: SceneData | null;
        sceneVersion?: number;
    };

    const { data: projectData, isLoading, error } = useQuery<ProjectApiResponse>({
        queryKey: ["projects", id],
        queryFn: async () => {
            const res = await fetch(`/api/projects/${id}`);
            if (!res.ok) throw new Error("Project not found");
            return res.json();
        },
    });

    useEffect(() => {
        // Set the current project ID in the store
        setCurrentProjectId(id);

        return () => {
            // Clear the project ID when leaving the page
            // Note: We keep workbenchNodes so the dashboard can show previews
            setCurrentProjectId(null);
            setCurrentSceneVersion(0);
            clearCollaborationState();
        };
    }, [id, setCurrentProjectId, setCurrentSceneVersion, clearCollaborationState]);

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
            // Project exists but has no scene data yet - start with empty workbench
            setCurrentSceneVersion(projectData.sceneVersion ?? 0);
            setIsHydrated(true);
        }
    }, [projectData, setNodes, setConnections, setCurrentSceneVersion, id]);

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

    return <React.Fragment>{viewMode === "WORKBENCH" ? <Workbench /> : <Studio />}</React.Fragment>;
}
