import { verify } from 'hono/jwt';
import { sendError } from '../utils/response';
import { getCookie } from 'hono/cookie';

export const verifyJWT = async (c, next) => {
  try {
    const token = getCookie(c, 'accessToken') ||
      c.req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      throw new ApiError(401, "Unauthorized request")
    }

    const decodedToken = await verify(token, c.env.ACCESS_TOKEN_SECRET, 'HS256');

    // Check if user exists in DB
    const user = await c.env.DB.prepare(
      "SELECT id, email, role FROM users WHERE id = ?"
    ).bind(decodedToken.id).first();

    if (!user) return sendError(
      c, 401,
      "Invalid Access Token"
    );

    c.set('user', user);

    await next();
  } catch (error) {
    return sendError(c, 401, error.message || "Invalid access token");
  }
};

export const verifyAdmin = async (c, next) => {
  const user = c.get('user');

  if (user.role !== 'admin') {
    return sendError(
      c, 403,
      "Access Denied: Admin privileges required"
    );
  }
  await next();
};