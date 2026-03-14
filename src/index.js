import { Hono } from 'hono';
import { cors } from 'hono/cors';
import adminRoutes from './routes/admin.routes';
import authRoutes from './routes/auth.routes';
import contactRoutes from './routes/contact.routes';
import blogRoutes from './routes/blog.routes';
import converterRoutes from './routes/converters.routes'

const app = new Hono();

app.use('/api/*', async (c, next) => {
  const corsMiddleware = cors({
    origin: c.env.CORS_ORIGIN,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS' , 'PATCH'],
    allowHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: ['Content-Length'],
    credentials: true,
  });
  
  return await corsMiddleware(c, next);
});

// Global Logger Middleware
app.use('*', async (c, next) => {
  console.log(`[${c.req.method}] ${c.req.url}`);
  await next();
});

// API Routes mounting
app.route('/api/v1/admin', adminRoutes);
app.route('/api/v1/users', authRoutes);
app.route('/api/v1/contact', contactRoutes);
app.route('/api/v1/blog', blogRoutes);
app.route('/api/v1/converter', converterRoutes);


// Health check
app.get('/health', (c) => c.json({ status: "OK", edge: true }));

export default app;