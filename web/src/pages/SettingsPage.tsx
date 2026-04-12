import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "@apollo/client/react";
import { GET_ME, UPDATE_PROFILE, CHANGE_PASSWORD } from "../graphql/users";
import { useToast } from "../components/ui/toastContext";
import { useTheme } from "../contexts/useTheme";
import FaceSettings from "../components/settings/FaceSettings";
import VoiceSettings from "../components/settings/VoiceSettings";
import {
  User,
  Lock,
  Shield,
  Palette,
  Loader2,
  Save,
  ExternalLink,
  Bell,
  Sun,
  Moon,
  Monitor
} from "lucide-react";
import { Link } from "react-router-dom";

type Tab = "account" | "security" | "interface";

interface UserData {
  me: {
    id: string;
    email: string;
    name?: string;
    role: string;
  };
}

export default function SettingsPage() {
  const { addToast } = useToast();
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<Tab>("account");

  const { data, loading, refetch } = useQuery<UserData>(GET_ME, {
    fetchPolicy: 'network-only',
  });

  const [updateProfile, { loading: updating }] = useMutation(UPDATE_PROFILE);
  const [changePassword, { loading: changingPass }] = useMutation(CHANGE_PASSWORD);

  // Form States
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [passwords, setPasswords] = useState({ current: "", new: "", confirm: "" });

  useEffect(() => {
    if (data?.me) {
      setName(data.me.name || "");
      setEmail(data.me.email || "");
    }
  }, [data]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateProfile({ variables: { name, email } });
      addToast({ type: 'success', title: 'Updated', message: 'Account details saved.' });
      if (refetch) refetch();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error updating profile';
      addToast({ type: 'error', title: 'Error', message: msg });
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwords.new !== passwords.confirm) {
      return addToast({ type: 'error', title: 'Error', message: 'Passwords do not match' });
    }
    try {
      await changePassword({
        variables: { currentPassword: passwords.current, newPassword: passwords.new }
      });
      addToast({ type: 'success', title: 'Success', message: 'Password changed successfully.' });
      setPasswords({ current: "", new: "", confirm: "" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error changing password';
      addToast({ type: 'error', title: 'Error', message: msg });
    }
  };

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center text-white">
        <Loader2 className="animate-spin mr-2" /> Loading settings...
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <div className="flex flex-col md:flex-row gap-8">

        {/* SIDEBAR TABS */}
        <aside className="w-full md:w-64 space-y-2">
          <h1 className="text-2xl font-bold text-white mb-6 px-4">Settings</h1>

          <button
            onClick={() => setActiveTab("account")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === "account"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-900/40"
                : "text-slate-400 hover:bg-slate-800"
              }`}
          >
            <User size={18} /> <span className="font-semibold">Account</span>
          </button>

          <button
            onClick={() => setActiveTab("security")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === "security"
                ? "bg-purple-600 text-white shadow-lg shadow-purple-900/40"
                : "text-slate-400 hover:bg-slate-800"
              }`}
          >
            <Shield size={18} /> <span className="font-semibold">Security</span>
          </button>

          <button
            onClick={() => setActiveTab("interface")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === "interface"
                ? "bg-pink-600 text-white shadow-lg shadow-pink-900/40"
                : "text-slate-400 hover:bg-slate-800"
              }`}
          >
            <Palette size={18} /> <span className="font-semibold">Interface</span>
          </button>

          <div className="pt-8 px-4 border-t border-slate-800 mt-8 hidden md:block">
            <Link to="/profile" className="text-xs text-slate-500 hover:text-slate-300 transition-colors uppercase tracking-widest font-bold">
              View My Profile
            </Link>
          </div>
        </aside>

        {/* CONTENT AREA */}
        <main className="flex-1 min-h-[600px] bg-slate-800/30 backdrop-blur-md rounded-3xl border border-slate-700/50 p-6 md:p-10">

          {/* ACCOUNT TAB */}
          {activeTab === "account" && (
            <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <section>
                <h2 className="text-xl font-bold text-white mb-6">Personal Information</h2>
                <form onSubmit={handleUpdateProfile} className="max-w-xl space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Display Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Email Address</label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <button
                    disabled={updating}
                    className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all disabled:opacity-50"
                  >
                    {updating ? <Loader2 className="animate-spin" /> : <Save size={18} />} Save Changes
                  </button>
                </form>
              </section>

              <section className="pt-8 border-t border-slate-700/50">
                <h2 className="text-xl font-bold text-white mb-6">Change Password</h2>
                <form onSubmit={handleChangePassword} className="max-w-xl space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Current Password</label>
                      <input
                        type="password"
                        value={passwords.current}
                        onChange={e => setPasswords({ ...passwords, current: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-pink-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">New Password</label>
                      <input
                        type="password"
                        value={passwords.new}
                        onChange={e => setPasswords({ ...passwords, new: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-pink-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Confirm New</label>
                      <input
                        type="password"
                        value={passwords.confirm}
                        onChange={e => setPasswords({ ...passwords, confirm: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-pink-500 outline-none"
                      />
                    </div>
                  </div>
                  <button
                    disabled={changingPass}
                    className="flex items-center gap-2 px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-bold transition-all disabled:opacity-50"
                  >
                    {changingPass ? <Loader2 className="animate-spin" /> : <Lock size={18} />} Update Password
                  </button>
                </form>
              </section>
            </div>
          )}

          {/* SECURITY TAB */}
          {activeTab === "security" && (
            <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <section>
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-xl font-bold text-white">Biometric Security</h2>
                    <p className="text-slate-400 text-sm mt-1">Manage your Face ID and Voice Identity registrations.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <FaceSettings />
                  <VoiceSettings />
                </div>
              </section>

              <section className="pt-8 border-t border-slate-700/50">
                <div className="bg-gradient-to-br from-slate-900 to-indigo-900/20 rounded-2xl p-8 border border-indigo-500/20 flex flex-col md:flex-row items-center justify-between gap-6">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Shield className="text-indigo-400" /> Security Center
                    </h3>
                    <p className="text-slate-400 text-sm mt-2 max-w-sm">
                      View your detailed audit logs, recent login attempts, and system safety reports in the Security Operations Center (SOC).
                    </p>
                  </div>
                  <Link
                    to="/security"
                    className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-lg shadow-indigo-900/40 transition-all whitespace-nowrap"
                  >
                    Open SOC Auditor <ExternalLink size={16} />
                  </Link>
                </div>
              </section>
            </div>
          )}

          {/* INTERFACE TAB */}
          {activeTab === "interface" && (
            <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <section>
                <h2 className="text-xl font-bold text-white mb-6">Appearance</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Theme Toggle Card */}
                  <div className="bg-slate-900/50 border border-slate-700 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-pink-500/10 rounded-xl flex items-center justify-center border border-pink-500/20">
                          {theme === 'dark' ? <Moon className="text-pink-400" size={20} /> : <Sun className="text-pink-400" size={20} />}
                        </div>
                        <h3 className="font-bold text-white">Interface Theme</h3>
                      </div>
                      <span className="text-[10px] uppercase tracking-widest font-black text-slate-500">{theme} Mode</span>
                    </div>
                    <p className="text-slate-400 text-sm mb-6">Switch between dark and light themes for the best visual experience.</p>
                    <button
                      onClick={toggleTheme}
                      className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold border border-slate-700 transition-all flex items-center justify-center gap-2"
                    >
                      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />} Switch to {theme === 'dark' ? 'Light' : 'Dark'}
                    </button>
                  </div>

                  {/* Future Notifications Card */}
                  <div className="bg-slate-900/50 border border-slate-700 rounded-2xl p-6 opacity-50 cursor-not-allowed">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-orange-500/10 rounded-xl flex items-center justify-center border border-orange-500/20">
                          <Bell className="text-orange-400" size={20} />
                        </div>
                        <h3 className="font-bold text-white">Notifications</h3>
                      </div>
                      <span className="px-2 py-0.5 bg-slate-800 text-slate-500 text-[8px] rounded font-bold uppercase tracking-widest">Coming Soon</span>
                    </div>
                    <p className="text-slate-400 text-sm mb-6">Control which system events trigger push notifications or email alerts.</p>
                    <div className="w-full py-2.5 bg-slate-950/50 rounded-xl text-slate-600 text-center text-xs font-bold border border-slate-900">
                      DISABLED
                    </div>
                  </div>
                </div>
              </section>

              <section className="pt-8 border-t border-slate-700/50">
                <h2 className="text-xl font-bold text-white mb-6">System Preferences</h2>
                <div className="bg-slate-900/50 border border-slate-700 rounded-2xl p-6">
                  <div className="flex items-center gap-4 mb-4">
                    <Monitor className="text-blue-400" />
                    <div>
                      <h4 className="font-bold text-white">High Performance Mode</h4>
                      <p className="text-xs text-slate-500">Prioritize faster AI response streaming over visual animations.</p>
                    </div>
                    <div className="ml-auto w-12 h-6 bg-slate-800 rounded-full relative p-1 cursor-not-allowed opacity-50">
                      <div className="w-4 h-4 bg-slate-600 rounded-full" />
                    </div>
                  </div>
                </div>
              </section>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
