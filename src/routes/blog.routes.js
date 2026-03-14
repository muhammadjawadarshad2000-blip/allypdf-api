import { Hono } from 'hono';
import * as ctrl from '../controllers/blog.controller';
import { verifyJWT, verifyAdmin } from '../middleware/auth.middleware';

const blog = new Hono();

// Public Routes
blog.get('/categories', ctrl.getCategories);
blog.get('/tags', ctrl.getTags);
blog.get('/', ctrl.getPublishedPosts);
blog.get('/:slug', ctrl.getPostBySlug);

// Admin Routes (Prefixed by logic)
blog.get('/admin/stats', verifyJWT, verifyAdmin, ctrl.getBlogStats);
blog.get('/admin/all', verifyJWT, verifyAdmin, ctrl.getAllPostsAdmin);
blog.get('/admin/:id', verifyJWT, verifyAdmin, ctrl.getPostBySlug); // Reuse slug logic or create getById
blog.post('/admin', verifyJWT, verifyAdmin, ctrl.createPost);
blog.put('/admin/:id', verifyJWT, verifyAdmin, ctrl.updatePost);
blog.delete('/admin/:id', verifyJWT, verifyAdmin, ctrl.deletePost);

export default blog;