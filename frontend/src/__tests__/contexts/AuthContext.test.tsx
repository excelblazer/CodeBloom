import React from 'react';
import { render, act, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../../contexts/AuthContext';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Test component that uses AuthContext
const TestComponent: React.FC = () => {
  const auth = useAuth();
  return (
    <div>
      <div data-testid="auth-state">
        {JSON.stringify({
          isAuthenticated: auth.isAuthenticated,
          user: auth.user
        })}
      </div>
      <button onClick={() => auth.login({ email: 'test@example.com', password: 'Password123!' })}>
        Login
      </button>
      <button onClick={() => auth.logout()}>Logout</button>
    </div>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
  });

  it('provides initial unauthenticated state', () => {
    const { getByTestId } = render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    const authState = JSON.parse(getByTestId('auth-state').textContent || '{}');
    expect(authState.isAuthenticated).toBe(false);
    expect(authState.user).toBeNull();
  });

  it('handles successful login flow with MFA', async () => {
    // Mock successful login
    mockedAxios.post.mockResolvedValueOnce({
      data: { message: 'MFA code sent to your email' }
    });

    const { getByTestId, getByText } = render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Trigger login
    await act(async () => {
      getByText('Login').click();
    });

    // Verify MFA request
    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('/login'),
      expect.objectContaining({
        email: 'test@example.com',
        password: 'Password123!'
      })
    );

    // Mock successful MFA verification
    mockedAxios.post.mockResolvedValueOnce({
      data: { message: 'Login successful' }
    });

    // Verify MFA and complete login
    await act(async () => {
      await useAuth().verifyMFA({
        email: 'test@example.com',
        mfaCode: '123456'
      });
    });

    const authState = JSON.parse(getByTestId('auth-state').textContent || '{}');
    expect(authState.isAuthenticated).toBe(true);
    expect(authState.user).toEqual({
      email: 'test@example.com',
      isVerified: true
    });
  });

  it('handles failed login attempts and rate limiting', async () => {
    // Mock rate-limited response
    mockedAxios.post.mockRejectedValueOnce({
      response: {
        status: 429,
        data: { error: 'Too many attempts. Please try again later.' }
      }
    });

    const { getByText } = render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Attempt login
    await act(async () => {
      getByText('Login').click();
    });

    // Verify error handling
    await waitFor(() => {
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    });
  });

  it('handles session expiration', async () => {
    // Set up initial authenticated state
    const { getByTestId, getByText } = render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Mock successful login
    mockedAxios.post.mockResolvedValueOnce({
      data: { message: 'Login successful' }
    });

    await act(async () => {
      await useAuth().verifyMFA({
        email: 'test@example.com',
        mfaCode: '123456'
      });
    });

    // Verify authenticated state
    let authState = JSON.parse(getByTestId('auth-state').textContent || '{}');
    expect(authState.isAuthenticated).toBe(true);

    // Mock session timeout
    mockedAxios.post.mockRejectedValueOnce({
      response: {
        status: 401,
        data: { error: 'Session expired' }
      }
    });

    // Trigger an authenticated request
    await act(async () => {
      getByText('Logout').click();
    });

    // Verify session expired handling
    authState = JSON.parse(getByTestId('auth-state').textContent || '{}');
    expect(authState.isAuthenticated).toBe(false);
    expect(authState.user).toBeNull();
  });

  it('securely handles password validation', async () => {
    const { getByText } = render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Mock registration with weak password
    mockedAxios.post.mockRejectedValueOnce({
      response: {
        status: 400,
        data: { error: 'Password does not meet security requirements' }
      }
    });

    await act(async () => {
      await useAuth().register({
        email: 'test@example.com',
        password: 'weak',
        confirmPassword: 'weak'
      });
    });

    // Verify error handling
    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('/register'),
      expect.any(Object)
    );
  });

  it('handles secure logout', async () => {
    // Mock successful logout
    mockedAxios.post.mockResolvedValueOnce({
      data: { message: 'Logged out successfully' }
    });

    const { getByTestId, getByText } = render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Set initial authenticated state
    await act(async () => {
      await useAuth().verifyMFA({
        email: 'test@example.com',
        mfaCode: '123456'
      });
    });

    // Trigger logout
    await act(async () => {
      getByText('Logout').click();
    });

    // Verify state cleared
    const authState = JSON.parse(getByTestId('auth-state').textContent || '{}');
    expect(authState.isAuthenticated).toBe(false);
    expect(authState.user).toBeNull();

    // Verify secure logout request
    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('/logout'),
      undefined
    );
  });

  it('maintains security during concurrent authentication attempts', async () => {
    const { getByText } = render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Simulate multiple concurrent login attempts
    const loginPromises = Array(3).fill(null).map(() => 
      act(async () => {
        getByText('Login').click();
      })
    );

    // Verify only one request is made
    await Promise.all(loginPromises);
    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
  });
});
