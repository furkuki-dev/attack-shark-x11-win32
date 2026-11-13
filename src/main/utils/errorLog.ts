import { app } from 'electron';
import { appendFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { release } from 'os';
import { inspect } from 'util';

/**
 * Appends the full error (message, stack, nested causes) to a log file in the
 * app's userData folder and returns the path, so the UI can point the user at it.
 */
export function logError(context: string, error: unknown): string {
	const dir = app.getPath('userData');
	const file = join(dir, 'attack-shark-errors.log');
	const header =
		`[${new Date().toISOString()}] ${context}\n` +
		`platform=${process.platform} arch=${process.arch} osRelease=${release()} ` +
		`electron=${process.versions.electron} node=${process.versions.node}\n`;
	const entry = header + inspect(error, { depth: 6 }) + '\n\n';
	try {
		mkdirSync(dir, { recursive: true });
		appendFileSync(file, entry, 'utf8');
	} catch (writeError) {
		console.error('Failed to write error log:', writeError);
	}
	return file;
}
