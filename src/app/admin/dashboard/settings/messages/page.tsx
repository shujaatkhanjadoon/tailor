"use client";

import React, { useState, useEffect, useCallback } from "react";
import { MessageCircle, Mail, Bell, Save, Eye, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Template {
  id: string;
  key: string;
  label: string;
  subject: string;
  body: string;
  variables: string[];
  channel: "email" | "whatsapp" | "push";
  updated_at: string;
}

const DEFAULT_TEMPLATES: Omit<Template, "id" | "updated_at">[] = [
  {
    key: "activation",
    label: "Activation Message",
    subject: "Aapki shop activate ho gayi hai!",
    body: "Assalam o Alaikum {owner_name}! Aapki MeraDarzi shop ({shop_name}) activate ho gayi hai. Ab aap login karke orders lena shuru kar sakte hain.\n\nShukriya!\nMeraDarzi Team",
    variables: ["owner_name", "shop_name"],
    channel: "whatsapp",
  },
  {
    key: "rejection",
    label: "Rejection Message",
    subject: "Shop verification rejected",
    body: "Assalam o Alaikum {owner_name}! Aapki MeraDarzi shop ({shop_name}) ki verification reject kar di gayi hai.\n\nWajah: {reason}\n\nBaraye meharbani humse rabta karein.\nShukriya!",
    variables: ["owner_name", "shop_name", "reason"],
    channel: "whatsapp",
  },
  {
    key: "reminder_5d",
    label: "5-Day Reminder",
    subject: "Subscription 5 din mein expire ho rahi hai",
    body: "Assalam o Alaikum {owner_name}! Aapki MeraDarzi subscription {days_left} din mein expire ho rahi hai.\n\nExpiry Date: {expiry_date}\nPlan: {plan}\n\nRenewal karein: {renewal_url}\n\nShukriya!",
    variables: ["owner_name", "shop_name", "days_left", "expiry_date", "plan", "renewal_url"],
    channel: "whatsapp",
  },
  {
    key: "reminder_3d",
    label: "3-Day Reminder",
    subject: "Subscription 3 din mein expire ho rahi hai",
    body: "Assalam o Alaikum {owner_name}! Aapki MeraDarzi subscription sirf {days_left} din mein expire ho rahi hai.\n\nExpiry Date: {expiry_date}\nPlan: {plan}\n\nAbhi renewal karein: {renewal_url}\n\nShukriya!",
    variables: ["owner_name", "shop_name", "days_left", "expiry_date", "plan", "renewal_url"],
    channel: "whatsapp",
  },
  {
    key: "reminder_1d",
    label: "1-Day Reminder",
    subject: "Subscription kal expire ho rahi hai!",
    body: "Assalam o Alaikum {owner_name}! Aapki MeraDarzi subscription KAL expire ho rahi hai.\n\nExpiry Date: {expiry_date}\nPlan: {plan}\n\nFauran renewal karein: {renewal_url}\n\nAgar renewal nahi kiya to service band ho jayegi.\nShukriya!",
    variables: ["owner_name", "shop_name", "days_left", "expiry_date", "plan", "renewal_url"],
    channel: "whatsapp",
  },
  {
    key: "expiry_notification",
    label: "Expiry Notification",
    subject: "Aapki subscription expire ho gayi hai",
    body: "Assalam o Alaikum {owner_name}! Aapki MeraDarzi subscription expire ho gayi hai. Ab aap limited features use kar sakte hain.\n\nApni service dubara active karne ke liye renewal karein:\n{renewal_url}\n\nShukriya!",
    variables: ["owner_name", "shop_name", "renewal_url"],
    channel: "whatsapp",
  },
];

const CHANNEL_ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  email: Mail,
  whatsapp: MessageCircle,
  push: Bell,
};

function PreviewModal({ template, onClose }: {
  template: Template | null;
  onClose: () => void;
}) {
  if (!template) return null;
  const previewVars: Record<string, string> = {
    owner_name: "Ahmed",
    shop_name: "Ahmed Tailors",
    days_left: "3",
    expiry_date: "15 Jul 2026",
    plan: "Professional Monthly",
    reason: "Documents incomplete",
    renewal_url: "https://app.meradarzi.pk/billing/upgrade",
  };
  let previewBody = template.body;
  Object.entries(previewVars).forEach(([key, val]) => {
    previewBody = previewBody.replaceAll(`{${key}}`, val);
  });
  let previewSubject = template.subject;
  Object.entries(previewVars).forEach(([key, val]) => {
    previewSubject = previewSubject.replaceAll(`{${key}}`, val);
  });

  const channelIcon = CHANNEL_ICONS[template.channel] ?? Mail;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <h3 className="text-white font-bold text-sm">{template.label} — Preview</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className={cn(
              "flex items-center gap-1 px-2 py-0.5 rounded-full",
              template.channel === "whatsapp" ? "bg-green-900/50 text-green-400" :
              template.channel === "email" ? "bg-blue-900/50 text-blue-400" :
              "bg-purple-900/50 text-purple-400"
            )}>
              {React.createElement(channelIcon, { size: 10 })} {template.channel}
            </span>
          </div>
          {template.subject && (
            <div>
              <p className="text-[10px] font-bold uppercase text-slate-500 mb-1">Subject</p>
              <div className="bg-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-200">{previewSubject}</div>
            </div>
          )}
          <div>
            <p className="text-[10px] font-bold uppercase text-slate-500 mb-1">Body</p>
            <div className="bg-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 whitespace-pre-wrap">
              {previewBody}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminMessagesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/templates");
      if (res.status === 401) { window.location.href = "/admin/login"; return; }
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      if (data.data && data.data.length > 0) {
        setTemplates(data.data);
      } else {
        setTemplates(DEFAULT_TEMPLATES.map((t, _i) => ({
          ...t,
          id: "",
          updated_at: new Date().toISOString(),
        })));
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const mergeDefaults = () => {
    const existingMap = new Map(templates.filter(t => t.id).map(t => [t.key, t]));
    const merged = DEFAULT_TEMPLATES.map(dt => {
      const existing = existingMap.get(dt.key);
      return existing ?? {
        ...dt,
        id: "",
        updated_at: new Date().toISOString(),
      };
    });
    const customKeys = new Set(DEFAULT_TEMPLATES.map(dt => dt.key));
    templates.filter(t => !customKeys.has(t.key)).forEach(t => merged.push(t));
    setTemplates(merged);
  };

  const updateTemplate = (key: string, field: keyof Template, value: string | string[]) => {
    setTemplates(prev => prev.map(t => t.key === key ? { ...t, [field]: value, updated_at: new Date().toISOString() } : t));
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccess(false);
    try {
      const res = await fetch("/api/admin/templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templates }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.errors?.join(", ") ?? "Save failed");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      await load();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-5">
        <h1 className="text-xl font-bold text-white">Message Templates</h1>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-slate-800 border border-slate-700 rounded-2xl h-24 p-4 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Message Templates</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            WhatsApp aur email messages edit karein jo shops ko bheje jaate hain
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={mergeDefaults}
            className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600
                       text-slate-300 text-xs font-semibold px-3 py-2 rounded-xl transition-colors"
          >
            <RefreshCw size={12} /> Reset Defaults
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700
                       disabled:bg-slate-700 text-white text-xs font-semibold px-4 py-2
                       rounded-xl transition-colors disabled:opacity-50"
          >
            {saving ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
            {saving ? "Saving..." : "Save All"}
          </button>
        </div>
      </div>

      {/* Feedback */}
      {error && (
        <div className="flex items-center gap-2 bg-red-900/30 border border-red-700 rounded-xl px-3 py-2.5">
          <AlertCircle size={14} className="text-red-400" />
          <p className="text-red-300 text-xs">{error}</p>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 bg-green-900/30 border border-green-700 rounded-xl px-3 py-2.5">
          <CheckCircle2 size={14} className="text-green-400" />
          <p className="text-green-300 text-xs font-semibold">All templates saved successfully!</p>
        </div>
      )}

      {/* Templates */}
      <div className="space-y-3">
        {templates.map((template) => {
          const isEditing = editingKey === template.key;
          const ChannelIcon = CHANNEL_ICONS[template.channel] ?? Mail;
          return (
            <div key={template.key}
              className={cn(
                "border rounded-2xl overflow-hidden transition-all",
                isEditing ? "border-blue-700 bg-slate-800/60" : "border-slate-700 bg-slate-800/40",
              )}
            >
              {/* Header */}
              <div
                className="flex items-start gap-3 p-4 cursor-pointer hover:bg-slate-700/50 transition-colors"
                onClick={() => setEditingKey(isEditing ? null : template.key)}
              >
                <div className={cn(
                  "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
                  template.channel === "whatsapp" ? "bg-green-900/50" :
                  template.channel === "email" ? "bg-blue-900/50" : "bg-purple-900/50",
                )}>
                  {ChannelIcon && <ChannelIcon size={16} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-200 text-sm">{template.label}</p>
                  <p className="text-slate-500 text-xs font-mono mt-0.5">{template.key}</p>
                  <p className="text-slate-500 text-[10px] mt-0.5">
                    Variables: {template.variables.map(v => <code key={v} className="text-blue-400 bg-slate-700/50 px-1 rounded">{`{${v}}`}</code>)}
                  </p>
                </div>
                <span className={cn(
                  "text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0",
                  template.channel === "whatsapp" ? "bg-green-900/50 text-green-400" :
                  template.channel === "email" ? "bg-blue-900/50 text-blue-400" :
                  "bg-purple-900/50 text-purple-400",
                )}>
                  {template.channel}
                </span>
              </div>

              {/* Expanded editor */}
              {isEditing && (
                <div className="px-4 pb-4 border-t border-slate-700 space-y-3">
                  {/* Subject */}
                  <div className="mt-3">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                      Subject / Title
                    </label>
                    <input
                      type="text"
                      value={template.subject}
                      onChange={(e) => updateTemplate(template.key, "subject", e.target.value)}
                      className="w-full bg-slate-700 border border-slate-600 text-slate-200
                                 rounded-xl px-3 py-2.5 text-sm outline-none
                                 focus:border-blue-500 placeholder:text-slate-600"
                      placeholder="Subject line"
                    />
                  </div>

                  {/* Body */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                      Message Body
                    </label>
                    <textarea
                      value={template.body}
                      onChange={(e) => updateTemplate(template.key, "body", e.target.value)}
                      rows={6}
                      className="w-full bg-slate-700 border border-slate-600 text-slate-200
                                 rounded-xl px-3 py-2.5 text-sm outline-none resize-y
                                 focus:border-blue-500 placeholder:text-slate-600 font-mono"
                      placeholder="Message body with {variables}"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      Available variables: {template.variables.map(v => <code key={v} className="text-blue-400 bg-slate-700/50 px-1 rounded mx-0.5">{`{${v}}`}</code>)}
                    </p>
                  </div>

                  {/* Channel */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                      Channel
                    </label>
                    <select
                      value={template.channel}
                      onChange={(e) => updateTemplate(template.key, "channel", e.target.value)}
                      className="bg-slate-700 text-slate-200 text-sm border border-slate-600
                                 rounded-xl px-3 py-2.5 outline-none focus:border-blue-500"
                    >
                      <option value="email">Email</option>
                      <option value="whatsapp">WhatsApp</option>
                      <option value="push">Push Notification</option>
                    </select>
                  </div>

                  {/* Preview button */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPreviewTemplate(template)}
                      className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600
                                 text-slate-300 text-xs font-semibold px-3 py-2 rounded-xl transition-colors"
                    >
                      <Eye size={12} /> Preview
                    </button>
                    <span className="text-[10px] text-slate-600 self-center ml-auto">
                      Updated: {new Date(template.updated_at).toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Preview modal */}
      <PreviewModal template={previewTemplate} onClose={() => setPreviewTemplate(null)} />
    </div>
  );
}
