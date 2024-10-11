import { useEndpoint } from '@rocket.chat/ui-contexts';
import { useQuery } from '@tanstack/react-query';

export const useVoipExtensionDetails = ({ extension, enabled = true }: { extension: string | undefined; enabled?: boolean }) => {
	const isEnabled = !!extension && enabled;
	const getContactDetails = useEndpoint('GET', '/v1/voip-freeswitch.extension.getDetails');
	const { data, ...result } = useQuery(
		['voip', 'voip-extension-details', extension, getContactDetails],
		() => getContactDetails({ extension: extension as string }),
		{
			enabled: isEnabled,
			onError: () => undefined,
		},
	);

	return {
		data: isEnabled ? data : undefined,
		...result,
	};
};