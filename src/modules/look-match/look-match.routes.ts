import { Router } from 'express';
import { optionalAuth } from '../../middleware/auth';
import { recommendationRateLimit } from '../../middleware/rate-limit';
import { lookMatchRequestSchema } from './look-match.schemas';
import { recommendLooks } from './look-match.service';

export const recommendationsRouter = Router();

recommendationsRouter.post('/look-match', recommendationRateLimit, optionalAuth, async (req, res) => {
  const body = lookMatchRequestSchema.parse(req.body);
  res.json(await recommendLooks(body, req.user?.id));
});
