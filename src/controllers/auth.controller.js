import { sign } from 'hono/jwt';
import { setCookie, getCookie, deleteCookie } from 'hono/cookie';
import { generateId, generateSalt, hashPassword, comparePasswords } from '../utils/crypto';
import { sendEmail, emailTemplates } from '../services/email.service';
import { sendSuccess, sendError } from '../utils/response';

// --- HELPERS ---

const generateTokens = async (c, user, oldRefreshToken = null) => {
  const accessToken = await sign(
    { id: user.id, role: user.role, exp: Math.floor(Date.now() / 1000) + (60 * 5) }, // 15 mins
    c.env.ACCESS_TOKEN_SECRET
  );

  const refreshToken = await sign(
    { id: user.id, role: user.role, exp: Math.floor(Date.now() / 1000) + (60 * 30) }, // 7 days
    c.env.REFRESH_TOKEN_SECRET
  );

  const expiresAt = new Date(Date.now() + 1000 * 60 * 30).toISOString();

  // DB Logic: If oldRefreshToken exists, update that row. Otherwise, insert new.
  if (oldRefreshToken) {
    await c.env.DB.prepare(
      "UPDATE sessions SET refresh_token = ?, expires_at = ? WHERE refresh_token = ?"
    ).bind(refreshToken, expiresAt, oldRefreshToken).run();
  } else {
    await c.env.DB.prepare(
      "INSERT INTO sessions (id, user_id, refresh_token, expires_at, user_agent, ip_address) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(
      crypto.randomUUID(),
      user.id,
      refreshToken,
      expiresAt,
      c.req.header('User-Agent'),
      c.req.header('CF-Connecting-IP') || '127.0.0.1'
    ).run();
  }

  // Set Cookies
  const cookieOptions = {
    httpOnly: true,
    secure: true, // Set to true in production
    sameSite: 'None',
    path: '/'
  };

  setCookie(c, 'accessToken', accessToken, { ...cookieOptions, maxAge: 60 * 5 });
  setCookie(c, 'refreshToken', refreshToken, { ...cookieOptions, maxAge: 60 * 30 });

  return { accessToken, refreshToken };
};

// --- CONTROLLERS ---

export const registerUser = async (c) => {
  const { fullName, email, password, role, deviceName } = c.get('validatedData');

  const existingUser = await c.env.DB.prepare(
    "SELECT id FROM users WHERE email = ?"
  ).bind(email).first();

  if (existingUser) return sendError(c, 409, "User already exists");

  const userId = generateId();
  const salt = generateSalt();
  const hashedPassword = await hashPassword(password, salt);

  // 1. Create User
  await c.env.DB.prepare(
    "INSERT INTO users (id, fullName, email, password, salt, role) VALUES (?, ?, ?, ?, ?, ?)"
  ).bind(
    userId,
    fullName,
    email,
    hashedPassword,
    salt,
    role || 'user'
  ).run();

  // 2. AUTO-TRUST FIRST DEVICE
  const userAgent = c.req.header('User-Agent') || 'unknown';
  const deviceHash = await hashPassword(userAgent, userId);

  await c.env.DB.prepare(
    "INSERT INTO trusted_devices (id, user_id, device_hash, device_name, is_verified) VALUES (?, ?, ?, ?, 1)"
  ).bind(
    crypto.randomUUID(), userId, deviceHash, deviceName || "Initial Device"
  ).run();

  // 3. GENERATE TOKENS IMMEDIATELY
  const tokens = await generateTokens(c, { id: userId, role: role || 'user' });

  // 4. Background Welcome Email
  c.executionCtx.waitUntil(
    sendEmail(c.env.RESEND_API_KEY, email, "Welcome to Allypdf", emailTemplates.welcome(c, fullName)).catch(console.error)
  );

  return sendSuccess(
    c, 201,
    {
      user: { id: userId, email, fullName },
      ...tokens
    },
    "Account created and verified."
  );
};

export const loginUser = async (c) => {
  const { email, password, deviceName } = c.get('validatedData');

  const user = await c.env.DB.prepare(
    "SELECT * FROM users WHERE email = ?"
  ).bind(email).first();

  if (!user || !(await comparePasswords(password, user.password, user.salt))) {
    return sendError(c, 401, "Invalid credentials");
  }

  const userAgent = c.req.header('User-Agent') || 'unknown';
  const deviceHash = await hashPassword(userAgent, user.id);

  // FIX: Ensure this query matches your schema exactly
  const { results: existingDevices } = await c.env.DB.prepare(
    "SELECT * FROM trusted_devices WHERE user_id = ?"
  ).bind(user.id).all();

  // Rule: First device is trusted automatically
  if (existingDevices.length === 0) {

    await c.env.DB.prepare(
      "INSERT INTO trusted_devices (id, user_id, device_hash, device_name, is_verified) VALUES (?, ?, ?, ?, 1)"
    ).bind(
      crypto.randomUUID(), user.id, deviceHash, deviceName || "Primary Device"
    ).run();

  } else {

    const device = existingDevices.find(d => d.device_hash === deviceHash);

    if (!device || device.is_verified === 0) {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expires = new Date(Date.now() + 1000 * 60 * 10).toISOString();

      // Clear old OTPs first
      await c.env.DB.prepare(
        "DELETE FROM otps WHERE user_id = ? AND purpose = 'device_verification'"
      ).bind(user.id).run();

      await c.env.DB.prepare(
        "INSERT INTO otps (id, user_id, code, purpose, expires_at) VALUES (?, ?, ?, 'device_verification', ?)"
      ).bind(
        crypto.randomUUID(), user.id, code, expires
      ).run();

      if (!device) {
        await c.env.DB.prepare(
          "INSERT INTO trusted_devices (id, user_id, device_hash, device_name, is_verified) VALUES (?, ?, ?, ?, 0)"
        ).bind(
          crypto.randomUUID(), user.id, deviceHash, deviceName || "New Device"
        ).run();
      }
      console.log(deviceHash, code)

      c.executionCtx.waitUntil(
        sendEmail(c.env.RESEND_API_KEY, email, "Verify New Device", emailTemplates.deviceVerification(c, code)).catch(console.error)
      );

      return sendSuccess(
        c, 202,
        { deviceHash, email },
        "New device detected. OTP sent."
      );
    }

  }

  const tokens = await generateTokens(c, user);

  return sendSuccess(
    c, 200,
    tokens,
    "Login successful"
  );
};

export const verifyDeviceOTP = async (c) => {
  const { email, code, deviceHash } = await c.req.json();

  const user = await c.env.DB.prepare(
    "SELECT id, role FROM users WHERE email = ?"
  ).bind(email).first();

  const otp = await c.env.DB.prepare(
    "SELECT * FROM otps WHERE user_id = ? AND code = ? AND expires_at > datetime('now')"
  ).bind(user.id, code).first();

  if (!otp) return sendError(c, 400, "Invalid or expired OTP");

  await c.env.DB.batch([
    c.env.DB.prepare(
      "UPDATE trusted_devices SET is_verified = 1 WHERE user_id = ? AND device_hash = ?"
    ).bind(user.id, deviceHash),
    c.env.DB.prepare(
      "DELETE FROM otps WHERE id = ?"
    ).bind(otp.id)
  ]);

  const tokens = await generateTokens(c, user);

  return sendSuccess(
    c, 200,
    tokens, "Device verified"
  );
};

export const getTrustedDevices = async (c) => {
  const user = c.get('user');

  const { results } = await c.env.DB.prepare(
    "SELECT id, device_name, last_used, is_verified FROM trusted_devices WHERE user_id = ?"
  ).bind(user.id).all();

  return sendSuccess(
    c, 200,
    results
  );
};

export const removeTrustedDevice = async (c) => {
  const { deviceId } = await c.req.json();

  const user = c.get('user');

  await c.env.DB.prepare(
    "DELETE FROM trusted_devices WHERE id = ? AND user_id = ?"
  ).bind(deviceId, user.id).run();

  return sendSuccess(
    c, 200,
    {},
    "Device removed from trusted list."
  );
};

export const forgotPassword = async (c) => {
  const { email } = await c.req.json();

  const user = await c.env.DB.prepare(
    "SELECT id FROM users WHERE email = ?"
  ).bind(email).first();

  if (user) {
    const resetToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60).toISOString(); // 1 hour expiry

    // Store token in DB
    await c.env.DB.prepare(
      "INSERT INTO password_resets (token, user_id, expires_at) VALUES (?, ?, ?)"
    ).bind(resetToken, user.id, expiresAt).run();

    const resetLink = `${c.env.CLIENT_URL || 'https://allypdf.com'}/reset-password/${resetToken}`;
    console.log(resetLink)

    // Send Email
    c.executionCtx.waitUntil(
      sendEmail(c.env.RESEND_API_KEY, email, "Reset Your Password - Allypdf", emailTemplates.resetPassword(c, resetLink)).catch(err => console.error("Forgot Password Email Error:", err))
    );
  }

  // Always return success to prevent email enumeration attacks
  return sendSuccess(
    c, 200,
    {},
    "If an account with that email exists, a reset link was sent."
  );
};

export const resetPassword = async (c) => {
  const { token, newPassword } = await c.req.json();

  // 1. Find valid token
  const resetRecord = await c.env.DB.prepare(
    "SELECT * FROM password_resets WHERE token = ? AND expires_at > datetime('now')"
  ).bind(token).first();

  if (!resetRecord) return sendError(c, 400, "Invalid or expired reset token");

  // 2. Hash new password
  const newSalt = generateSalt();
  const newHashedPassword = await hashPassword(newPassword, newSalt);

  // 3. Update User and Delete Token in a batch
  await c.env.DB.batch([

    c.env.DB.prepare(
      "UPDATE users SET password = ?, salt = ? WHERE id = ?"
    ).bind(newHashedPassword, newSalt, resetRecord.user_id),

    c.env.DB.prepare(
      "DELETE FROM password_resets WHERE token = ?"
    ).bind(token),

    c.env.DB.prepare(
      "DELETE FROM sessions WHERE user_id = ?"
    ).bind(resetRecord.user_id) // Force logout from all devices for safety

  ]);

  return sendSuccess(
    c, 200,
    {},
    "Password has been reset successfully. Please login again."
  );
};

export const changeCurrentPassword = async (c) => {
  const { oldPassword, newPassword } = await c.req.json();

  const currentUser = c.get('user');

  // 1. Get current user's actual password/salt
  const user = await c.env.DB.prepare(
    "SELECT password, salt FROM users WHERE id = ?"
  ).bind(currentUser.id).first();

  // 2. Verify old password
  const isPasswordValid = await comparePasswords(oldPassword, user.password, user.salt);
  if (!isPasswordValid) return sendError(c, 400, "The old password you entered is incorrect");

  // 3. Update to new password
  const newSalt = generateSalt();
  const newHashedPassword = await hashPassword(newPassword, newSalt);

  await c.env.DB.prepare(
    "UPDATE users SET password = ?, salt = ? WHERE id = ?"
  ).bind(newHashedPassword, newSalt, currentUser.id).run();

  return sendSuccess(
    c, 200,
    {},
    "Password updated successfully"
  );
};

export const resendDeviceOTP = async (c) => {
  const { email } = await c.req.json();

  const user = await c.env.DB.prepare(
    "SELECT id FROM users WHERE email = ?"
  ).bind(email).first();

  if (!user) return sendError(c, 404, "User not found");

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expires = new Date(Date.now() + 1000 * 60 * 10).toISOString();

  // Update/Replace OTP
  await c.env.DB.prepare(
    "DELETE FROM otps WHERE user_id = ? AND purpose = 'device_verification'"
  ).bind(user.id).run();

  await c.env.DB.prepare(
    "INSERT INTO otps (id, user_id, code, purpose, expires_at) VALUES (?, ?, ?, 'device_verification', ?)"
  ).bind(crypto.randomUUID(), user.id, code, expires).run();
console.log(code)
  c.executionCtx.waitUntil(
    sendEmail(c.env.RESEND_API_KEY, email, "Your New Verification Code", emailTemplates.deviceVerification(c, code)).catch(err => console.error("Resend OTP Error:", err))
  );

  return sendSuccess(
    c, 200,
    {},
    "A new verification code has been sent to your email."
  );
};

export const refreshAccessToken = async (c) => {
  let refreshToken = getCookie(c, 'refreshToken');

  if (!refreshToken) {
    try {
      // Check if the content-type is JSON before parsing
      const contentType = c.req.header('Content-Type');
      if (contentType && contentType.includes('application/json')) {
        const body = await c.req.json();
        refreshToken = body.refreshToken;
      }
    } catch (e) {
      // Body was empty or invalid JSON, ignore and move on
    }
  }

  if (!refreshToken) return sendError(c, 401, "Refresh token missing");

  const session = await c.env.DB.prepare(
    "SELECT * FROM sessions WHERE refresh_token = ? AND expires_at > datetime('now')"
  ).bind(refreshToken).first();

  if (!session) {
    return sendError(c, 401, "Session expired or invalid. Please login again.");
  }

  const user = await c.env.DB.prepare(
    "SELECT id, role FROM users WHERE id = ?"
  ).bind(session.user_id).first();

  // Generate new ones and update the database row via the helper
  const tokens = await generateTokens(c, user, refreshToken);

  return sendSuccess(
    c, 200,
    tokens,
    "Token refreshed successfully"
  );
};

export const logoutUser = async (c) => {
  const refreshToken = getCookie(c, 'refreshToken');

  if (refreshToken) {
    await c.env.DB.prepare("DELETE FROM sessions WHERE refresh_token = ?").bind(refreshToken).run();
  }

  deleteCookie(c, 'accessToken');
  deleteCookie(c, 'refreshToken');

  return sendSuccess(c, 200, {}, "Logged out");
};

export const logoutAllDevices = async (c) => {
  const user = c.get('user');

  await c.env.DB.prepare(
    "DELETE FROM sessions WHERE user_id = ?"
  ).bind(user.id).run();

  return sendSuccess(
    c, 200,
    {},
    "Logged out from all devices"
  );
};

export const getActiveSessions = async (c) => {
  const user = c.get('user');

  const { results } = await c.env.DB.prepare(
    "SELECT id, user_agent, ip_address, created_at FROM sessions WHERE user_id = ?"
  ).bind(user.id).all();

  return sendSuccess(
    c, 200,
    results
  );
};

export const revokeSession = async (c) => {
  const { sessionId } = await c.req.json();

  const user = c.get('user');

  await c.env.DB.prepare(
    "DELETE FROM sessions WHERE id = ? AND user_id = ?"
  ).bind(sessionId, user.id).run();

  return sendSuccess(
    c, 200,
    {},
    "Session revoked"
  );
};

export const getCurrentUser = async (c) => {
  const user = c.get('user');

  const currentUser = await c.env.DB.prepare(
    "SELECT id, fullName, email, role, created_at FROM users WHERE id = ?"
  ).bind(user.id).first();

  return sendSuccess(
    c, 200,
    currentUser,
    "User fetched Successfully"
  )
};