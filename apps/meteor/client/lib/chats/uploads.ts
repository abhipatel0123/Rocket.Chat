import type { IMessage, IRoom, IE2EEMessage, IUpload } from '@rocket.chat/core-typings';
import { Emitter } from '@rocket.chat/emitter';
import { Random } from '@rocket.chat/random';

import { UserAction, USER_ACTIVITIES } from '../../../app/ui/client/lib/UserAction';
import { getErrorMessage } from '../errorHandling';
import type { UploadsAPI } from './ChatAPI';
import type { Upload } from './Upload';
import { sdk } from '../../../app/utils/client/lib/SDKClient';

let uploads: readonly Upload[] = [];

const emitter = new Emitter<{ update: void; [x: `cancelling-${Upload['id']}`]: void }>();

const updateUploads = (update: (uploads: readonly Upload[]) => readonly Upload[]): void => {
	uploads = update(uploads);
	emitter.emit('update');
};

const get = (): readonly Upload[] => uploads;

const subscribe = (callback: () => void): (() => void) => emitter.on('update', callback);

const cancel = (id: Upload['id']): void => {
	emitter.emit(`cancelling-${id}`);
};

const wipeFailedOnes = (): void => {
	updateUploads((uploads) => uploads.filter((upload) => !upload.error));
};

const removeUpload = (id: Upload['id']): void => {
	updateUploads((uploads) => uploads.filter((upload) => upload.id !== id));
};

const editUploadFileName = (id: Upload['id'], fileName: Upload['name']): void => {
	updateUploads((uploads) =>
		uploads.map((upload) =>
			upload.id === id ? { ...upload, file: new File([upload.file], fileName, { type: upload.file.type }) } : upload,
		),
	);
};

const clear = (): void => {
	updateUploads(() => []);
};

const send = async (
	file: File,
	{
		description,
		msg,
		rid,
		tmid,
		t,
	}: {
		description?: string;
		msg?: string;
		rid: string;
		tmid?: string;
		t?: IMessage['t'];
	},
	getContent?: (fileId: string[], fileUrl: string[]) => Promise<IE2EEMessage['content']>,
	fileContent?: { raw: Partial<IUpload>; encrypted?: { algorithm: string; ciphertext: string } | undefined },
): Promise<void> => {
	const id = Random.id();
	updateUploads((uploads) => [
		...uploads,
		{
			id,
			name: fileContent?.raw.name || file.name,
			file,
			percentage: 0,
			url: URL.createObjectURL(file),
		},
	]);

	try {
		await new Promise((resolve, reject) => {
			const xhr = sdk.rest.upload(
				`/v1/rooms.media/${rid}`,
				{
					file,
					...(fileContent && {
						content: JSON.stringify(fileContent.encrypted),
					}),
				},
				{
					load: (event) => {
						resolve(event);
					},
					progress: (event) => {
						if (!event.lengthComputable) {
							return;
						}
						const progress = (event.loaded / event.total) * 100;
						updateUploads((uploads) =>
							uploads.map((upload) => {
								if (upload.id !== id) {
									return upload;
								}

								return {
									...upload,
									percentage: Math.round(progress) || 0,
								};
							}),
						);
					},
					error: (event) => {
						updateUploads((uploads) =>
							uploads.map((upload) => {
								if (upload.id !== id) {
									return upload;
								}

								return {
									...upload,
									percentage: 0,
									error: new Error(xhr.responseText),
								};
							}),
						);
						reject(event);
					},
				},
			);

			xhr.onload = () => {
				if (xhr.readyState === xhr.DONE && xhr.status === 200) {
					const result = JSON.parse(xhr.responseText);
					updateUploads((uploads) =>
						uploads.map((upload) => {
							if (upload.id !== id) {
								return upload;
							}

							return {
								...upload,
								id: result.file._id,
								url: result.file.url,
							};
						}),
					);
				}
			};

			emitter.once(`cancelling-${id}`, () => {
				xhr.abort();
				updateUploads((uploads) => uploads.filter((upload) => upload.id !== id));
				reject(new Error('Upload cancelled'));
			});
		});
		// updateUploads((uploads) => uploads.filter((upload) => upload.id !== id));
	} catch (error: unknown) {
		updateUploads((uploads) =>
			uploads.map((upload) => {
				if (upload.id !== id) {
					return upload;
				}

				return {
					...upload,
					percentage: 0,
					error: new Error(getErrorMessage(error)),
				};
			}),
		);
	} finally {
		if (!uploads.length) {
			UserAction.stop(rid, USER_ACTIVITIES.USER_UPLOADING, { tmid });
		}
	}
};

export const createUploadsAPI = ({ rid, tmid }: { rid: IRoom['_id']; tmid?: IMessage['_id'] }): UploadsAPI => ({
	get,
	subscribe,
	wipeFailedOnes,
	cancel,
	clear,
	removeUpload,
	editUploadFileName,
	send: (
		file: File,
		{ description, msg, t }: { description?: string; msg?: string; t?: IMessage['t'] },
		getContent?: (fileId: string[], fileUrl: string[]) => Promise<IE2EEMessage['content']>,
		fileContent?: { raw: Partial<IUpload>; encrypted?: { algorithm: string; ciphertext: string } | undefined },
	): Promise<void> => send(file, { description, msg, rid, tmid, t }, getContent, fileContent),
});
