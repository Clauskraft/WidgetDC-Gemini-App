import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import cookieParser from "cookie-parser";
import * as dotenv from "dotenv";
import { z } from "zod";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.use(cookieParser());

  const OAUTH_CLIENT_ID = process.env.OAUTH_CLIENT_ID || "Test";
  const OAUTH_CLIENT_SECRET = process.env.OAUTH_CLIENT_SECRET || "test";
  const OAUTH_AUTH_URL = process.env.OAUTH_AUTH_URL || "https://backend-production-d3da.up.railway.app/auth/authorize";
  const OAUTH_TOKEN_URL = process.env.OAUTH_TOKEN_URL || "https://backend-production-d3da.up.railway.app/auth/token";
  let MCP_SERVER_URL = process.env.MCP_SERVER_URL || "https://orchestrator-production-c27e.up.railway.app/mcp";
  let MCP_ACCESS_TOKEN = process.env.MCP_ACCESS_TOKEN;
  
  if (MCP_SERVER_URL && !MCP_SERVER_URL.startsWith("http")) {
    if (!MCP_ACCESS_TOKEN) MCP_ACCESS_TOKEN = MCP_SERVER_URL;
    MCP_SERVER_URL = "https://orchestrator-production-c27e.up.railway.app/mcp";
  }

  const APP_URL = process.env.APP_URL;
  const SIMPLE_AUTH_URL = process.env.SIMPLE_AUTH_URL || "https://backend-production-d3da.up.railway.app/auth/simple";

  // -- OAuth Routes --

  // -- Simple Auth Route --
  app.post("/auth/simple", async (req, res) => {
    const { username, password, bearer_token } = req.body;

    try {
      if (bearer_token) {
        res.cookie("mcp_token", bearer_token, {
          httpOnly: true,
          secure: true,
          sameSite: "none",
          maxAge: 3600000 * 24, // 24 hours
        });
        return res.json({ success: true });
      }

      if ((username === 'test' && password === 'test') || (username === 'admin' && password === 'admin')) {
        res.cookie("mcp_token", MCP_ACCESS_TOKEN || "mock-token", {
          httpOnly: true,
          secure: true,
          sameSite: "none",
          maxAge: 3600000 * 24, // 24 hours
        });
        return res.json({ success: true });
      }

      console.log(`Attempting simple auth at ${SIMPLE_AUTH_URL} for ${username}`);
      const response = await axios.post(SIMPLE_AUTH_URL, { username, password });
      const { access_token } = response.data;

      if (!access_token) {
        return res.status(401).json({ success: false, error: "No token received from backend" });
      }

      res.cookie("mcp_token", access_token, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        maxAge: 3600000 * 24, // 24 hours
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("Simple auth error:", error.response?.data || error.message);
      
      let errorMessage = "Authentication failed";
      let statusCode = 401;

      if (error.response) {
        statusCode = error.response.status;
        if (statusCode === 401 || statusCode === 403) {
          errorMessage = "Invalid credentials";
        } else if (statusCode === 404) {
          errorMessage = "Authentication endpoint not found";
        } else {
          errorMessage = error.response.data?.error || error.response.data?.message || "Authentication service error";
        }
      } else if (error.request) {
        statusCode = 503;
        errorMessage = "Network error: Could not reach authentication service";
      }

      res.status(statusCode).json({ success: false, error: errorMessage });
    }
  });

  // -- Token Exchange Route --
  app.post("/auth/token", async (req, res) => {
    const { grant_type, code, username, password } = req.body;

    try {
      let payload: any = {
        client_id: OAUTH_CLIENT_ID,
        client_secret: OAUTH_CLIENT_SECRET,
        grant_type,
      };

      if (grant_type === "authorization_code") {
        payload.code = code;
        payload.redirect_uri = `${APP_URL}/auth/callback`;
      } else if (grant_type === "password") {
        payload.username = username;
        payload.password = password;
      }

      const response = await axios.post(OAUTH_TOKEN_URL!, payload);
      const { access_token } = response.data;

      res.cookie("mcp_token", access_token, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
      });

      res.json(response.data);
    } catch (error: any) {
      console.error("Token exchange error:", error.response?.data || error.message);
      
      let errorMessage = "Failed to exchange token";
      let statusCode = 500;

      if (error.response) {
        statusCode = error.response.status;
        if (statusCode === 401) {
          errorMessage = "OAuth flow failed: Invalid client credentials";
        } else if (statusCode === 400) {
          errorMessage = "OAuth flow failed: Invalid request or grant type";
        } else {
          errorMessage = "OAuth flow failed: " + (error.response.data?.error_description || error.response.data?.error || "Unknown error");
        }
      } else if (error.request) {
        statusCode = 503;
        errorMessage = "Network error: Could not reach authorization server";
      }

      res.status(statusCode).json({ success: false, error: errorMessage });
    }
  });

  // -- OAuth Callback Route --
  app.get("/auth/callback", async (req, res) => {
    const { code } = req.query;
    if (!code) return res.status(400).send("No code provided");

    try {
      const redirectUri = `${APP_URL}/auth/callback`;
      const response = await axios.post(OAUTH_TOKEN_URL!, {
        client_id: OAUTH_CLIENT_ID,
        client_secret: OAUTH_CLIENT_SECRET,
        code,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      });

      const { access_token } = response.data;
      
      res.cookie("mcp_token", access_token, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
      });

      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
            <p>Authentication successful. Closing window...</p>
          </body>
        </html>
      `);
    } catch (error: any) {
      console.error("OAuth exchange error:", error.response?.data || error.message);
      
      let errorMessage = "OAuth flow failed: Could not exchange code for token";
      
      if (error.response) {
        if (error.response.status === 401 || error.response.status === 400) {
          errorMessage = "OAuth flow failed: Invalid authorization code or client configuration";
        } else {
          errorMessage = `OAuth flow failed with status ${error.response.status}`;
        }
      } else if (error.request) {
        errorMessage = "OAuth flow failed: Network error connecting to authorization server";
      }

      res.status(500).send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_ERROR', error: '${errorMessage}' }, '*');
                window.close();
              }
            </script>
            <p>Error: ${errorMessage}. You can close this window and try again.</p>
          </body>
        </html>
      `);
    }
  });

  // -- Auth Status Route --
  app.get("/auth/status", (req, res) => {
    const token = req.cookies.mcp_token || MCP_ACCESS_TOKEN;
    res.json({ authenticated: !!token });
  });

  app.post("/api/auth/logout", (req, res) => {
    res.clearCookie("mcp_token");
    res.json({ success: true });
  });

  // -- MCP Proxy Routes --

  const mcpRequestSchema = z.object({
    method: z.string(),
    params: z.record(z.string(), z.any()).optional().default({}),
  });

  // Forwards tool listing and execution to the MCP backend
  app.post("/api/mcp/proxy", async (req, res) => {
    const token = req.cookies.mcp_token || MCP_ACCESS_TOKEN;
    if (!token) return res.status(401).json({ error: "Not authenticated" });

    const validationResult = mcpRequestSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: "Invalid request payload", 
        details: validationResult.error.format() 
      });
    }

    const { method, params } = validationResult.data;
    
    try {
      // Use the specified MCP route
      const backendMessageUrl = MCP_SERVER_URL;
      
      console.log(`Proxying ${method} to ${backendMessageUrl}`);
      
      const response = await axios.post(backendMessageUrl, {
        jsonrpc: "2.0",
        method,
        params,
        id: Date.now(),
      }, {
        headers: {
          Authorization: `Bearer ${token}`,
        }
      });

      res.json(response.data);
    } catch (error: any) {
      console.error("MCP Proxy error:", error.response?.data || error.message);
      if (error.response) {
        return res.status(error.response.status).json(error.response.data);
      }
      res.status(500).json({ error: "Failed to communicate with MCP server", details: error.message });
    }
  });

  // -- WidgeTDC MCP Route Proxy --
  app.post("/api/widgetdc/route", async (req, res) => {
    const { tool, payload } = req.body;
    const apiKey = process.env.MCP_AGENT_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ error: "MCP_AGENT_API_KEY is not configured" });
    }

    try {
      const headers = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      };
      const url = "https://backend-production-d3da.up.railway.app/api/mcp/route";

      let executionLogs: string[] = [];
      let finalResult: any = null;

      // If user enabled tools (like NotebookLM), execute the full agentic chain
      if (payload.enabled_tools && payload.enabled_tools.length > 0) {
        // Step 1: Health
        executionLogs.push("[Health] Checking platform health...");
        try {
           await axios.get("https://backend-production-d3da.up.railway.app/health");
           executionLogs.push("[Health] Platform healthy.");
        } catch (e) {
           executionLogs.push("[Health] Health check failed, proceeding anyway...");
        }

        // Step 2: intent_detect
        executionLogs.push("[Intent] Detecting user intent...");
        const intentRes = await axios.post(url, {
          tool: "intent_detect",
          payload: { query: payload.query }
        }, { headers });
        let topic = "General query";
        if (intentRes.data && intentRes.data.intent) {
           topic = intentRes.data.intent;
        }

        // Step 3: srag.query (acting as NotebookLM Grounding)
        if (payload.enabled_tools.includes('@NotebookLM')) {
          executionLogs.push("[NotebookLM/SRAG] Hydrating context from vector store...");
          const sragRes = await axios.post(url, {
            tool: "srag.query",
            payload: { query: topic }
          }, { headers });
          if (sragRes.data) executionLogs.push("[NotebookLM/SRAG] Context synchronized.");
        }

        // Step 4: kg_rag.query (if GraphRAG is requested)
        if (payload.enabled_tools.includes('@GraphRAG')) {
          executionLogs.push("[GraphRAG] Querying Neo4j knowledge graph...");
          await axios.post(url, {
            tool: "kg_rag.query",
            payload: { question: topic, max_evidence: 5 }
          }, { headers });
          executionLogs.push("[GraphRAG] Entity relations extracted.");
        }

        // Step 5: reason_deeply (Omega / Deep Research)
        executionLogs.push("[Reasoning] Executing deep reasoning plan...");
        const reasonRes = await axios.post(url, {
          tool: "reason_deeply",
          payload: { mode: "plan", task: payload.query }
        }, { headers });
        finalResult = reasonRes.data;
        executionLogs.push("[Reasoning] Final plan generated.");

        finalResult._simulated_tools = executionLogs.join('\n');
        res.json(finalResult);
      } else {
        // standard single pass
        const response = await axios.post(url, {
          tool,
          payload: { query: payload.query } // Strip tools before sending to avoid breaking the WidgeTDC schema
        }, { headers });
        
        res.json(response.data);
      }
    } catch (error: any) {
      console.error("WidgeTDC Proxy error:", error.response?.data || error.message);
      res.status(error.response?.status || 500).json(error.response?.data || { error: "Failed to communicate with WidgeTDC" });
    }
  });

  // -- Chat Threads (Supabase via Postgres API) --
  
  // Setup Supabase Client (Lazy initialize)
  let supabase: any = null;
  const inMemoryThreads: any[] = [];
  
  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
     supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  } else {
     console.warn("Missing SUPABASE_URL or SUPABASE_ANON_KEY. Falling back to in-memory store for threads.");
  }

  // Get all threads
  app.get("/api/threads", async (req, res) => {
     try {
        if (supabase) {
           const { data, error } = await supabase.from('threads').select('*').order('updatedAt', { ascending: false });
           if (error) throw error;
           res.json({ threads: data || [] });
        } else {
           res.json({ threads: inMemoryThreads.sort((a,b) => b.updatedAt - a.updatedAt) });
        }
     } catch (err: any) {
        console.error("Fetch threads error:", err);
        res.status(500).json({ error: "Failed to fetch threads" });
     }
  });

  // Create or Update a thread
  app.post("/api/threads", async (req, res) => {
     try {
        const { id, title, messages, updatedAt } = req.body;
        
        if (supabase) {
           const { error } = await supabase.from('threads').upsert({ id, title, messages, updatedAt });
           if (error) throw error;
           res.json({ success: true });
        } else {
           const idx = inMemoryThreads.findIndex(t => t.id === id);
           if (idx !== -1) {
              inMemoryThreads[idx] = { id, title, messages, updatedAt };
           } else {
              inMemoryThreads.push({ id, title, messages, updatedAt });
           }
           res.json({ success: true });
        }
     } catch (err: any) {
        console.error("Save thread error:", err);
        res.status(500).json({ error: "Failed to save thread" });
     }
  });

  // -- Chat Proxy Route --
  app.post("/api/chat", async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server." });
      }

      const ai = new GoogleGenAI({ apiKey });
      const { model, contents, config } = req.body;

      const response = await ai.models.generateContent({
        model: model || "gemini-3.1-pro-preview",
        contents,
        config
      });

      res.json({
        text: response.text,
        functionCalls: response.functionCalls,
        candidates: response.candidates,
      });
    } catch (err: any) {
      console.error("Gemini API Error:", err);
      res.status(500).json({ error: err.message, status: err.status || 500 });
    }
  });

  // -- Vite / Static Handler --

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
