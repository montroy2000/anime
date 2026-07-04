const axios = require('axios');
const Config = require('../utils/config');
const { CustomError } = require('../middleware/errorHandler');

class Anveshna {
    constructor() {
        this.defaultPerPage = 20;
        this.watchBaseUrl = 'https://anveshna.devxoshakya.xyz';
    }

    get baseUrl() {
        return Config.baseUrl.replace(/\/+$/, '');
    }

    async fetchAdvancedSearch(query = '', page = 1, perPage = this.defaultPerPage, options = {}) {
        const url = `${this.baseUrl}/meta/anilist/advanced-search`;

        try {
            const response = await axios.get(url, {
                timeout: Config.requestTimeout,
                params: {
                    ...(query ? { query } : {}),
                    page,
                    perPage,
                    type: options.type || 'ANIME',
                    ...(options.sort ? { sort: JSON.stringify(options.sort) } : {})
                },
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': Config.userAgent
                }
            });

            return this.toAnimepaheApiShape(response.data);
        } catch (error) {
            const status = error.response?.status || 503;
            const message = error.response?.data?.message || error.message || 'Failed to fetch Anveshna data';
            throw new CustomError(`Anveshna request failed: ${message}`, status);
        }
    }

    async fetchSearchData(query, page = 1) {
        return this.fetchAdvancedSearch(query, page);
    }

    async fetchAiringData(page = 1) {
        return this.fetchAdvancedSearch('', page, this.defaultPerPage, {
            sort: ['POPULARITY_DESC']
        });
    }

    async fetchAnimeData(id, provider = 'gogoanime') {
        const url = `${this.baseUrl}/meta/anilist/data/${encodeURIComponent(String(id))}`;

        try {
            const response = await axios.get(url, {
                timeout: Config.requestTimeout,
                params: { provider },
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': Config.userAgent
                }
            });

            return response.data;
        } catch (error) {
            const status = error.response?.status || 503;
            const message = error.response?.data?.message || error.message || 'Failed to fetch Anveshna anime data';
            throw new CustomError(`Anveshna request failed: ${message}`, status);
        }
    }

    async getStreamingLinks(id, episodeId, language = 'sub') {
        const episodeNumber = Number.parseInt(String(episodeId), 10);
        if (!id || !Number.isFinite(episodeNumber) || episodeNumber < 1) {
            throw new CustomError('Both id and a numeric episodeId are required for Anveshna playback', 400);
        }

        const animeData = await this.fetchAnimeData(id).catch(error => {
            console.warn(`Unable to fetch Anveshna anime metadata for ${id}: ${error.message}`);
            return null;
        });

        const title = animeData?.title?.english || animeData?.title?.romaji || animeData?.title?.userPreferred || null;
        const watchPage = this.buildWatchUrl(id, episodeNumber);
        const iframe = this.buildIframeUrl(id, episodeNumber, language);

        return {
            ids: {
                anilist_id: Number.parseInt(String(id), 10) || null,
                mal_id: animeData?.malId || null
            },
            session: String(id),
            provider: 'anveshna',
            episode: String(episodeNumber),
            anime_title: title,
            watchPage,
            sources: [
                {
                    url: iframe,
                    embed: iframe,
                    isIframe: true,
                    isM3U8: false,
                    language
                }
            ],
            episodes: this.buildEpisodeLinks(id, animeData?.totalEpisodes),
            downloads: []
        };
    }

    buildWatchUrl(id, episodeNumber) {
        return `${this.watchBaseUrl}/watch/${encodeURIComponent(String(id))}?ep=${encodeURIComponent(String(episodeNumber))}`;
    }

    buildIframeUrl(id, episodeNumber, language = 'sub') {
        const normalizedLanguage = String(language).toLowerCase() === 'dub' ? 'dub' : 'sub';
        return `https://megaplay.buzz/stream/ani/${encodeURIComponent(String(id))}/${encodeURIComponent(String(episodeNumber))}/${normalizedLanguage}`;
    }

    buildEpisodeLinks(id, totalEpisodes) {
        const count = Number.parseInt(String(totalEpisodes), 10);
        if (!Number.isFinite(count) || count < 1) return [];

        return Array.from({ length: count }, (_, index) => {
            const episode = index + 1;
            return {
                id: String(episode),
                episode,
                session: String(episode),
                title: `Episode ${episode}`,
                link: this.buildWatchUrl(id, episode)
            };
        });
    }

    toAnimepaheApiShape(payload) {
        const results = Array.isArray(payload?.results) ? payload.results : [];

        return {
            total: payload?.totalResults,
            per_page: results.length || this.defaultPerPage,
            current_page: payload?.currentPage,
            last_page: payload?.totalPages,
            data: results.map(item => this.toAnimepaheItem(item))
        };
    }

    toAnimepaheItem(item) {
        const title = item?.title?.english || item?.title?.romaji || item?.title?.userPreferred || item?.title?.native || null;

        return {
            id: item?.id || null,
            title,
            status: item?.status || null,
            type: item?.type || null,
            episodes: item?.totalEpisodes || item?.currentEpisode || null,
            score: item?.rating || null,
            year: item?.releaseDate || null,
            season: null,
            poster: item?.image || null,
            session: item?.id ? String(item.id) : null,
            source: 'anveshna',
            malId: item?.malId || null,
            genres: item?.genres || [],
            description: item?.description || null,
            cover: item?.cover || null
        };
    }
}

module.exports = new Anveshna();
