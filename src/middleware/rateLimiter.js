import { sendError } from '../utils/response';

export const rateLimiter = (limit = 5, windowInMinutes = 60) => {
  return async (c, next) => {
    const ip = c.req.header('CF-Connecting-IP') || '127.0.0.1';
    const key = `rl:contact:${ip}`;
    const now = new Date();

    const record = await c.env.DB.prepare(
      "SELECT * FROM rate_limits WHERE key = ?"
    ).bind(key).first();

    if (record) {
      const expiration = new Date(record.expire);
      if (now > expiration) {
        // Reset window
        await c.env.DB.prepare(
          "UPDATE rate_limits SET points = 1, expire = ? WHERE key = ?"
        ).bind(new Date(now.getTime() + windowInMinutes * 60000).toISOString(), key).run();
      } else if (record.points >= limit) {
        return sendError(
          c, 429, 
          "Too many requests. Try again later."
        );
      } else {
        // Increment points
        await c.env.DB.prepare(
          "UPDATE rate_limits SET points = points + 1 WHERE key = ?"
        ).bind(key).run();
      }
    } else {
      // First request
      await c.env.DB.prepare(
        "INSERT INTO rate_limits (key, points, expire) VALUES (?, 1, ?)"
      ).bind(key, new Date(now.getTime() + windowInMinutes * 60000).toISOString()).run();
    }

    await next();
  };
};