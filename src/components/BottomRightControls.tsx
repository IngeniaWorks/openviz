import {
    Maximize2,
    ZoomIn,
    ZoomOut,
    Maximize
} from 'lucide-react';
import { useStore } from '../store/useStore';

const BottomRightControls: React.FC = () => {
    const { project, setZoom } = useStore();
    const zoomPercent = Math.round(project.canvas.zoomLevel * 100);

    const handleZoomIn = () => setZoom(Math.min(5, project.canvas.zoomLevel + 0.1));
    const handleZoomOut = () => setZoom(Math.max(0.1, project.canvas.zoomLevel - 0.1));
    const handleResetZoom = () => setZoom(1);
    const handleFitToScreen = () => {
        if ((window as any).fitToScreen) (window as any).fitToScreen();
    };
    const handleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    };

    return (
        <div className="flex items-center gap-1 bg-panel border border-panel-border p-1.5 rounded-full shadow-2xl backdrop-blur-md bg-opacity-90 text-text-secondary">
            <button onClick={handleFullscreen} className="p-2 hover:text-white transition-colors" title="Toggle Fullscreen">
                <Maximize2 size={18} />
            </button>
            <button onClick={handleFitToScreen} className="p-2 hover:text-white transition-colors" title="Fit to Screen">
                <Maximize size={18} />
            </button>

            <div className="w-px h-4 bg-panel-border mx-1" />

            <button onClick={handleZoomOut} className="p-2 hover:text-white transition-colors" title="Zoom Out">
                <ZoomOut size={18} />
            </button>

            <button
                onClick={handleResetZoom}
                className="px-2 font-mono text-xs font-bold hover:text-white transition-colors min-w-[50px] text-center"
                title="Reset Zoom"
            >
                {zoomPercent}%
            </button>

            <button onClick={handleZoomIn} className="p-2 hover:text-white transition-colors" title="Zoom In">
                <ZoomIn size={18} />
            </button>

            <div className="w-px h-4 bg-panel-border mx-1" />

            <button className="p-2 hover:text-white transition-colors" title="Help">
                <HelpCircleIcon size={18} />
            </button>
        </div>
    );
};

const HelpCircleIcon = ({ size = 20 }: { size?: number }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <path d="M12 17h.01" />
    </svg>
);

export default BottomRightControls;
