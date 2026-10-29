import { config } from 'dotenv';

// Neon writes .env.local when .env does not exist. Existing process variables
// (including Netlify configuration) always take precedence over local files.
config({ path: ['.env.local', '.env'], quiet: true });
