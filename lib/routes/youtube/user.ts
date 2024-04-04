import { Route } from '@/types';
import cache from '@/utils/cache';
import utils from './utils';
import { config } from '@/config';
import { parseDate } from '@/utils/parse-date';
import got from '@/utils/got';
import { load } from 'cheerio';

export const route: Route = {
    path: '/user/:username/:embed?',
    categories: ['social-media'],
    example: '/youtube/user/JFlaMusic',
    parameters: { username: 'YouTuber id', embed: 'Default to embed the video, set to any value to disable embedding' },
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: false,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    radar: [
        {
            source: ['www.youtube.com/user/:username'],
            target: '/user/:username',
        },
    ],
    name: 'User',
    maintainers: ['DIYgod'],
    handler,
};

async function handler(ctx) {
    if (!config.youtube || !config.youtube.key) {
        throw new Error('YouTube RSS is disabled due to the lack of <a href="https://docs.rsshub.app/deploy/config#route-specific-configurations">relevant config</a>');
    }
    const username = ctx.req.param('username');
    const embed = !ctx.req.param('embed');

    let playlistId;
    let channelName;
    if (username.startsWith('@')) {
        const link = `https://www.youtube.com/${username}`;
        const response = await got(link);
        const $ = load(response.data);
        const channelId = $('meta[itemprop="identifier"]').attr('content');
        channelName = $('meta[itemprop="name"]').attr('content');
        playlistId = (await utils.getChannelWithId(channelId, 'contentDetails', cache)).data.items[0].contentDetails.relatedPlaylists.uploads;
    }
    playlistId = playlistId || (await utils.getChannelWithUsername(username, 'contentDetails', cache)).data.items[0].contentDetails.relatedPlaylists.uploads;

    const data = (await utils.getPlaylistItems(playlistId, 'snippet', cache)).data.items;

    return {
        title: `${channelName || username} - YouTube`,
        link: username.startsWith('@') ? `https://www.youtube.com/${username}` : `https://www.youtube.com/user/${username}`,
        description: `YouTube user ${username}`,
        item: data
            .filter((d) => d.snippet.title !== 'Private video' && d.snippet.title !== 'Deleted video')
            .map((item) => {
                const snippet = item.snippet;
                const videoId = snippet.resourceId.videoId;
                const img = utils.getThumbnail(snippet.thumbnails);
                return {
                    title: snippet.title,
                    description: utils.renderDescription(embed, videoId, img, utils.formatDescription(snippet.description)),
                    pubDate: parseDate(snippet.publishedAt),
                    link: `https://www.youtube.com/watch?v=${videoId}`,
                    author: snippet.videoOwnerChannelTitle,
                };
            }),
    };
}
