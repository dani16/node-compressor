import {
	assertDirectoryWritable,
	assertFileReadable,
} from '#Lib/assert-file.js';
import createProgress from '#Lib/progress-bar.js';
import { ProgressStream } from '#Lib/progress-stream.js';
import { createReadStream, createWriteStream } from 'fs';
import { unlink } from 'fs/promises';
import { dirname, join } from 'path';
import { emitKeypressEvents } from 'readline';
import { pipeline } from 'stream';
import { fileURLToPath } from 'url';
import { constants, createGzip } from 'zlib';

const inputFile = 'Twin.Peaks.1x00.avi';
const inputPathFile = join(
	dirname(fileURLToPath(import.meta.url)),
	'../data',
	inputFile
);

const outputFile = `${inputFile}.gz`;
const outputPath = join(dirname(fileURLToPath(import.meta.url)), '../out');
const outputPathFile = join(outputPath, outputFile);

const bootstrap = async () => {
	// Check files and directories exists and have permission
	await assertFileReadable(inputPathFile);
	await assertDirectoryWritable(outputPath);

	console.log('Compressor, press "p" to pause or "r" to resume...');

	const progressBar = await createProgress(inputPathFile);

	// Create streams
	const readFileStream = createReadStream(inputPathFile);
	const progressStream = new ProgressStream(progressBar);
	const gzipStream = createGzip({ level: constants.Z_BEST_COMPRESSION });
	const writeFileStream = createWriteStream(outputPathFile);

	// User actions
	const keyPressHandler = async key => {
		console.log('key', key);

		if (key === '\u0003') {
			try {
				await unlink(outputPathFile);
			} catch (err) {}

			console.log('\nCompression aborted, finishing progress...');
			process.exit();
		} else if (!gzipStream.isPaused() && key === 'p') {
			gzipStream.pause();

			console.clear();
			console.log('Compression paused, press "r" to resume');
		} else if (gzipStream.isPaused() && key === 'r') {
			gzipStream.resume();

			console.clear();
			console.log('Compression in progress, press "p" to pause');
		}
	};

	emitKeypressEvents(process.stdin);

	if (process.stdin.isTTY) {
		process.stdin.setRawMode(true);
	}

	process.stdin.on('keypress', keyPressHandler);

	// Connect streams
	pipeline(
		readFileStream,
		progressStream,
		gzipStream,
		writeFileStream,
		async err => {
			if (err) {
				try {
					await unlink(outputPathFile);
				} catch (err) {
					console.log('Compression aborted, an error has occurred', err);
					process.exit(1);
				}
			} else {
				console.log('Compression finished');

				process.stdin.setRawMode(false);
				process.stdin.off('keypress', keyPressHandler);

				process.exit();
			}
		}
	);
};

bootstrap();
