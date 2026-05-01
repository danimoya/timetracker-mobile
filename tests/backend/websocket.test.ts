import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createServer, Server } from 'http';
import WebSocket from 'ws';
import jwt from 'jsonwebtoken';
import { WebSocketManager, initializeWebSocket } from '../../server/websocket';

describe('WebSocket Manager', () => {
  let server: Server;
  let wsManager: WebSocketManager;
  let port: number;

  beforeEach(async () => {
    // Create HTTP server for WebSocket testing
    server = createServer();
    port = 3002 + Math.floor(Math.random() * 1000);
    
    return new Promise<void>((resolve) => {
      server.listen(port, () => {
        wsManager = initializeWebSocket(server);
        resolve();
      });
    });
  });

  afterEach((done) => {
    if (server) {
      server.close(() => {
        done();
      });
    } else {
      done();
    }
  });

  describe('WebSocket Connection', () => {
    it('accepts valid JWT token connections', (done) => {
      const token = jwt.sign({ userId: 1 }, 'fallback-secret');
      const ws = new WebSocket(`ws://localhost:${port}/ws?token=${token}`);
      
      ws.on('open', () => {
        expect(ws.readyState).toBe(WebSocket.OPEN);
        ws.close();
        done();
      });

      ws.on('error', (error) => {
        done(error);
      });
    });

    it('rejects connections without valid token', (done) => {
      const ws = new WebSocket(`ws://localhost:${port}/ws`);
      
      ws.on('error', () => {
        // Expected to fail authentication
        done();
      });

      ws.on('open', () => {
        ws.close();
        done(new Error('Should not connect without token'));
      });
    });

    it('rejects connections with invalid token', (done) => {
      const ws = new WebSocket(`ws://localhost:${port}/ws?token=invalid`);
      
      ws.on('error', () => {
        // Expected to fail authentication
        done();
      });

      ws.on('open', () => {
        ws.close();
        done(new Error('Should not connect with invalid token'));
      });
    });
  });

  describe('Message Handling', () => {
    it('responds to ping messages', (done) => {
      const token = jwt.sign({ userId: 1 }, 'fallback-secret');
      const ws = new WebSocket(`ws://localhost:${port}/ws?token=${token}`);
      
      ws.on('open', () => {
        const pingMessage = {
          type: 'ping',
          timestamp: new Date().toISOString()
        };
        ws.send(JSON.stringify(pingMessage));
      });

      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'ping' && message.data?.pong) {
          ws.close();
          done();
        }
      });

      ws.on('error', done);
    });

    it('handles invalid JSON messages gracefully', (done) => {
      const token = jwt.sign({ userId: 1 }, 'fallback-secret');
      const ws = new WebSocket(`ws://localhost:${port}/ws?token=${token}`);
      
      ws.on('open', () => {
        ws.send('invalid json');
        // Should not crash, connection should remain open
        setTimeout(() => {
          expect(ws.readyState).toBe(WebSocket.OPEN);
          ws.close();
          done();
        }, 100);
      });

      ws.on('error', done);
    });
  });

  describe('User Management', () => {
    it('tracks connected users correctly', (done) => {
      const token = jwt.sign({ userId: 1 }, 'fallback-secret');
      const ws = new WebSocket(`ws://localhost:${port}/ws?token=${token}`);
      
      ws.on('open', () => {
        setTimeout(() => {
          const connectedUsers = wsManager.getConnectedUsers();
          expect(connectedUsers).toContain(1);
          expect(wsManager.getUserConnectionCount(1)).toBe(1);
          ws.close();
          done();
        }, 100);
      });

      ws.on('error', done);
    });

    it('handles multiple connections from same user', (done) => {
      const token = jwt.sign({ userId: 1 }, 'fallback-secret');
      const ws1 = new WebSocket(`ws://localhost:${port}/ws?token=${token}`);
      const ws2 = new WebSocket(`ws://localhost:${port}/ws?token=${token}`);
      
      let connectionsOpened = 0;
      
      const onOpen = () => {
        connectionsOpened++;
        if (connectionsOpened === 2) {
          setTimeout(() => {
            expect(wsManager.getUserConnectionCount(1)).toBe(2);
            ws1.close();
            ws2.close();
            done();
          }, 100);
        }
      };

      ws1.on('open', onOpen);
      ws2.on('open', onOpen);
      ws1.on('error', done);
      ws2.on('error', done);
    });

    it('removes users when connections close', (done) => {
      const token = jwt.sign({ userId: 1 }, 'fallback-secret');
      const ws = new WebSocket(`ws://localhost:${port}/ws?token=${token}`);
      
      ws.on('open', () => {
        setTimeout(() => {
          expect(wsManager.getUserConnectionCount(1)).toBe(1);
          ws.close();
        }, 50);
      });

      ws.on('close', () => {
        setTimeout(() => {
          expect(wsManager.getUserConnectionCount(1)).toBe(0);
          expect(wsManager.getConnectedUsers()).not.toContain(1);
          done();
        }, 50);
      });

      ws.on('error', done);
    });
  });

  describe('Broadcasting', () => {
    it('sends timer notifications to specific users', (done) => {
      const token = jwt.sign({ userId: 1 }, 'fallback-secret');
      const ws = new WebSocket(`ws://localhost:${port}/ws?token=${token}`);
      
      ws.on('open', () => {
        setTimeout(() => {
          wsManager.notifyTimerStart(1, { timerId: 123, customer: 'Test' });
        }, 50);
      });

      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'timer_start') {
          expect(message.data.timerId).toBe(123);
          expect(message.data.customer).toBe('Test');
          ws.close();
          done();
        }
      });

      ws.on('error', done);
    });

    it('sends dashboard updates to users', (done) => {
      const token = jwt.sign({ userId: 1 }, 'fallback-secret');
      const ws = new WebSocket(`ws://localhost:${port}/ws?token=${token}`);
      
      ws.on('open', () => {
        setTimeout(() => {
          wsManager.notifyDashboardUpdate(1, { totalMinutes: 240 });
        }, 50);
      });

      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'dashboard_update') {
          expect(message.data.totalMinutes).toBe(240);
          ws.close();
          done();
        }
      });

      ws.on('error', done);
    });

    it('broadcasts notifications to all connected users', (done) => {
      const token1 = jwt.sign({ userId: 1 }, 'fallback-secret');
      const token2 = jwt.sign({ userId: 2 }, 'fallback-secret');
      const ws1 = new WebSocket(`ws://localhost:${port}/ws?token=${token1}`);
      const ws2 = new WebSocket(`ws://localhost:${port}/ws?token=${token2}`);
      
      let messagesReceived = 0;
      
      const onMessage = (data: Buffer) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'notification' && message.data.broadcast) {
          messagesReceived++;
          if (messagesReceived === 2) {
            ws1.close();
            ws2.close();
            done();
          }
        }
      };

      let connectionsOpened = 0;
      const onOpen = () => {
        connectionsOpened++;
        if (connectionsOpened === 2) {
          setTimeout(() => {
            wsManager.broadcastToAll({
              type: 'notification',
              data: { broadcast: true, message: 'System update' },
              timestamp: new Date().toISOString()
            });
          }, 50);
        }
      };

      ws1.on('open', onOpen);
      ws2.on('open', onOpen);
      ws1.on('message', onMessage);
      ws2.on('message', onMessage);
      ws1.on('error', done);
      ws2.on('error', done);
    });
  });

  describe('Heartbeat System', () => {
    it('maintains connection health with heartbeat', (done) => {
      const token = jwt.sign({ userId: 1 }, 'fallback-secret');
      const ws = new WebSocket(`ws://localhost:${port}/ws?token=${token}`);
      
      ws.on('open', () => {
        // Test that connection stays alive through heartbeat system
        setTimeout(() => {
          expect(ws.readyState).toBe(WebSocket.OPEN);
          ws.close();
          done();
        }, 200);
      });

      ws.on('ping', () => {
        // Respond to ping to maintain connection
        ws.pong();
      });

      ws.on('error', done);
    });
  });

  describe('Timer Notifications', () => {
    it('sends timer start notifications', (done) => {
      const token = jwt.sign({ userId: 1 }, 'fallback-secret');
      const ws = new WebSocket(`ws://localhost:${port}/ws?token=${token}`);
      
      ws.on('open', () => {
        wsManager.notifyTimerStart(1, {
          id: 1,
          customerId: 123,
          customerName: 'Test Customer',
          isBreak: false
        });
      });

      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'timer_start') {
          expect(message.data.id).toBe(1);
          expect(message.data.customerName).toBe('Test Customer');
          ws.close();
          done();
        }
      });

      ws.on('error', done);
    });

    it('sends timer stop notifications', (done) => {
      const token = jwt.sign({ userId: 1 }, 'fallback-secret');
      const ws = new WebSocket(`ws://localhost:${port}/ws?token=${token}`);
      
      ws.on('open', () => {
        wsManager.notifyTimerStop(1, {
          id: 1,
          duration: 3600,
          completedAt: new Date().toISOString()
        });
      });

      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'timer_stop') {
          expect(message.data.id).toBe(1);
          expect(message.data.duration).toBe(3600);
          ws.close();
          done();
        }
      });

      ws.on('error', done);
    });

    it('sends timer update notifications', (done) => {
      const token = jwt.sign({ userId: 1 }, 'fallback-secret');
      const ws = new WebSocket(`ws://localhost:${port}/ws?token=${token}`);
      
      ws.on('open', () => {
        wsManager.notifyTimerUpdate(1, {
          id: 1,
          elapsed: 1800,
          isRunning: true
        });
      });

      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'timer_update') {
          expect(message.data.elapsed).toBe(1800);
          expect(message.data.isRunning).toBe(true);
          ws.close();
          done();
        }
      });

      ws.on('error', done);
    });
  });

  describe('Custom Notifications', () => {
    it('sends productivity insights notifications', (done) => {
      const token = jwt.sign({ userId: 1 }, 'fallback-secret');
      const ws = new WebSocket(`ws://localhost:${port}/ws?token=${token}`);
      
      ws.on('open', () => {
        wsManager.sendNotification(1, {
          type: 'productivity_insight',
          title: 'Great Progress!',
          message: 'You have completed 8 hours of focused work today.',
          priority: 'success'
        });
      });

      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'notification' && message.data.type === 'productivity_insight') {
          expect(message.data.title).toBe('Great Progress!');
          expect(message.data.priority).toBe('success');
          ws.close();
          done();
        }
      });

      ws.on('error', done);
    });
  });
});