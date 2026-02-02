import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Update this to your FastAPI backend URL (e.g. http://192.168.x.x:8000)
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';

type User = {
    id: string;
    email: string;
    full_name: string;
    department: string;
    ward: string;
    role: string;
};

type AuthContextType = {
    user: User | null;
    isLoading: boolean;
    signIn: (email: string, password: string) => Promise<void>;
    signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadStorageData();
    }, []);

    async function loadStorageData() {
        try {
            const authData = await SecureStore.getItemAsync('user_session');
            if (authData) {
                setUser(JSON.parse(authData));
            }
        } catch (e) {
            console.error("Failed to load auth data", e);
        } finally {
            setIsLoading(false);
        }
    }

    const signIn = async (email: string, password: string) => {
        try {
            const response = await fetch(`${API_URL}/login/user`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const responseText = await response.text();
            let data;
            try {
                data = JSON.parse(responseText);
            } catch (e) {
                console.error("Failed to parse JSON response:", responseText);
                throw new Error(`Invalid server response: ${responseText.slice(0, 50)}...`);
            }

            if (!response.ok) {
                throw new Error(data.detail || 'Login failed');
            }

            const token = data.access_token;

            // Now fetch the actual profile from Supabase using the email 
            // (or you can update your backend to return the user object)
            const { data: userData, error } = await supabase
                .from('users')
                .select('*')
                .eq('email', email)
                .single();

            if (error || !userData) {
                throw new Error('User profile not found after login');
            }

            const profile: User = {
                id: userData.id,
                email: userData.email,
                full_name: userData.full_name || `${userData.first_name} ${userData.last_name}`,
                department: userData.department || 'General',
                ward: userData.ward || 'General',
                role: userData.role,
            };

            setUser(profile);
            await SecureStore.setItemAsync('user_session', JSON.stringify(profile));
            await SecureStore.setItemAsync('access_token', token);
        } catch (error) {
            console.error("Login Error:", error);
            throw error;
        }
    };

    const signOut = async () => {
        setUser(null);
        await SecureStore.deleteItemAsync('user_session');
        await SecureStore.deleteItemAsync('access_token');
    };

    return (
        <AuthContext.Provider value={{ user, isLoading, signIn, signOut }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
