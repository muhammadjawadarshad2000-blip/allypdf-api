import { Hono } from 'hono';
import { runConversion } from '../controllers/converters.controller';

const converter = new Hono();

converter.post('/html-to-pdf', (c) => runConversion(c, 'pdf'));
converter.post('/html-to-image', (c) => runConversion(c, 'image'));

export default converter;