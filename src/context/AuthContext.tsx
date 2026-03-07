"use client";
import React, { createContext, useContext, useState, useEffect } from "react";
import Cookies from "js-cookie";
import api from "@/lib/api";

interface User {
  _id: string;
  name: string;
  email: string;
  role: "student" | "professional";
  xp: number;
  coins: number;
  streak: number;
  nativeLanguage: string;
  currentLanguage: string;
  avatar: string;
  token: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, role: string, nativeLanguage: string, currentLanguage: string) => Promise<void>;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const token = Cookies.get("token");
      if (!token) return;
      const { data } = await api.get("/users/me");
      setUser((prev) => {
        if (!prev) return prev;
        const updated = { ...prev, xp: data.xp, streak: data.streak, coins: data.coins ?? prev.coins ?? 0 };
        Cookies.set("user", JSON.stringify(updated), { expires: 7 });
        return updated;
      });
    } catch { /* ignore */ }
  };

  useEffect(() => {
    const stored = Cookies.get("user");
    if (stored) {
      try { setUser(JSON.parse(stored)); } catch { /* ignore */ }
    }
    setLoading(false);
    // Hydrate with fresh XP & streak from server on every app load
    refreshUser();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (email: string, password: string) => {
    const { data } = await api.post("/auth/login", { email, password });
    Cookies.set("token", data.token, { expires: 7 });
    Cookies.set("user", JSON.stringify(data), { expires: 7 });
    setUser(data);
  };

  const register = async (name: string, email: string, password: string, role: string, nativeLanguage: string, currentLanguage: string) => {
    const { data } = await api.post("/auth/register", { name, email, password, role, nativeLanguage, currentLanguage });
    Cookies.set("token", data.token, { expires: 7 });
    Cookies.set("user", JSON.stringify(data), { expires: 7 });
    setUser(data);
  };

  const updateUser = (updates: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...updates };
      Cookies.set("user", JSON.stringify(updated), { expires: 7 });
      return updated;
    });
  };

  const logout = () => {
    Cookies.remove("token");
    Cookies.remove("user");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateUser, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
