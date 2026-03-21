import React, { createContext, useContext, useState, useEffect } from 'react';

interface AppUser {
    id: string;
    email: string;
    role: string;
    tenant_id?: string;
}

interface AuthContextType {
    user: AppUser | null;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<AppUser | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Mocking a loaded user after 1s. Change role/tenant_id to test edge cases!
        setTimeout(() => {
            setUser({
                id: '123',
                email: 'ahmed@gmail.com',
                role: 'master_admin',
                tenant_id: 't-123'
            });
            setLoading(false);
        }, 1000);
    }, []);

    return (
        <AuthContext.Provider value={{ user, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
