import { Box } from '@rocket.chat/fuselage';
import { useAttachmentAutoLoadEmbedMedia } from '@rocket.chat/ui-contexts';
import type { ReactElement } from 'react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { useCollapse } from '../../hooks/useCollapse';
import type { UrlPreviewMetadata } from './UrlPreviewMetadata';
import UrlPreviewResolver from './UrlPreviewResolver';

const UrlPreview = (props: UrlPreviewMetadata): ReactElement => {
	const autoLoadMedia = useAttachmentAutoLoadEmbedMedia();
	const [collapsed, collapse] = useCollapse(!autoLoadMedia);
	const { t } = useTranslation();

	return (
		<>
			<Box display='flex' flexDirection='row' color='hint' fontScale='c1' alignItems='center'>
				{t('Link_Preview')} {collapse}
			</Box>
			{!collapsed && <UrlPreviewResolver {...props} />}
		</>
	);
};

export default UrlPreview;
