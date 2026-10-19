// Runs the media processor as a Cloudflare Container. When it runs is decided
// in ./routes.js; this file is the Durable Object that owns the container.
import { Container, getContainer } from '@cloudflare/containers';
import {
  ADMIN_PORT,
  CONTAINER_NAME,
  containerEnv,
  handleFetch,
  handleScheduled,
  startBackoffMs,
} from './routes.js';

export class MediaProcessor extends Container {
  defaultPort = ADMIN_PORT;
  // Requests renew this timer; FFmpeg does not. When it lapses the container
  // is asked whether it is busy, and a job of any length keeps it running.
  sleepAfter = '5m';

  constructor(ctx, env) {
    super(ctx, env);
    this.envVars = containerEnv(env);
  }

  /** Starts the container, unless it is running or crashed too recently to retry yet. */
  async wake() {
    if (this.container.running) return { started: false, running: true };

    const crashes = (await this.ctx.storage.get('crashes')) ?? { count: 0, at: 0 };
    const retryInMs = crashes.at + startBackoffMs(crashes.count) - Date.now();
    if (retryInMs > 0) return { started: false, backingOff: true, retryInMs, crashes };

    try {
      await this.startAndWaitForPorts();
      return { started: true };
    } catch (error) {
      await this.noteCrash(`start failed: ${error instanceof Error ? error.message : String(error)}`);
      return { started: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async status() {
    return {
      running: this.container.running,
      ...(await this.getState()),
      crashes: (await this.ctx.storage.get('crashes')) ?? null,
    };
  }

  async noteCrash(reason) {
    const crashes = (await this.ctx.storage.get('crashes')) ?? { count: 0, at: 0 };
    await this.ctx.storage.put('crashes', { count: crashes.count + 1, at: Date.now(), reason });
  }

  async onStop({ exitCode, reason }) {
    // The worker exits 0 when idle or asked to stop; anything else is a crash.
    if (exitCode === 0) await this.ctx.storage.delete('crashes');
    else await this.noteCrash(`exited ${exitCode} (${reason})`);
  }

  async onActivityExpired() {
    if (!this.container.running) return;
    if (await this.containerIsBusy()) return; // the timer renews; asked again later
    await this.stop();
  }

  async containerIsBusy() {
    try {
      const response = await this.containerFetch('http://container/health', { method: 'GET' }, ADMIN_PORT);
      if (!response.ok) return false;
      const body = await response.json();
      return body?.busy === true;
    } catch {
      return false;
    }
  }
}

function processor(env) {
  return getContainer(env.MEDIA_PROCESSOR, CONTAINER_NAME);
}

export default {
  fetch(request, env) {
    return handleFetch(request, env, processor(env));
  },

  scheduled(controller, env, ctx) {
    ctx.waitUntil(
      handleScheduled(controller.cron, env, processor(env)).then(
        (result) => {
          if (result.woke) console.log(JSON.stringify({ at: new Date().toISOString(), status: 'scheduled_wake', cron: controller.cron, ...result }));
        },
        (error) => {
          console.error(JSON.stringify({
            at: new Date().toISOString(),
            status: 'scheduled_wake_failed',
            cron: controller.cron,
            error: error instanceof Error ? error.message : String(error),
          }));
        },
      ),
    );
  },
};
