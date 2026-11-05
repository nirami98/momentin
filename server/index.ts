import './env.js';
import { createApp } from './app.js';
const port = Number(process.env.PORT ?? 3001);
const clock = !process.env.NETLIFY && process.env.DEV_CLOCK_ISO ? new Date(process.env.DEV_CLOCK_ISO) : undefined;
if (clock && Number.isNaN(clock.getTime())) throw new Error('DEV_CLOCK_ISO must be a valid ISO timestamp.');
createApp({ now: clock ? () => clock : undefined }).listen(port, '127.0.0.1', () => console.log(`Momentin API: http://127.0.0.1:${port}`));
