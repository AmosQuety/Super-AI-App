import React from "react";
import { useQuery } from "@apollo/client/react";
import { Shield, AlertTriangle, CheckCircle, Clock, Info, User, Globe, Monitor } from "lucide-react";
import { GET_SECURITY_AUDIT_LOGS } from "../graphql/users";
// import { format } from "date-fns"; // Removed to avoid dependency issue

const formatLogDate = (dateString: string) => {
  const date = new Date(dateString);
  return {
    time: new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(date),
    day: new Intl.DateTimeFormat('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
  };
};

interface AuditLog {
  id: string;
  userId: string;
  userEmail: string;
  event: string;
  ipAddress: string;
  userAgent: string;
  details: string;
  createdAt: string;
}

interface AuditLogsData {
  securityAuditLogs: AuditLog[];
}

const EventBadge = ({ event }: { event: string }) => {
  switch (event) {
    case "VOICE_LOGIN_SUCCESS":
      return (
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-medium border border-emerald-500/20">
          <CheckCircle size={12} /> Success
        </span>
      );
    case "VOICE_LOGIN_FAILED":
      return (
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 text-red-400 text-xs font-medium border border-red-500/20">
          <AlertTriangle size={12} /> Failure
        </span>
      );
    case "ACCOUNT_LOCKED":
      return (
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-500/10 text-orange-400 text-xs font-medium border border-orange-500/20">
          <Shield size={12} /> Locked
        </span>
      );
    default:
      return (
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-500/10 text-slate-400 text-xs font-medium border border-slate-500/20">
          <Info size={12} /> {event}
        </span>
      );
  }
};

export default function SecurityPage() {
  const { data, loading, error } = useQuery<AuditLogsData>(GET_SECURITY_AUDIT_LOGS, {
    fetchPolicy: "network-only",
    pollInterval: 30000, // Refresh every 30s
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-4 text-slate-400">
          <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
          <p className="text-sm font-medium animate-pulse">Analyzing Audit Streams...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 bg-slate-950 min-h-screen">
        <div className="max-w-4xl mx-auto bg-red-500/10 border border-red-500/20 rounded-2xl p-6 text-red-400 flex items-start gap-4">
          <AlertTriangle className="shrink-0" size={24} />
          <div>
            <h3 className="font-bold text-lg">Failed to load security logs</h3>
            <p className="text-sm mt-1">{error.message}</p>
          </div>
        </div>
      </div>
    );
  }

  const logs = data?.securityAuditLogs || [];

  return (
    <div className="p-8 bg-slate-950 min-h-screen">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-8">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              Security Operations Center <Shield className="text-indigo-400" size={28} />
            </h1>
            <p className="text-slate-400 mt-2">Real-time monitoring of biometric authentication and identity events</p>
          </div>
          <div className="flex items-center gap-3 bg-slate-900/50 p-2 rounded-xl border border-slate-800">
            <div className="flex flex-col items-end px-3">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">System Status</span>
              <span className="text-emerald-400 text-xs flex items-center gap-1.5 font-medium">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Operational
              </span>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-2">
            <p className="text-slate-500 text-sm font-medium">Total Events (30d)</p>
            <p className="text-3xl font-bold text-white">{logs.length}</p>
          </div>
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-2">
            <p className="text-slate-500 text-sm font-medium">Successful Logins</p>
            <p className="text-3xl font-bold text-emerald-400">
              {logs.filter(l => l.event === "VOICE_LOGIN_SUCCESS").length}
            </p>
          </div>
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-2">
            <p className="text-slate-500 text-sm font-medium">Anomalies Detected</p>
            <p className="text-3xl font-bold text-rose-400">
              {logs.filter(l => l.event === "VOICE_LOGIN_FAILED" || l.event === "ACCOUNT_LOCKED").length}
            </p>
          </div>
        </div>

        {/* Audit Table */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
          <div className="px-6 py-4 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              Identity Event Logs <Clock size={18} className="text-slate-500" />
            </h2>
            <button className="text-xs text-slate-400 hover:text-white transition-colors">Export Logs</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-800/20 text-slate-500 text-[10px] uppercase font-bold tracking-widest border-b border-slate-800/50">
                <tr>
                  <th className="px-6 py-4">Timestamp</th>
                  <th className="px-6 py-4">Identity</th>
                  <th className="px-6 py-4">Event Type</th>
                  <th className="px-6 py-4">Environment</th>
                  <th className="px-6 py-4">Network Info</th>
                  <th className="px-6 py-4">Metadata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500 italic">
                      No security events recorded yet in the current observation window.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/20 transition-all duration-200 group">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="text-white text-sm font-medium font-mono">
                          {formatLogDate(log.createdAt).time}
                        </p>
                        <p className="text-slate-500 text-[10px]">
                          {formatLogDate(log.createdAt).day}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                            <User size={14} />
                          </div>
                          <div>
                            <p className="text-white text-sm font-medium">{log.userEmail || "Anonymous"}</p>
                            <p className="text-slate-500 text-[10px]">{log.userId?.substring(0, 8)}...</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <EventBadge event={log.event} />
                      </td>
                      <td className="px-6 py-4">
                         <div className="flex flex-col gap-1">
                            <span className="flex items-center gap-1.5 text-slate-400 text-xs">
                               <Monitor size={10} /> {log.userAgent?.split(' ')[0] || "Unknown Client"}
                            </span>
                         </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-slate-300 text-xs font-mono flex items-center gap-1.5">
                           <Globe size={10} className="text-slate-500" /> {log.ipAddress || "127.0.0.1"}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="max-w-[150px]">
                           <p className="text-slate-500 text-[10px] break-all group-hover:text-slate-400 transition-colors">
                              {log.details || "No additional context"}
                           </p>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
