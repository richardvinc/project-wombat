import { Injectable } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';

@Injectable()
export class OrdersLuaService {
  private readonly scripts = new Map<string, string>();

  getScript(name: string): string {
    const cached = this.scripts.get(name);

    if (cached) {
      return cached;
    }

    const script = readFileSync(this.resolvePath(name), 'utf8');
    this.scripts.set(name, script);
    return script;
  }

  private resolvePath(name: string): string {
    // to handle both local test and build run
    const candidates = [
      join(
        process.cwd(),
        'apps',
        'api',
        'src',
        'assets',
        'orders',
        'redis-scripts',
        name,
      ),
      join(
        process.cwd(),
        'dist',
        'apps',
        'api',
        'assets',
        'orders',
        'redis-scripts',
        name,
      ),
      join(__dirname, 'assets', 'orders', 'redis-scripts', name),
    ];

    for (const candidate of candidates) {
      try {
        readFileSync(candidate, 'utf8');
        return candidate;
      } catch {
        continue;
      }
    }

    throw new Error(`Lua script not found: ${name}`);
  }
}
