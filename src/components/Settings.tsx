import React, { useState, useEffect } from 'react';

export function Settings() {
  const [model, setModel] = useState('routes/omega-sentinel');
  const [theme, setTheme] = useState('dark');
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    const savedModel = localStorage.getItem('widgetdc_model');
    if (savedModel) setModel(savedModel);
    const savedTheme = localStorage.getItem('widgetdc_theme');
    if (savedTheme) setTheme(savedTheme);
  }, []);

  const handleSave = () => {
    localStorage.setItem('widgetdc_model', model);
    localStorage.setItem('widgetdc_theme', theme);
    window.dispatchEvent(new Event('theme-changed'));
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="flex-1 p-8 overflow-y-auto w-full max-w-[800px] mx-auto android-scroll">
      <h2 className="text-3xl font-medium text-[#E3E3E8] tracking-tight mb-2">Settings</h2>
      <p className="text-[#A1A1A8] mb-8 font-light">Configure WidgeTDC Platform integrations and agentic behaviors. <span className="text-blue-400 font-medium">Local/Demo Mode</span></p>
      
      <div className="bg-[#1E1F22] rounded-2xl border border-[#2A2B32] p-6 shadow-sm mb-6">
        <h3 className="text-lg font-medium text-[#E3E3E8] mb-4">Platform Authentication</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#A1A1A8] mb-1.5">MCP Agent API Key</label>
            <input 
              type="password" 
              readOnly
              value="********************************"
              className="w-full bg-[#131416] border border-[#2A2B32] rounded-xl px-4 py-2.5 text-[#5B5D66] outline-none cursor-not-allowed"
              placeholder="API Key managed on server..."
            />
            <p className="text-xs text-[#A1A1A8] mt-2">
              Keys are managed centrally via the server environment to ensure security.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-[#1E1F22] rounded-2xl border border-[#2A2B32] p-6 shadow-sm mb-6">
        <h3 className="text-lg font-medium text-[#E3E3E8] mb-4">Core Routing Configuration</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#A1A1A8] mb-1.5">Primary Reasoning Engine</label>
            <select 
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full bg-[#131416] border border-[#2A2B32] rounded-xl px-4 py-3 text-[#E3E3E8] focus:border-[#6366f1] outline-none transition-all appearance-none cursor-pointer"
            >
              <option value="routes/omega-sentinel">Omega Sentinel (Active Route)</option>
              <option value="routes/deep-research">Deep Research Module</option>
              <option value="routes/flash-fast-path">Flash Fast Path</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-[#1E1F22] rounded-2xl border border-[#2A2B32] p-6 shadow-sm mb-6">
        <h3 className="text-lg font-medium text-[#E3E3E8] mb-4">Visual Theme Configuration</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#A1A1A8] mb-1.5">Dashboard & Mermaid Diagram theme</label>
            <select 
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              className="w-full bg-[#131416] border border-[#2A2B32] rounded-xl px-4 py-3 text-[#E3E3E8] focus:border-[#6366f1] outline-none transition-all appearance-none cursor-pointer"
            >
              <option value="dark">Dark Theme (Default Indigo/Slate)</option>
              <option value="default font-sans">Default Light Theme (Warm Crisp Paper)</option>
              <option value="forest">Forest Theme (Nature Green Accents)</option>
              <option value="neutral">Neutral Theme (Cool Terminal Chic)</option>
            </select>
            <p className="text-xs text-[#A1A1A8] mt-2">
              Select your preferred rendering canvas style. Changing this updates visual artifacts such as architectural graph nodes in real time.
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 mt-8 items-center">
        {isSaved && <span className="text-sm text-green-400 mr-2">Preferences saved to browser storage!</span>}
        <button className="px-5 py-2.5 rounded-xl font-medium text-[#E3E3E8] hover:bg-[#2A2B32] transition-colors border border-transparent">
          Cancel
        </button>
        <button onClick={handleSave} className="px-5 py-2.5 rounded-xl font-medium bg-[#E3E3E8] text-[#131416] hover:bg-white transition-colors shadow-sm">
          Save Preferences
        </button>
      </div>
    </div>
  );
}
