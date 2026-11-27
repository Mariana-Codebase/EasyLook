import { Router } from 'express';
import { authenticate, currentUser } from '../../middleware/auth';
import { authRateLimit } from '../../middleware/rate-limit';
import { loginBodySchema, registerBodySchema, updateMeBodySchema } from './auth.schemas';
import * as authService from './auth.service';

export const authRouter = Router();

authRouter.post('/register', authRateLimit, async (req, res) => {
  const body = registerBodySchema.parse(req.body);
  res.status(201).json(await authService.register(body));
});

authRouter.post('/login', authRateLimit, async (req, res) => {
  const body = loginBodySchema.parse(req.body);
  res.json(await authService.login(body));
});

authRouter.get('/me', authenticate, async (req, res) => {
  const user = await authService.getUserById(currentUser(req).id);
  res.json(authService.toUserResponse(user));
});

authRouter.patch('/me', authenticate, async (req, res) => {
  const body = updateMeBodySchema.parse(req.body);
  res.json(await authService.updateMe(currentUser(req).id, body));
});
