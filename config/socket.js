import { Server } from 'socket.io';

let io = null;

export function initSocket(httpServer, allowedOrigins) {
    io = new Server(httpServer, {
        cors: {
            origin: allowedOrigins,
            methods: ['GET', 'POST'],
            credentials: true,
        },
        transports: ['websocket', 'polling'],
    });

    io.on('connection', (socket) => {
        console.log(`[SOCKET] Cliente conectado: ${socket.id}`);
        socket.on('disconnect', () => {
            console.log(`[SOCKET] Cliente desconectado: ${socket.id}`);
        });
    });

    return io;
}

export function getIO() {
    return io;
}

// Emite un evento de actualización a todos los clientes conectados
export function emitUpdate(event, payload = {}) {
    if (io) io.emit(event, payload);
}
