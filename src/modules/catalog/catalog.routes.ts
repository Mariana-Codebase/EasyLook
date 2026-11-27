import { Router } from 'express';
import { idParamSchema } from '../../lib/schemas';
import { authenticate, isAdmin, optionalAuth, requireRole } from '../../middleware/auth';
import {
  createGarmentBodySchema,
  createOccasionBodySchema,
  createStoreBodySchema,
  garmentListQuerySchema,
  occasionListQuerySchema,
  storeListQuerySchema,
  updateGarmentBodySchema,
  updateOccasionBodySchema,
  updateStoreBodySchema,
} from './catalog.schemas';
import * as garmentsService from './garments.service';
import * as occasionsService from './occasions.service';
import * as storesService from './stores.service';

const adminOnly = [authenticate, requireRole('admin')];
const storeParams = idParamSchema('storeId');
const garmentParams = idParamSchema('garmentId');
const occasionParams = idParamSchema('occasionId');

export const storesRouter = Router();

storesRouter.get('/', optionalAuth, async (req, res) => {
  const query = storeListQuerySchema.parse(req.query);
  res.json(await storesService.listStores(query, isAdmin(req)));
});

storesRouter.get('/:storeId', optionalAuth, async (req, res) => {
  const { storeId } = storeParams.parse(req.params);
  res.json(await storesService.getStore(storeId, isAdmin(req)));
});

storesRouter.post('/', ...adminOnly, async (req, res) => {
  const body = createStoreBodySchema.parse(req.body);
  res.status(201).json(await storesService.createStore(body));
});

storesRouter.patch('/:storeId', ...adminOnly, async (req, res) => {
  const { storeId } = storeParams.parse(req.params);
  const body = updateStoreBodySchema.parse(req.body);
  res.json(await storesService.updateStore(storeId, body));
});

export const occasionsRouter = Router();

occasionsRouter.get('/', optionalAuth, async (req, res) => {
  const query = occasionListQuerySchema.parse(req.query);
  res.json({ data: await occasionsService.listOccasions(isAdmin(req) && query.includeInactive === true) });
});

occasionsRouter.post('/', ...adminOnly, async (req, res) => {
  const body = createOccasionBodySchema.parse(req.body);
  res.status(201).json(await occasionsService.createOccasion(body));
});

occasionsRouter.patch('/:occasionId', ...adminOnly, async (req, res) => {
  const { occasionId } = occasionParams.parse(req.params);
  const body = updateOccasionBodySchema.parse(req.body);
  res.json(await occasionsService.updateOccasion(occasionId, body));
});

export const garmentsRouter = Router();

garmentsRouter.get('/', optionalAuth, async (req, res) => {
  const query = garmentListQuerySchema.parse(req.query);
  res.json(await garmentsService.listGarments(query, isAdmin(req)));
});

garmentsRouter.get('/:garmentId', optionalAuth, async (req, res) => {
  const { garmentId } = garmentParams.parse(req.params);
  res.json(await garmentsService.getGarment(garmentId, isAdmin(req)));
});

garmentsRouter.post('/', ...adminOnly, async (req, res) => {
  const body = createGarmentBodySchema.parse(req.body);
  res.status(201).json(await garmentsService.createGarment(body));
});

garmentsRouter.patch('/:garmentId', ...adminOnly, async (req, res) => {
  const { garmentId } = garmentParams.parse(req.params);
  const body = updateGarmentBodySchema.parse(req.body);
  res.json(await garmentsService.updateGarment(garmentId, body));
});

garmentsRouter.delete('/:garmentId', ...adminOnly, async (req, res) => {
  const { garmentId } = garmentParams.parse(req.params);
  await garmentsService.deactivateGarment(garmentId);
  res.status(204).end();
});
