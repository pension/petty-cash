import * as fs from 'fs';

import * as dotenv from 'dotenv';
import { parseEnv, port, z } from 'znv';

export const environmentSchema = {
  APP_ENV: z.string().default('development'),
  PORT: port().default(4000),
  SHORT_DOMAIN: z.string().default('mpo.mv'),
};

export const { APP_ENV, PORT, SHORT_DOMAIN } = parseEnv(
  dotenv.parse(fs.readFileSync('.env')),
  environmentSchema,
);
