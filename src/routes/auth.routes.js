import { Hono } from 'hono';
import * as ctrl from '../controllers/auth.controller';
import { verifyJWT } from '../middleware/auth.middleware';
import { validateRegistration, validateLogin } from '../middleware/validation';

const auth = new Hono();

auth.post('/register', validateRegistration, ctrl.registerUser);
auth.post('/login', validateLogin, ctrl.loginUser);
auth.post('/verify-device', ctrl.verifyDeviceOTP);
auth.post('/refresh-token', ctrl.refreshAccessToken);
auth.post('/forgot-password', ctrl.forgotPassword);
auth.post('/reset-password/:token', ctrl.resetPassword);
auth.post('/resend-device-otp', ctrl.resendDeviceOTP);

// Protected routes
auth.get('/me', verifyJWT, ctrl.getCurrentUser);
auth.post('/change-password', verifyJWT, ctrl.changeCurrentPassword);
auth.post('/logout', verifyJWT, ctrl.logoutUser);
auth.post('/logout-all', verifyJWT, ctrl.logoutAllDevices);
auth.get('/trusted-devices', verifyJWT, ctrl.getTrustedDevices);
auth.post('/trusted-devices/:deviceId', verifyJWT, ctrl.removeTrustedDevice);
auth.get('/sessions', verifyJWT, ctrl.getActiveSessions);
auth.post('/sessions/:sessionId', verifyJWT, ctrl.revokeSession);

export default auth;