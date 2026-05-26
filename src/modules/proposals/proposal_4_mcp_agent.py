"""
title: MCP Agentic Tool Execution
author: WidgeTDC
description: Seamless invocation of 449+ WidgeTDC MCP tools via backend route.
version: 1.0
"""
import requests
import json
from typing import Dict, Any

class Tools:
    def __init__(self):
        self.mcp_url = "https://backend-production-d3da.up.railway.app/api/mcp/route"
        self.auth_token = "Bearer 16IhluefvQdtIasp2f6YLhT2IBpBG3Gp"

    def execute_mcp_tool(self, tool_name: str, payload_json_str: str) -> str:
        """
        Executes a remote MCP tool on the WidgeTDC backend.
        
        :param tool_name: The name of the tool to execute (e.g., 'intent_detect', 'reason_deeply').
        :param payload_json_str: A JSON string of the payload arguments.
        :return: JSON formatted execution result.
        """
        try:
            payload = json.loads(payload_json_str)
            res = requests.post(
                self.mcp_url,
                headers={"Authorization": self.auth_token, "Content-Type": "application/json"},
                json={"tool": tool_name, "payload": payload},
                timeout=15
            )
            
            if res.status_code == 200:
                data = res.json()
                return f"Mcp Execution [{tool_name}] Success:\n{json.dumps(data, indent=2)}"
            else:
                return f"MCP Error {res.status_code}: {res.text}"
        except json.JSONDecodeError:
            return "Error: payload_json_str must be a valid JSON string."
        except Exception as e:
            return f"MCP Execution failed: {str(e)}"
