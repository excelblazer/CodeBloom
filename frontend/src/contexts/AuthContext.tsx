import React, { createContext, useContext, useState } from 'react';
import axios from 'axios';
import { User, LoginCredentials, RegisterCredentials, MFAVerification, AuthContextType, AuthResponse } from '../types/auth';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);

  const login = async (credentials: LoginCredentials): Promise<AuthResponse> => {
    try {
      const response = await axios.post(`${API_URL}/login`, credentials);
      return response.data;
    } catch (error: any) {
      if (error.response?.data?.error) {
        return { message: '', error: error.response.data.error };
      }
      return { message: '', error: 'Login failed. Please try again.' };
    }
  };

  const register = async (credentials: RegisterCredentials): Promise<AuthResponse> => {
    try {
      const { confirmPassword, ...registerData } = credentials;
      const response = await axios.post(`${API_URL}/register`, registerData);
      return response.data;
    } catch (error: any) {
      if (error.response?.data?.error) {
        return { message: '', error: error.response.data.error };
      }
      return { message: '', error: 'Registration failed. Please try again.' };
    }
  };

  const verifyMFA = async (verification: MFAVerification): Promise<AuthResponse> => {
    try {
      const response = await axios.post(`${API_URL}/verify-mfa`, {
        email: verification.email,
        mfa_code: verification.mfaCode
      });
      if (response.data.message === 'Login successful') {
        setUser({ email: verification.email, isVerified: true });
      }
      return response.data;
    } catch (error: any) {
      if (error.response?.data?.error) {
        return { message: '', error: error.response.data.error };
      }
      return { message: '', error: 'MFA verification failed. Please try again.' };
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await axios.post(`${API_URL}/logout`);
      setUser(null);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    login,
    register,
    verifyMFA,
    logout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
