import React from 'react';
import { CheckCircle2, Cpu, Database, ExternalLink, Server, Settings2, Wifi, XCircle } from 'lucide-react';
import { useAIComputeSettings } from './hooks/useAIComputeSettings';

export const AIComputeSettings: React.FC = () => {
    const {
        endpoint,
        setEndpoint,
        status,
        preference,
        setPreference,
        capabilities,
        refreshCapabilities,
        testConnection,
    } = useAIComputeSettings();

    return (
        <div className="max-w-3xl space-y-8 text-zinc-300">
            <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-violet-400">OpenViz AI</p>
                <h2 className="text-3xl font-semibold tracking-tight text-white">AI &amp; Compute</h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-500">
                    Connect ComfyUI, inspect available hardware, and choose how OpenViz selects product-design models.
                </p>
            </div>

            <section className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5 shadow-2xl shadow-black/20" aria-labelledby="connection-title">
                <div className="mb-5 flex items-start justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 text-white">
                            <Server size={17} className="text-violet-400" />
                            <h3 id="connection-title" className="font-medium">ComfyUI connection</h3>
                        </div>
                        <p className="mt-1 text-xs text-zinc-500">OpenViz uses a proxied ComfyUI API connection for local and hosted targets.</p>
                    </div>
                    <span className="flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-[10px] font-medium text-zinc-400">
                        <Wifi size={11} /> {status === 'connected' ? 'Connected' : status === 'checking' ? 'Checking' : 'Not tested'}
                    </span>
                </div>
                <div className="flex items-end gap-3">
                    <div className="flex-1">
                        <label htmlFor="comfy-endpoint" className="mb-2 block text-xs font-medium text-zinc-400">Endpoint</label>
                        <input
                            id="comfy-endpoint"
                            aria-label="ComfyUI endpoint"
                            value={endpoint}
                            onChange={(event) => setEndpoint(event.target.value)}
                            className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none transition focus:border-violet-500"
                        />
                    </div>
                    <button
                        type="button"
                        onClick={testConnection}
                        disabled={status === 'checking'}
                        className="rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-400 disabled:cursor-wait disabled:opacity-60"
                    >
                        {status === 'checking' ? 'Testing…' : 'Test connection'}
                    </button>
                </div>
                <div className="mt-3 min-h-5 text-xs" role="status" aria-live="polite">
                    {status === 'connected' && <span className="flex items-center gap-1.5 text-emerald-400"><CheckCircle2 size={14} /> Connected</span>}
                    {status === 'unavailable' && <span className="flex items-center gap-1.5 text-rose-400"><XCircle size={14} /> Connection unavailable</span>}
                </div>
            </section>

            <section className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5 shadow-2xl shadow-black/20" aria-labelledby="hardware-title">
                <div className="mb-5 flex items-start justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 text-white">
                            <Cpu size={17} className="text-violet-400" />
                            <h3 id="hardware-title" className="font-medium">Hardware detection</h3>
                        </div>
                        <p className="mt-1 text-xs text-zinc-500">Capabilities are detected through ComfyUI’s system statistics endpoint.</p>
                    </div>
                    <button type="button" onClick={() => void refreshCapabilities()} className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-900 hover:text-white" aria-label="Refresh hardware detection">
                        <Settings2 size={16} />
                    </button>
                </div>
                <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3"><p className="text-[10px] uppercase tracking-wider text-zinc-600">Device</p><p className="mt-2 truncate text-sm text-zinc-300">{capabilities?.devices[0]?.name ?? 'Not detected'}</p></div>
                    <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3"><p className="text-[10px] uppercase tracking-wider text-zinc-600">Free VRAM</p><p className="mt-2 text-sm text-zinc-300">{capabilities?.devices[0]?.vramFreeBytes ? `${Math.round(capabilities.devices[0].vramFreeBytes / 1024 ** 3)} GB` : '—'}</p></div>
                    <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3"><p className="text-[10px] uppercase tracking-wider text-zinc-600">Backend</p><p className="mt-2 text-sm capitalize text-zinc-300">{capabilities?.devices[0]?.type ?? 'Automatic'}</p></div>
                </div>
            </section>

            <section className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5 shadow-2xl shadow-black/20" aria-labelledby="model-title">
                <div className="mb-5 flex items-start justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 text-white">
                            <Database size={17} className="text-violet-400" />
                            <h3 id="model-title" className="font-medium">Models &amp; dependencies</h3>
                        </div>
                        <p className="mt-1 text-xs text-zinc-500">OpenViz checks model files and custom nodes before queueing a workflow.</p>
                    </div>
                    <a href="https://huggingface.co/Comfy-Org" target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300">
                        Model sources <ExternalLink size={12} />
                    </a>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                    {['Qwen Image 2.1', 'Qwen Image Edit 2511', 'FLUX Kontext-dev', 'Wan 2.2'].map((model) => (
                        <div key={model} className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/70 px-3 py-2.5">
                            <span className="text-sm text-zinc-300">{model}</span>
                            <span className="text-[10px] text-zinc-600">{capabilities ? (capabilities.availableModels.some((available) => available.toLowerCase().includes(model.toLowerCase().split(' ')[0])) ? 'Available' : 'Check dependencies') : 'Not checked'}</span>
                        </div>
                    ))}
                </div>
            </section>

            <section className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5 shadow-2xl shadow-black/20" aria-labelledby="preference-title">
                <div className="mb-4">
                    <h3 id="preference-title" className="font-medium text-white">Automatic model tier</h3>
                    <p className="mt-1 text-xs text-zinc-500">Automatic uses detected free VRAM and workflow requirements.</p>
                </div>
                <label htmlFor="compute-preference" className="mb-2 block text-xs font-medium text-zinc-400">Preferred profile</label>
                <select id="compute-preference" value={preference} onChange={(event) => setPreference(event.target.value as typeof preference)} className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-500">
                    <option value="automatic">Automatic</option>
                    <option value="low-memory">Low memory</option>
                    <option value="balanced">Balanced / FP8</option>
                    <option value="high-quality">High quality / BF16</option>
                    <option value="hosted">Hosted GPU</option>
                </select>
            </section>
        </div>
    );
};
