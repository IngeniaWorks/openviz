import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Project, ToolSettings, Layer, ToolType, AspectRatio, RenderSettings, RenderGroup } from '../types';

interface AppState {
    project: Project;
    toolSettings: ToolSettings;
    renderSettings: RenderSettings;
    renderResults: RenderGroup[];
    previewingRender: string | null;
    isRendering: boolean;
    resultsPanelOpen: boolean;
    activeLayerId: string | null;

    history: Project[];
    historyIndex: number;

    // Actions
    setName: (name: string) => void;
    setCanvasSize: (width: number, height: number, ratio: AspectRatio) => void;
    setZoom: (zoom: number) => void;
    setPan: (x: number, y: number) => void;

    // Tool Actions
    setActiveTool: (tool: ToolType) => void;
    setBrushSize: (size: number) => void;
    setBrushColor: (color: string) => void;
    setBrushOpacity: (opacity: number) => void;
    setBrushStabilizer: (stabilizer: number) => void;
    setBrushHardness: (hardness: number) => void;
    setEraserSize: (size: number) => void;

    // Render Actions
    setRenderPrompt: (prompt: string) => void;
    setRenderStyle: (style: string) => void;
    setRenderInfluence: (influence: number) => void;
    setRenderNumImages: (count: number) => void;
    setRenderReferenceImage: (image: string | undefined) => void;


    // Layer Actions
    addLayer: (type?: 'sketch' | 'image' | 'render') => void;
    removeLayer: (id: string) => void;
    setActiveLayer: (id: string) => void;
    updateLayer: (id: string, updates: Partial<Layer>) => void;
    reorderLayers: (startIndex: number, endIndex: number) => void;

    // Render Results Actions
    addRenderResultGroup: (prompt: string, style: string, images: string[]) => void;
    clearRenderResults: () => void;
    setPreviewingRender: (image: string | null) => void;
    setRendering: (loading: boolean) => void;
    setResultsPanelOpen: (open: boolean) => void;
    addResultAsLayer: (image: string) => void;

    // History Actions

    undo: () => void;
    redo: () => void;
    pushHistory: () => void;
}

const INITIAL_PROJECT: Project = {
    id: 'default',
    name: 'Untitled Project',
    createdAt: Date.now(),
    lastModifiedAt: Date.now(),
    canvas: {
        width: 1024,
        height: 768,
        aspectRatio: 'landscape',
        zoomLevel: 1,
        panX: 0,
        panY: 0,
        backgroundColor: '#ffffff',
    },
    layers: [
        {
            id: 'bg-layer',
            name: 'Background',
            type: 'sketch',
            visible: true,
            locked: false,
            opacity: 100,
            blendMode: 'normal',
            strokes: [],
            order: 0,
            created: Date.now(),
            modified: Date.now(),
        },
        {
            id: 'layer-1',
            name: 'Layer 1',
            type: 'sketch',
            visible: true,
            locked: false,
            opacity: 100,
            blendMode: 'normal',
            strokes: [],
            order: 1,
            created: Date.now(),
            modified: Date.now(),
        }
    ],
};

export const useStore = create<AppState>()(
    persist(
        (set, get) => ({
            project: INITIAL_PROJECT,
            toolSettings: {
                activeTool: 'brush',
                brushSize: 5,
                brushColor: '#000000',
                brushOpacity: 100,
                brushStabilizer: 20,
                brushHardness: 80,
                eraserSize: 20,
                shapeFill: 'transparent',
                shapeStroke: '#000000',
                strokeWidth: 2,
            },
            renderSettings: {
                prompt: '',
                stylePreset: 'Photorealistic',
                drawingInfluence: 1.0,
                numImages: 1,
            },
            renderResults: [],
            previewingRender: null,
            isRendering: false,
            resultsPanelOpen: false,
            activeLayerId: 'layer-1',


            history: [INITIAL_PROJECT],
            historyIndex: 0,

            setName: (name) => set((state) => ({
                project: { ...state.project, name, lastModifiedAt: Date.now() }
            })),

            setCanvasSize: (width, height, ratio) => set((state) => ({
                project: {
                    ...state.project,
                    canvas: { ...state.project.canvas, width, height, aspectRatio: ratio },
                    lastModifiedAt: Date.now()
                }
            })),

            setZoom: (zoomLevel) => set((state) => ({
                project: {
                    ...state.project,
                    canvas: { ...state.project.canvas, zoomLevel }
                }
            })),

            setPan: (panX, panY) => set((state) => ({
                project: {
                    ...state.project,
                    canvas: { ...state.project.canvas, panX, panY }
                }
            })),

            setActiveTool: (activeTool) => set((state) => ({
                toolSettings: { ...state.toolSettings, activeTool }
            })),

            setBrushSize: (brushSize) => set((state) => ({
                toolSettings: { ...state.toolSettings, brushSize }
            })),

            setBrushColor: (brushColor) => set((state) => ({
                toolSettings: { ...state.toolSettings, brushColor }
            })),

            setBrushOpacity: (brushOpacity) => set((state) => ({
                toolSettings: { ...state.toolSettings, brushOpacity }
            })),

            setBrushStabilizer: (brushStabilizer) => set((state) => ({
                toolSettings: { ...state.toolSettings, brushStabilizer }
            })),

            setBrushHardness: (brushHardness) => set((state) => ({
                toolSettings: { ...state.toolSettings, brushHardness }
            })),

            setEraserSize: (eraserSize) => set((state) => ({
                toolSettings: { ...state.toolSettings, eraserSize }
            })),

            setRenderPrompt: (prompt) => set((state) => ({
                renderSettings: { ...state.renderSettings, prompt }
            })),

            setRenderStyle: (stylePreset) => set((state) => ({
                renderSettings: { ...state.renderSettings, stylePreset }
            })),

            setRenderInfluence: (drawingInfluence) => set((state) => ({
                renderSettings: { ...state.renderSettings, drawingInfluence }
            })),

            setRenderNumImages: (numImages) => set((state) => ({
                renderSettings: { ...state.renderSettings, numImages }
            })),

            setRenderReferenceImage: (referenceImage) => set((state) => ({
                renderSettings: { ...state.renderSettings, referenceImage }
            })),

            addRenderResultGroup: (prompt, style, images) => set((state) => ({
                renderResults: [
                    {
                        id: Math.random().toString(36).substr(2, 9),
                        prompt,
                        style,
                        images,
                        timestamp: Date.now()
                    },
                    ...state.renderResults
                ],
                resultsPanelOpen: true
            })),

            clearRenderResults: () => set({ renderResults: [] }),

            setPreviewingRender: (previewingRender) => set({ previewingRender }),

            setRendering: (isRendering) => set({ isRendering }),

            setResultsPanelOpen: (resultsPanelOpen) => set({ resultsPanelOpen }),

            addResultAsLayer: (image) => set((state) => {
                const newLayerStyle = state.renderSettings.stylePreset;
                const newLayer: Layer = {
                    id: Math.random().toString(36).substr(2, 9),
                    name: `Render: ${newLayerStyle}`,
                    type: 'render',
                    visible: true,
                    locked: false,
                    opacity: 100,
                    blendMode: 'normal',
                    strokes: [],
                    image,
                    order: state.project.layers.length,
                    created: Date.now(),
                    modified: Date.now(),
                };
                return {
                    project: {
                        ...state.project,
                        layers: [...state.project.layers, newLayer],
                        lastModifiedAt: Date.now()
                    },
                    activeLayerId: newLayer.id,
                    previewingRender: null // Clear preview after adding
                };
            }),


            addLayer: (type = 'sketch') => set((state) => {
                const newLayer: Layer = {
                    id: Math.random().toString(36).substr(2, 9),
                    name: `Layer ${state.project.layers.length}`,
                    type,
                    visible: true,
                    locked: false,
                    opacity: 100,
                    blendMode: 'normal',
                    strokes: [],
                    order: state.project.layers.length,
                    created: Date.now(),
                    modified: Date.now(),
                };
                return {
                    project: {
                        ...state.project,
                        layers: [...state.project.layers, newLayer],
                        lastModifiedAt: Date.now()
                    },
                    activeLayerId: newLayer.id
                };
            }),

            removeLayer: (id) => set((state) => {
                if (state.project.layers.length <= 1) return state;
                const newLayers = state.project.layers.filter(l => l.id !== id);
                return {
                    project: {
                        ...state.project,
                        layers: newLayers,
                        lastModifiedAt: Date.now()
                    },
                    activeLayerId: state.activeLayerId === id ? newLayers[newLayers.length - 1].id : state.activeLayerId
                };
            }),

            setActiveLayer: (activeLayerId) => set({ activeLayerId }),

            updateLayer: (id, updates) => set((state) => ({
                project: {
                    ...state.project,
                    layers: state.project.layers.map(l => l.id === id ? { ...l, ...updates, modified: Date.now() } : l),
                    lastModifiedAt: Date.now()
                }
            })),

            reorderLayers: (startIndex, endIndex) => set((state) => {
                const newLayers = Array.from(state.project.layers);
                const [removed] = newLayers.splice(startIndex, 1);
                newLayers.splice(endIndex, 0, removed);
                return {
                    project: {
                        ...state.project,
                        layers: newLayers.map((l, i) => ({ ...l, order: i })),
                        lastModifiedAt: Date.now()
                    }
                };
            }),

            undo: () => {
                const { historyIndex, history } = get();
                if (historyIndex > 0) {
                    set({
                        project: history[historyIndex - 1],
                        historyIndex: historyIndex - 1
                    });
                }
            },

            redo: () => {
                const { historyIndex, history } = get();
                if (historyIndex < history.length - 1) {
                    set({
                        project: history[historyIndex + 1],
                        historyIndex: historyIndex + 1
                    });
                }
            },

            pushHistory: () => {
                const { project, history, historyIndex } = get();
                const snapshot = JSON.parse(JSON.stringify(project));
                const newHistory = history.slice(0, historyIndex + 1);
                newHistory.push(snapshot);
                if (newHistory.length > 50) newHistory.shift();
                set({
                    history: newHistory,
                    historyIndex: newHistory.length - 1
                });
            }
        }),
        {
            name: 'openviz-storage',
            partialize: (state) => ({
                project: state.project,
                activeLayerId: state.activeLayerId,
                renderResults: state.renderResults,
                resultsPanelOpen: state.resultsPanelOpen,
                renderSettings: state.renderSettings
            }),
        }
    )
);
