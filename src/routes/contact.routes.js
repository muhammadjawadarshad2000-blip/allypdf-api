import { Hono } from 'hono';
import * as ctrl from '../controllers/contact.controller';
import { verifyJWT, verifyAdmin } from '../middleware/auth.middleware';
import { rateLimiter } from '../middleware/rateLimiter';

const contact = new Hono();

// Public: Submit form
contact.post('/submit', rateLimiter(5, 60), ctrl.submitContactForm);

// Admin Only: Manage inquiries

contact.get('/stats', verifyJWT, verifyAdmin, ctrl.getContactStats);
contact.get('/', verifyJWT, verifyAdmin, ctrl.getAllContacts);
contact.get('/:id', verifyJWT, verifyAdmin, ctrl.getContactById);
contact.patch('/:id', verifyJWT, verifyAdmin, ctrl.updateContactStatus);
contact.post('/:id/reply', verifyJWT, verifyAdmin, ctrl.replyToContact);
contact.delete('/:id', verifyJWT, verifyAdmin, ctrl.deleteContact);

export default contact;