import { z } from 'zod';
import { sendError } from '../utils/response';

const registrationSchema = z.object({
  fullName: z.string().min(3).max(50),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['user', 'admin']).optional(),
  deviceName: z.string().optional()
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  deviceName: z.string().optional()
});

const blogSchema = z.object({
  title: z.string().min(1).max(200),
  slug: z.string().min(1).toLowerCase().transform(s => s.replace(/\s+/g, '-')),
  excerpt: z.string().max(500),
  content: z.string().min(1),
  coverImage: z.string().url().optional().or(z.literal('')),
  category: z.enum(['pdf-tools', 'image-tools', 'converters', 'guides', 'tips', 'updates']),
  tags: z.array(z.string()).optional(),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
  metaTitle: z.string().max(70).optional(),
  metaDescription: z.string().max(160).optional(),
  relatedTool: z.string().optional()
});

export const validateRegistration = async (c, next) => {
  try {
    const body = await c.req.json();
    registrationSchema.parse(body);
    c.set('validatedData', body);
    await next();
  } catch (e) {
    return sendError(c, 400, "Invalid registration data", e.errors);
  }
};

export const validateLogin = async (c, next) => {
  try {
    const body = await c.req.json();
    loginSchema.parse(body);
    c.set('validatedData', body);
    await next();
  } catch (e) {
    return sendError(c, 400, "Invalid login data", e.errors);
  }
};

export const validateBlog = async (c, next) => {
  try {
    const body = await c.req.json();
    const result = blogSchema.parse(body);
    c.set('validatedBlog', result);
    await next();
  } catch (e) {
    return c.json({ success: false, errors: e.errors }, 400);
  }
};