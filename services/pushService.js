import webpush from 'web-push';
import DataBase from '../config/Database.js';

const db = () => DataBase.getInstance();

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
        'mailto:desarrollo.native.code@gmail.com',
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
    );
}

export async function sendPushToAll(titulo, body, url = '/dashboard') {
    try {
        const subs = await db().ejecutarQuery(`SELECT * FROM push_subscriptions`, []);
        if (!subs?.length) return;

        const payload = JSON.stringify({ titulo, body, icon: '/logonuevoblanco.png', url });
        await Promise.allSettled(
            subs.map(sub =>
                webpush.sendNotification(
                    { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                    payload
                ).catch(async (err) => {
                    if (err.statusCode === 410 || err.statusCode === 404) {
                        await db().ejecutarQuery(`DELETE FROM push_subscriptions WHERE id = ?`, [sub.id]);
                    }
                })
            )
        );
    } catch (e) {
        console.error('[PUSH] Error enviando notificación:', e.message);
    }
}
