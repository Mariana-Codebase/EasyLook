import { Router } from 'express';
import { uuidSchema, z } from '../../lib/schemas';
import { authenticate, currentUser } from '../../middleware/auth';
import {
  addItemBodySchema,
  applyRecommendationBodySchema,
  createOutfitBodySchema,
  finalizeBodySchema,
  outfitListQuerySchema,
  updateOutfitBodySchema,
} from './outfit.schemas';
import * as outfitService from './outfit.service';

const outfitParams = z.object({ outfitId: uuidSchema });
const itemParams = z.object({ outfitId: uuidSchema, garmentId: uuidSchema });

export const outfitsRouter = Router();

outfitsRouter.use(authenticate);

outfitsRouter.post('/', async (req, res) => {
  const body = createOutfitBodySchema.parse(req.body);
  res.status(201).json(await outfitService.createOutfit(currentUser(req).id, body));
});

outfitsRouter.get('/', async (req, res) => {
  const query = outfitListQuerySchema.parse(req.query);
  res.json(await outfitService.listOutfits(currentUser(req).id, query));
});

outfitsRouter.get('/:outfitId', async (req, res) => {
  const { outfitId } = outfitParams.parse(req.params);
  res.json(await outfitService.getOutfit(currentUser(req).id, outfitId));
});

outfitsRouter.patch('/:outfitId', async (req, res) => {
  const { outfitId } = outfitParams.parse(req.params);
  const body = updateOutfitBodySchema.parse(req.body);
  res.json(await outfitService.updateOutfit(currentUser(req).id, outfitId, body));
});

outfitsRouter.delete('/:outfitId', async (req, res) => {
  const { outfitId } = outfitParams.parse(req.params);
  await outfitService.deleteOutfit(currentUser(req).id, outfitId);
  res.status(204).end();
});

outfitsRouter.post('/:outfitId/items', async (req, res) => {
  const { outfitId } = outfitParams.parse(req.params);
  const { garmentId } = addItemBodySchema.parse(req.body);
  res.json(await outfitService.addItem(currentUser(req).id, outfitId, garmentId));
});

outfitsRouter.delete('/:outfitId/items/:garmentId', async (req, res) => {
  const { outfitId, garmentId } = itemParams.parse(req.params);
  res.json(await outfitService.removeItem(currentUser(req).id, outfitId, garmentId));
});

outfitsRouter.post('/:outfitId/finalize', async (req, res) => {
  const { outfitId } = outfitParams.parse(req.params);
  const { allowOverBudget } = finalizeBodySchema.parse(req.body ?? {});
  res.json(await outfitService.finalizeOutfit(currentUser(req).id, outfitId, allowOverBudget));
});

outfitsRouter.post('/:outfitId/apply-recommendation', async (req, res) => {
  const { outfitId } = outfitParams.parse(req.params);
  const body = applyRecommendationBodySchema.parse(req.body);
  res.json(await outfitService.applyRecommendation(currentUser(req).id, outfitId, body));
});
