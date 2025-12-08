// src/pages/ProfilePage.tsx
import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "@apollo/client/react";
import { GET_ME, UPDATE_PROFILE, CHANGE_PASSWORD } from "../graphql/users";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../components/ui/toastContext";
import FaceSettings from "../components/settings/FaceSettings";
import { User, Mail, Lock, Save, Loader2, LogOut } from "lucide-react";

export default function ProfilePage() {
  const { signOut } = useAuth();
  const { addToast } = useToast();
  const { data, loading, error } = useQuery(GET_ME);

  // Form States
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  
  // Password States
  const [passwords, setPasswords] = useState({ current: "", new: "", confirm: "" });

  const [updateProfile, { loading: updating }] = useMutation(UPDATE_PROFILE);
  const [changePassword, { loading: changingPass }] = useMutation(CHANGE_PASSWORD);

  // Load data when query finishes
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
      addToast({ type: 'success', title: 'Updated', message: 'Profile details updated.' });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message });
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwords.new !== passwords.confirm) {
      return addToast({ type: 'error', title: 'Error', message: 'New passwords do not match' });
    }
    try {
      await changePassword({ 
        variables: { currentPassword: passwords.current, newPassword: passwords.new } 
      });
      addToast({ type: 'success', title: 'Success', message: 'Password changed successfully.' });
      setPasswords({ current: "", new: "", confirm: "" });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message });
    }
  };

  if (loading) return <div className="flex h-screen items-center justify-center bg-slate-900 text-white"><Loader2 className="animate-spin mr-2" /> Loading profile...</div>;
  if (error) return <div className="text-red-500 text-center p-10">Error loading profile: {error.message}</div>;

  return (
    <div className="min-h-screen bg-slate-900 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-2xl font-bold text-white shadow-lg shadow-purple-500/20">
              {data.me.name?.[0]?.toUpperCase() || data.me.email[0].toUpperCase()}
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">{data.me.name}</h1>
              <p className="text-slate-400">{data.me.email}</p>
              <div className="flex gap-2 mt-2">
                <span className="px-2 py-0.5 rounded text-xs bg-slate-800 text-slate-300 border border-slate-700 uppercase tracking-wider font-semibold">
                    {data.me.role}
                </span>
              </div>
            </div>
          </div>
          
          <button 
            onClick={signOut}
            className="px-4 py-2 bg-slate-800 hover:bg-red-500/10 hover:text-red-400 text-slate-300 rounded-xl transition border border-slate-700 hover:border-red-500/30 flex items-center gap-2"
          >
            <LogOut size={18} /> Sign Out
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* LEFT COLUMN: Personal Info */}
            <div className="space-y-8">
                <section>
                    <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                        <User className="text-blue-400" /> Personal Details
                    </h2>
                    <form onSubmit={handleUpdateProfile} className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50 space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Full Name</label>
                            <input 
                                type="text" 
                                value={name} 
                                onChange={e => setName(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Email Address</label>
                            <input 
                                type="email" 
                                value={email} 
                                onChange={e => setEmail(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                        <div className="pt-2">
                            <button 
                                disabled={updating}
                                className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {updating ? <Loader2 className="animate-spin" /> : <Save size={18} />} Update Profile
                            </button>
                        </div>
                    </form>
                </section>

                {/* SECURITY SECTION: Face ID */}
                <section>
                    <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                         Security & Biometrics
                    </h2>
                    {/* HERE IS YOUR NEW COMPONENT */}
                    <FaceSettings />
                </section>
            </div>

            {/* RIGHT COLUMN: Password */}
            <div className="space-y-8">
                 <section>
                    <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                        <Lock className="text-orange-400" /> Change Password
                    </h2>
                    <form onSubmit={handleChangePassword} className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50 space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Current Password</label>
                            <input 
                                type="password" 
                                value={passwords.current}
                                onChange={e => setPasswords({...passwords, current: e.target.value})}
                                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-white focus:ring-2 focus:ring-orange-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">New Password</label>
                            <input 
                                type="password" 
                                value={passwords.new}
                                onChange={e => setPasswords({...passwords, new: e.target.value})}
                                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-white focus:ring-2 focus:ring-orange-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Confirm New Password</label>
                            <input 
                                type="password" 
                                value={passwords.confirm}
                                onChange={e => setPasswords({...passwords, confirm: e.target.value})}
                                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-white focus:ring-2 focus:ring-orange-500 outline-none"
                            />
                        </div>
                        <div className="pt-2">
                            <button 
                                disabled={changingPass}
                                className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {changingPass ? <Loader2 className="animate-spin" /> : <Lock size={18} />} Update Password
                            </button>
                        </div>
                    </form>
                </section>
            </div>
        </div>
      </div>
    </div>
  );
}