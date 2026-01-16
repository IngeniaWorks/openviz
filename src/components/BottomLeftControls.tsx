import React from 'react';
import { Clock } from 'lucide-react';
import { useStore } from '../store/useStore';

const BottomLeftControls: React.FC = () => {
    const { history } = useStore();

    return (
        <button className="w-12 h-12 flex items-center justify-center bg-panel border border-panel-border rounded-full shadow-2xl backdrop-blur-md bg-opacity-90 text-text-secondary hover:text-white transition-all group overflow-hidden relative">
            <Clock size={22} className="group-hover:rotate-12 transition-transform" />
            <div className="absolute top-1 right-2 w-4 h-4 bg-primary text-[8px] font-bold text-white rounded-full flex items-center justify-center border border-panel">
                {history.length}
            </div>
        </button>
    );
};

export default BottomLeftControls;
