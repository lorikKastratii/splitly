import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SOCKET_URL = 'https://splitly-production-72fd.up.railway.app';

class SocketClient {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  // Persist group rooms so they re-join on every connect/reconnect
  private joinedGroups: Set<string> = new Set();

  // Buffer listeners registered before socket is initialized
  private storedListeners: Map<string, Set<(...args: any[]) => void>> = new Map();

  private applyStoredListeners() {
    if (!this.socket) return;
    this.storedListeners.forEach((callbacks, event) => {
      callbacks.forEach(cb => this.socket!.on(event, cb));
    });
  }

  async connect() {
    const token = await AsyncStorage.getItem('auth_token');

    if (!token) {
      console.log('No auth token found, skipping socket connection');
      return;
    }

    if (this.socket?.connected) {
      console.log('Socket already connected');
      return;
    }

    // Disconnect stale socket before creating a new one
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    // Apply listeners that were registered before connect() was called
    this.applyStoredListeners();

    this.socket.on('connect', () => {
      console.log('Socket connected');
      this.reconnectAttempts = 0;
      // Re-join all group rooms on every connect/reconnect
      this.joinedGroups.forEach(groupId => {
        this.socket!.emit('join-group', groupId);
      });
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      this.reconnectAttempts++;

      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.log('Max reconnect attempts reached, giving up');
        this.disconnect();
      }
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.joinedGroups.clear();
    this.storedListeners.clear();
  }

  joinGroup(groupId: string) {
    this.joinedGroups.add(groupId);
    // Join immediately if connected; otherwise handled on next connect event
    if (this.socket?.connected) {
      this.socket.emit('join-group', groupId);
    }
  }

  leaveGroup(groupId: string) {
    this.joinedGroups.delete(groupId);
    if (this.socket?.connected) {
      this.socket.emit('leave-group', groupId);
    }
  }

  on(event: string, callback: (...args: any[]) => void) {
    // Store the listener so it survives reconnects and pre-connect calls
    if (!this.storedListeners.has(event)) {
      this.storedListeners.set(event, new Set());
    }
    this.storedListeners.get(event)!.add(callback);

    // Also register directly if socket already exists
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event: string, callback?: (...args: any[]) => void) {
    if (callback) {
      this.storedListeners.get(event)?.delete(callback);
    } else {
      this.storedListeners.delete(event);
    }
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  emit(event: string, ...args: any[]) {
    if (this.socket?.connected) {
      this.socket.emit(event, ...args);
    }
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

export const socketClient = new SocketClient();
