"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { RefreshCw, Bell, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface NotificationTemplate {
  id: string;
  title: string;
  message: string;
  type: string;
  target_plan: string;
  expires_at: string;
  created_at?: string;
}

function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-PK", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

const TYPE_COLORS: Record<string, string> = {
  info: "bg-blue-900/50 text-blue-400",
  success: "bg-emerald-900/50 text-emerald-400",
  warning: "bg-amber-900/50 text-amber-400",
  urgent: "bg-red-900/50 text-red-400",
};

const PER_PAGE = 50

export default function NotificationHistoryPage() {
  const [logs, setLogs] = useState<NotificationTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(true);
  const offsetRef = useRef(0);

  const load = useCallback(async (append = false) => {
    if (append) setLoadingMore(true); else setLoading(true)
    setError("");
    try {
      const offset = append ? offsetRef.current : 0
      const res = await fetch(`/api/admin/data?type=notification_history&limit=${PER_PAGE}&offset=${offset}`);
      if (res.status === 401) { window.location.href = "/admin/login"; return; }
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const batch = (data.data ?? []) as NotificationTemplate[]
      if (append) {
        setLogs(prev => [...prev, ...batch])
        offsetRef.current += batch.length
      } else {
        setLogs(batch)
        offsetRef.current = PER_PAGE
      }
      setHasMore(batch.length >= PER_PAGE)
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false); setLoadingMore(false)
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Notification History</h1>
          <p className="text-slate-400 text-sm mt-0.5">{logs.length} total notifications sent</p>
        </div>
        <button onClick={() => load()} disabled={loading}
          className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-semibold px-3 py-2 rounded-xl disabled:opacity-50"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-xl px-3 py-2">
          <p className="text-red-300 text-xs">{error}</p>
        </div>
      )}

      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-slate-800 border border-slate-700 rounded-xl h-16 p-4 animate-pulse" />
          ))}
        </div>
      )}

      {!loading && logs.length === 0 && (
        <div className="text-center py-12">
          <Bell size={32} className="text-slate-700 mx-auto mb-3" />
          <p className="text-slate-500 font-semibold">No notifications sent yet</p>
        </div>
      )}

      {!loading && logs.length > 0 && (
        <>
          <div className="space-y-2">
            {logs.map(log => (
              <div key={log.id}
                className="bg-slate-800/40 border border-slate-700 rounded-xl p-3"
              >
                <div className="flex items-start gap-3">
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                    TYPE_COLORS[log.type] ?? "bg-slate-700 text-slate-400",
                  )}>
                    <Bell size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-slate-200 truncate">{log.title}</span>
                      <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full", TYPE_COLORS[log.type] ?? "bg-slate-800 text-slate-400")}>
                        {log.type}
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-700 text-slate-400">
                        {log.target_plan}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{log.message}</p>
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-600">
                      <span>Created: {formatDateTime(log.created_at)}</span>
                      <span>Expires: {formatDateTime(log.expires_at)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {hasMore && (
            <div className="flex justify-center pt-2">
              <button
                onClick={() => load(true)}
                disabled={loadingMore}
                className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600
                           text-slate-300 text-xs font-semibold px-4 py-2.5 rounded-xl
                           disabled:opacity-50 transition-colors"
              >
                {loadingMore ? <RefreshCw size={12} className="animate-spin" /> : <ChevronDown size={12} />}
                {loadingMore ? "Loading..." : "Load More"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
