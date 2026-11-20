import Joi from 'joi';
import { SecurityOutcome } from '../domain/model/SecurityEvent.js';

export const schemas = {
  search: Joi.object({
    limit: Joi.number().integer().min(1).max(100).default(50),
    offset: Joi.number().integer().min(0).default(0),
    outcome: Joi.string().valid(...Object.values(SecurityOutcome)),
    actorId: Joi.string().pattern(/^USR-[0-9]{5,}$/i),
    from: Joi.date().iso(),
    to: Joi.date().iso(),
  }).unknown(false),
};
