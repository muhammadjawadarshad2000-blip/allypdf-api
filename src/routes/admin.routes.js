import { Hono } from 'hono';
import * as adminCtrl from '../controllers/admin.controller';
import { verifyJWT, verifyAdmin } from '../middleware/auth.middleware';

const admin = new Hono();

// Apply global admin protection
admin.use('/*', verifyJWT, verifyAdmin);

admin.get('/stats', adminCtrl.getAdminStats);
admin.get('/users', adminCtrl.getAllUsers);
admin.post('/users/update-role', adminCtrl.updateUserSettings);

export default admin;