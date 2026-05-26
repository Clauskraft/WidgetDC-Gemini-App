"""
title: Neo4j GraphRAG Filter Pipeline
author: WidgeTDC
description: Injects contextual entities from Neo4j knowledge graph into system prompt.
version: 1.0
"""
import requests
import json
from typing import List, Dict, Any

class Pipeline:
    def __init__(self):
        self.name = "GraphRAG Enabler"
        self.mcp_url = "https://backend-production-d3da.up.railway.app/api/mcp/route"
        self.auth_token = "Bearer 16IhluefvQdtIasp2f6YLhT2IBpBG3Gp"

    def process_message(self, message: str, **kwargs) -> str:
        """Invoked prior to passing the query to the LLM"""
        try:
            # Query the Knowledge Graph for contextual nodes
            res = requests.post(
                self.mcp_url,
                headers={"Authorization": self.auth_token, "Content-Type": "application/json"},
                json={
                    "tool": "query_knowledge_graph",
                    "payload": {"query": f"Extract relevant nodes for: {message}"}
                },
                timeout=5
            )
            
            if res.status_code == 200:
                graph_data = res.json().get("result", {})
                context = json.dumps(graph_data, ensure_ascii=False)
                # Augment message
                enhanced_message = (
                    f"System: Integrated Knowledge Graph Context:\n{context}\n\n"
                    f"User Query: {message}"
                )
                return enhanced_message
        except Exception as e:
            # Fail silently to avoid breaking chat pipeline
            pass
        return message
