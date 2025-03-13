import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../../contexts/AuthContext';
import Chat from '../../pages/Chat';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockedNavigate,
}));

// Mock AuthContext with authenticated user
const mockAuthContext = {
  user: { email: 'test@example.com', isVerified: true },
  isAuthenticated: true,
  login: jest.fn(),
  register: jest.fn(),
  verifyMFA: jest.fn(),
  logout: jest.fn(),
};

jest.mock('../../contexts/AuthContext', () => ({
  ...jest.requireActual('../../contexts/AuthContext'),
  useAuth: () => mockAuthContext,
}));

const renderChat = () => {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <Chat />
      </AuthProvider>
    </BrowserRouter>
  );
};

describe('Chat Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders chat interface', () => {
    renderChat();
    expect(screen.getByPlaceholderText(/type your message/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
    expect(screen.getByText(/test@example.com/)).toBeInTheDocument();
  });

  it('handles message sending and receiving', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: { response: 'AI response to your message' }
    });

    renderChat();

    const messageInput = screen.getByPlaceholderText(/type your message/i);
    const sendButton = screen.getByRole('button', { name: /send/i });

    fireEvent.change(messageInput, {
      target: { value: 'Test message' }
    });
    fireEvent.click(sendButton);

    // Check if user message appears
    expect(screen.getByText('Test message')).toBeInTheDocument();

    // Wait for AI response
    await waitFor(() => {
      expect(screen.getByText('AI response to your message')).toBeInTheDocument();
    });

    // Verify input is cleared
    expect(messageInput).toHaveValue('');
  });

  it('handles API errors gracefully', async () => {
    mockedAxios.post.mockRejectedValueOnce({
      response: { data: { error: 'Error processing request' } }
    });

    renderChat();

    fireEvent.change(screen.getByPlaceholderText(/type your message/i), {
      target: { value: 'Test message' }
    });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(screen.getByText(/sorry, there was an error/i)).toBeInTheDocument();
    });
  });

  it('prevents sending empty messages', () => {
    renderChat();

    const sendButton = screen.getByRole('button', { name: /send/i });
    expect(sendButton).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText(/type your message/i), {
      target: { value: '   ' }
    });
    expect(sendButton).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText(/type your message/i), {
      target: { value: 'Valid message' }
    });
    expect(sendButton).not.toBeDisabled();
  });

  it('handles logout', async () => {
    mockedAxios.post.mockResolvedValueOnce({});
    renderChat();

    const logoutButton = screen.getByRole('button', { name: /logout/i });
    fireEvent.click(logoutButton);

    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith('/login');
    });
  });

  it('disables input during message processing', async () => {
    mockedAxios.post.mockImplementationOnce(() =>
      new Promise(resolve => setTimeout(() => resolve({ data: { response: 'AI response' } }), 1000))
    );

    renderChat();

    const messageInput = screen.getByPlaceholderText(/type your message/i);
    const sendButton = screen.getByRole('button', { name: /send/i });

    fireEvent.change(messageInput, {
      target: { value: 'Test message' }
    });
    fireEvent.click(sendButton);

    expect(messageInput).toBeDisabled();
    expect(sendButton).toBeDisabled();

    await waitFor(() => {
      expect(messageInput).not.toBeDisabled();
      expect(sendButton).not.toBeDisabled();
    });
  });

  it('maintains message history', async () => {
    const messages = [
      { message: 'First message', response: 'First AI response' },
      { message: 'Second message', response: 'Second AI response' }
    ];

    for (const msg of messages) {
      mockedAxios.post.mockResolvedValueOnce({
        data: { response: msg.response }
      });

      fireEvent.change(screen.getByPlaceholderText(/type your message/i), {
        target: { value: msg.message }
      });
      fireEvent.click(screen.getByRole('button', { name: /send/i }));

      await waitFor(() => {
        expect(screen.getByText(msg.message)).toBeInTheDocument();
        expect(screen.getByText(msg.response)).toBeInTheDocument();
      });
    }

    // Verify all messages are still visible
    messages.forEach(msg => {
      expect(screen.getByText(msg.message)).toBeInTheDocument();
      expect(screen.getByText(msg.response)).toBeInTheDocument();
    });
  });

  it('handles session timeout', async () => {
    mockedAxios.post.mockRejectedValueOnce({
      response: { status: 401, data: { error: 'Session expired' } }
    });

    renderChat();

    fireEvent.change(screen.getByPlaceholderText(/type your message/i), {
      target: { value: 'Test message' }
    });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith('/login');
    });
  });
});
