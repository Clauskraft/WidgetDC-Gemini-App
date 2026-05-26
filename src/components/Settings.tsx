import React, { useState } from 'react';

export function Settings() {
  const [mcpKey, setMcpKey] = useState('16IhluefvQdtIasp2f6YLhT2IBpBG3Gp');
  const [model, setModel] = useState('models/gemini-3.1-pro-preview');

  return (
    <div className="flex-1 p-8 overflow-y-auto w-full max-w-[800px] mx-auto android-scroll">
      <h2 className="text-3xl font-medium text-[#E3E3E8] tracking-tight mb-2">Settings</h2>
      <p className="text-[#A1A1A8] mb-8 font-light">Configure WidgeTDC Platform integrations and agentic behaviors.</p>
      
      <div className="bg-[#1E1F22] rounded-2xl border border-[#2A2B32] p-6 shadow-sm mb-6">
        <h3 className="text-lg font-medium text-[#E3E3E8] mb-4">Platform Authentication</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#A1A1A8] mb-1.5">MCP Agent API Key</label>
            <input 
              type="password" 
              value={mcpKey}
              onChange={(e) => setMcpKey(e.target.value)}
              className="w-full bg-[#131314] border border-[#2A2B32] rounded-xl px-4 py-2.5 text-[#E3E3E8] focus:border-[#6366f1] focus:ring-1 focus:ring-[#6366f1] outline-none transition-all placeholder:text-[#3B3C44]"
              placeholder="Enter your Bearer token..."
            />
            <p className="text-xs text-[#A1A1A8] mt-2">
              Used for orchestrator and backend connectivity (`https://backend-production-d3da.up.railway.app`).
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
              className="w-full bg-[#131314] border border-[#2A2B32] rounded-xl px-4 py-3 text-[#E3E3E8] focus:border-[#6366f1] outline-none transition-all appearance-none"
            >
              <option value="models/gemini-3.1-pro-preview">Omega Sentinel (Active Route - May 2026)</option>
              <option value="models/gemini-2.5-pro">Deep Research Module</option>
              <option value="models/gemini-1.5-pro">Legacy WidgeTDC Node</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 mt-8">
        <button className="px-5 py-2.5 rounded-xl font-medium text-[#E3E3E8] hover:bg-[#2A2B32] transition-colors border border-transparent">
          Cancel
        </button>
        <button className="px-5 py-2.5 rounded-xl font-medium bg-[#E3E3E8] text-[#131314] hover:bg-white transition-colors shadow-sm">
          Save Preferences
        </button>
      </div>
    </div>
  );
}
