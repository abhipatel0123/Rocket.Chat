import { api, getConnection, getTrashCollection } from '@rocket.chat/core-services';
import { Logger } from '@rocket.chat/logger';
import { broker } from '@rocket.chat/network-broker';
import polka from 'polka';

import { registerServiceModels } from '../../../../apps/meteor/ee/server/lib/registerServiceModels';

const PORT = process.env.PORT || 3036;

(async () => {
	const db = await getConnection();

	registerServiceModels(db, await getTrashCollection());

	api.setBroker(broker);

	// need to import service after models are registered
	const { OmnichannelTranscript } = await import('@rocket.chat/omnichannel-services');

	api.registerService(new OmnichannelTranscript(Logger), ['queue-worker']);

	await api.start();

	polka()
		.get('/health', async function (_req, res) {
			try {
				await api.nodeList();
				res.end('ok');
			} catch (err) {
				console.error('Service not healthy', err);

				res.writeHead(500);
				res.end('not healthy');
			}
		})
		.listen(PORT);
})();
