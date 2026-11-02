// Página pública de download do APK Android (distribuição direta, fora da Play Store).
import { Hono } from 'hono';
import { AppAndroidPage } from '../pages/AppAndroid';
import type { Vars } from '../lib/session';
import type { Bindings } from '../lib/bindings';

const android = new Hono<{ Bindings: Bindings; Variables: Vars }>();

android.get('/app', async (c) => {
  const user = c.get('user');
  return c.html(<AppAndroidPage user={user} />);
});

export default android;
