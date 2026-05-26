import React, { useState, useEffect, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Play, Activity, Terminal } from 'lucide-react';

const initialData = [
  { id: 1, name: 'Gemini 3.1 Pro Base', progress: 80, status: 'Active Focus' },
  { id: 2, name: 'NotebookLM Connector', progress: 40, status: 'Integrating' },
  { id: 3, name: 'Live API Audio/Video', progress: 0, status: 'Skipped' },
  { id: 4, name: 'Agentic Tool Run (MCP)', progress: 90, status: 'Testing' },
  { id: 5, name: 'Widget-Native Canvas UI', progress: 60, status: 'Active Focus' },
  { id: 6, name: 'Deep Research Agent', progress: 30, status: 'Pending' },
  { id: 7, name: 'GraphRAG (Neo4j)', progress: 50, status: 'Testing' },
  { id: 8, name: 'Omega Sentinel Routing', progress: 20, status: 'Planned' },
  { id: 9, name: 'Cross-Device Sync', progress: 75, status: 'Integrating' },
  { id: 10, name: 'Telemetry & Adoption', progress: 85, status: 'Validating' }
];

const agenticPatterns = [
  { step: 1, pattern: 'Zero-shot Tool Selection', desc: 'Identify required WidgeTDC endpoints' },
  { step: 2, pattern: 'Self-Correction Loop', desc: 'Refine NotebookLM data grounding' },
  { step: 4, pattern: 'ReAct (Reason + Act)', desc: 'Execute MCP tools & verify state' },
  { step: 5, pattern: 'Canvas UI Codegen', desc: 'Generate widget interaction points' },
  { step: 6, pattern: 'Recursive Research', desc: 'Expand knowledge via Deep Research' },
  { step: 7, pattern: 'Graph Traversal', desc: 'Extract entity relations in Neo4j' },
  { step: 8, pattern: 'Multi-Agent Debate', desc: 'Omega Sentinel arbitration logic' },
  { step: 9, pattern: 'State Hydration', desc: 'Sync threads across boundaries' },
  { step: 10, pattern: 'Feedback Loop Log', desc: 'Record telemetry for adoption' }
];

export function Dashboard() {
  const data = [
    { name: 'Gemini 3.1 Pro Base', progress: 100, status: 'Completed' },
    { name: 'NotebookLM Connector', progress: 100, status: 'Completed' },
    { name: 'Live API Audio/Video', progress: 0, status: 'Skipped' },
    { name: 'Agentic Tool Run (MCP)', progress: 100, status: 'Completed' },
    { name: 'Widget-Native Canvas UI', progress: 100, status: 'Completed' },
    { name: 'Deep Research Agent', progress: 100, status: 'Completed' },
    { name: 'GraphRAG (Neo4j)', progress: 100, status: 'Completed' },
    { name: 'Omega Sentinel Routing', progress: 100, status: 'Completed' },
    { name: 'Cross-Device Sync', progress: 100, status: 'Completed' },
    { name: 'Telemetry & Adoption', progress: 100, status: 'Completed' }
  ];

  return (
    <div className="flex-1 p-8 overflow-y-auto w-full max-w-[1000px] mx-auto android-scroll">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-3xl font-medium text-[#E3E3E8] tracking-tight mb-2">Gemini 3.1 (May 2026) Plan</h2>
          <p className="text-[#A1A1A8] font-light">10-Point Integration Plan for WidgeTDC & NotebookLM</p>
        </div>
      </div>
      
      <div className="bg-[#1E1F22] rounded-2xl border border-[#2A2B32] p-6 shadow-sm">
        <h3 className="text-lg font-medium text-[#E3E3E8] mb-6">Capabilities Progress</h3>
        <div className="h-[400px] w-full mt-auto">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 0, right: 30, left: 40, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#2A2B32" horizontal={true} vertical={false} />
              <XAxis type="number" domain={[0, 100]} stroke="#A1A1A8" tick={{ fill: '#A1A1A8', fontSize: 12 }} />
              <YAxis 
                type="category" 
                dataKey="name" 
                stroke="#A1A1A8" 
                tick={{ fill: '#E3E3E8', fontSize: 13 }} 
                width={150} 
              />
              <Tooltip 
                cursor={{ fill: '#2A2B32' }}
                contentStyle={{ backgroundColor: '#131314', border: '1px solid #2A2B32', borderRadius: '12px', color: '#E3E3E8' }}
                itemStyle={{ color: '#7dd3fc' }}
                formatter={(value: any, name: string, props: any) => {
                  return [`${value}%`, `Progress (${props.payload?.status || ''})`];
                }}
              />
              <Bar dataKey="progress" radius={[0, 4, 4, 0]} barSize={20}>
                {data.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={
                      entry.progress === 100 ? '#4ade80' : 
                      entry.progress >= 60 ? '#6366f1' : 
                      entry.progress >= 40 ? '#7dd3fc' : 
                      entry.name === 'Live API Audio/Video' ? '#ef4444' :
                      '#c084fc'
                    } 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
