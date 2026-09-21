import React, { useEffect, useState } from 'react';
import { NodeResizer } from '@xyflow/react';

import { MediaWorkbenchNode } from '@/types';

interface MediaNodeData extends MediaWorkbenchNode {
    onResize?: (nodeId: string, width: number, height: number, x?: number, y?: number) => void;
}

interface MediaNodeProps {
    id: string;
    data: MediaNodeData;
    selected: boolean;
    width?: number;
    height?: number;
}

export const MediaNode: React.FC<MediaNodeProps> = ({ id, data, selected, width, height }) => {
    const [nodeSize, setNodeSize] = useState({ width: width || 260, height: height || 180 });
    const src = data.data?.src;
    const alt = data.data?.alt ?? 'Uploaded media';

    useEffect(() => {
        if (width && height && width > 0 && height > 0) {
            setNodeSize({ width, height });
        }
    }, [width, height]);

    return (
        <div style={{ width: nodeSize.width, height: nodeSize.height }} className={`relative overflow-hidden rounded-lg border bg-white shadow-md ${selected ? 'border-blue-400' : 'border-slate-200'}`}>
            {src ? (
                <img src={src} alt={alt} className="h-full w-full object-cover" draggable={false} />
            ) : (
                <div className="flex h-full w-full items-center justify-center text-sm text-slate-500">
                    Media unavailable
                </div>
            )}

            <NodeResizer
                isVisible={selected}
                minWidth={120}
                minHeight={80}
                color="#ffffff"
                handleStyle={{
                    width: 12,
                    height: 12,
                    backgroundColor: '#ffffff',
                    borderColor: '#6366f1',
                    borderWidth: '2px',
                    borderRadius: 3,
                }}
                onResize={(_event, resizeParams) => {
                    const newWidth = Number.isFinite(resizeParams.width) ? resizeParams.width : nodeSize.width;
                    const newHeight = Number.isFinite(resizeParams.height) ? resizeParams.height : nodeSize.height;
                    const newX = Number.isFinite(resizeParams.x) ? resizeParams.x : undefined;
                    const newY = Number.isFinite(resizeParams.y) ? resizeParams.y : undefined;

                    if (newWidth > 0 && newHeight > 0) {
                        setNodeSize({ width: newWidth, height: newHeight });
                        data.onResize?.(id, newWidth, newHeight, newX, newY);
                    }
                }}
                onResizeEnd={(_event, resizeParams) => {
                    const newWidth = Number.isFinite(resizeParams.width) ? resizeParams.width : nodeSize.width;
                    const newHeight = Number.isFinite(resizeParams.height) ? resizeParams.height : nodeSize.height;
                    const newX = Number.isFinite(resizeParams.x) ? resizeParams.x : undefined;
                    const newY = Number.isFinite(resizeParams.y) ? resizeParams.y : undefined;

                    if (newWidth > 0 && newHeight > 0) {
                        setNodeSize({ width: newWidth, height: newHeight });
                        data.onResize?.(id, newWidth, newHeight, newX, newY);
                    }
                }}
            />
        </div>
    );
};
