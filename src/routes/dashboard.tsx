import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, Activity, Shield, MessageSquare, TrendingUp, Clock } from 'lucide-react'

export const Route = createFileRoute('/dashboard')({
  component: RouteComponent,
})

interface DashboardMetrics {
  activeAgents: number
  alertsToday: number
  threatsBlocked: number
  chatSessions: number
  avgResponseTime: number
  uptime: number
}

function RouteComponent() {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    activeAgents: 4,
    alertsToday: 12,
    threatsBlocked: 156,
    chatSessions: 23,
    avgResponseTime: 1.4,
    uptime: 99.9,
  })
  const [lastUpdate, setLastUpdate] = useState(new Date())

  // P0: Real-time updates via polling (WebSocket ready)
  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate real-time data fetch
      setMetrics(prev => ({
        ...prev,
        alertsToday: prev.alertsToday + Math.floor(Math.random() * 2),
        threatsBlocked: prev.threatsBlocked + Math.floor(Math.random() * 3),
        chatSessions: prev.chatSessions + Math.floor(Math.random() * 2),
        avgResponseTime: 1.2 + Math.random() * 0.5,
      }))
      setLastUpdate(new Date())
    }, 5000) // Update every 5 seconds

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time overview · Last update: {lastUpdate.toLocaleTimeString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs text-green-500">Live</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <Card className="bg-zinc-900/50 border-zinc-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
              <Activity className="w-4 h-4" /> Active Agents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{metrics.activeAgents}</div>
            <p className="text-xs text-green-400 mt-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> All operational
            </p>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/50 border-zinc-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Alerts Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{metrics.alertsToday}</div>
            <p className="text-xs text-amber-400 mt-1">3 critical</p>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/50 border-zinc-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
              <Shield className="w-4 h-4" /> Threats Blocked
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{metrics.threatsBlocked}</div>
            <p className="text-xs text-green-400 mt-1">Last 7 days</p>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/50 border-zinc-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
              <MessageSquare className="w-4 h-4" /> Chat Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{metrics.chatSessions}</div>
            <p className="text-xs text-blue-400 mt-1">Active now: 5</p>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/50 border-zinc-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
              <Clock className="w-4 h-4" /> Avg Response
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{metrics.avgResponseTime.toFixed(1)}s</div>
            <p className="text-xs text-green-400 mt-1">Target: &lt;2s</p>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/50 border-zinc-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
              <Activity className="w-4 h-4" /> Uptime
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{metrics.uptime}%</div>
            <p className="text-xs text-green-400 mt-1">Last 30 days</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card className="bg-zinc-900/50 border-zinc-700">
        <CardHeader>
          <CardTitle className="text-white">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { time: '2 min ago', event: 'Threat blocked: SQL injection attempt', severity: 'critical' },
              { time: '15 min ago', event: 'Agent qwen completed analysis on LIN-2051', severity: 'info' },
              { time: '1 hour ago', event: 'Knowledge graph updated: 42 new entities', severity: 'info' },
              { time: '3 hours ago', event: 'Alert acknowledged: Suspicious login pattern', severity: 'warning' },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-zinc-800/50">
                <div className={`w-2 h-2 rounded-full mt-2 ${
                  item.severity === 'critical' ? 'bg-red-500' :
                  item.severity === 'warning' ? 'bg-amber-500' : 'bg-blue-500'
                }`} />
                <div className="flex-1">
                  <p className="text-sm text-white">{item.event}</p>
                  <p className="text-xs text-zinc-500">{item.time}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
