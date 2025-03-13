import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../../contexts/AuthContext';
import Register from '../../pages/Register';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockedNavigate,
}));

const renderRegister = () => {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <Register />
      </AuthProvider>
    </BrowserRouter>
  );
};

describe('Register Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders registration form', () => {
    renderRegister();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /register/i })).toBeInTheDocument();
  });

  it('validates password requirements', async () => {
    renderRegister();

    const testCases = [
      {
        password: 'short',
        error: 'Password must be at least 8 characters long'
      },
      {
        password: 'nouppercase123!',
        error: 'Password must contain at least one uppercase letter'
      },
      {
        password: 'NOLOWERCASE123!',
        error: 'Password must contain at least one lowercase letter'
      },
      {
        password: 'NoNumbers!',
        error: 'Password must contain at least one number'
      },
      {
        password: 'NoSpecialChar123',
        error: 'Password must contain at least one special character'
      }
    ];

    for (const testCase of testCases) {
      fireEvent.change(screen.getByLabelText(/^password$/i), {
        target: { value: testCase.password }
      });
      fireEvent.change(screen.getByLabelText(/confirm password/i), {
        target: { value: testCase.password }
      });
      fireEvent.click(screen.getByRole('button', { name: /register/i }));

      await waitFor(() => {
        expect(screen.getByText(new RegExp(testCase.error, 'i'))).toBeInTheDocument();
      });
    }
  });

  it('validates password match', async () => {
    renderRegister();

    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: 'ValidPass123!' }
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: 'DifferentPass123!' }
    });
    fireEvent.click(screen.getByRole('button', { name: /register/i }));

    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    });
  });

  it('handles successful registration', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: { message: 'Registration successful! Please check your email for verification.' }
    });

    renderRegister();

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'test@example.com' }
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: 'ValidPass123!' }
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: 'ValidPass123!' }
    });

    fireEvent.click(screen.getByRole('button', { name: /register/i }));

    await waitFor(() => {
      expect(screen.getByText(/registration successful/i)).toBeInTheDocument();
    });

    // Wait for navigation
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith('/login');
    }, { timeout: 3500 });
  });

  it('handles registration error', async () => {
    mockedAxios.post.mockRejectedValueOnce({
      response: { data: { error: 'Email already registered' } }
    });

    renderRegister();

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'existing@example.com' }
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: 'ValidPass123!' }
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: 'ValidPass123!' }
    });

    fireEvent.click(screen.getByRole('button', { name: /register/i }));

    await waitFor(() => {
      expect(screen.getByText(/email already registered/i)).toBeInTheDocument();
    });
  });

  it('disables form during submission', async () => {
    mockedAxios.post.mockImplementationOnce(() => 
      new Promise(resolve => setTimeout(resolve, 1000))
    );

    renderRegister();

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'test@example.com' }
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: 'ValidPass123!' }
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: 'ValidPass123!' }
    });

    fireEvent.click(screen.getByRole('button', { name: /register/i }));

    expect(screen.getByLabelText(/email address/i)).toBeDisabled();
    expect(screen.getByLabelText(/^password$/i)).toBeDisabled();
    expect(screen.getByLabelText(/confirm password/i)).toBeDisabled();
    expect(screen.getByRole('button', { name: /register/i })).toBeDisabled();
  });
});
